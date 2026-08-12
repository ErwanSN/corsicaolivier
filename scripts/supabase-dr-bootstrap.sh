#!/usr/bin/env bash
set -Eeuo pipefail
set +x

readonly SCRIPT_DIRECTORY="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly REPOSITORY_ROOT="$(cd -- "$SCRIPT_DIRECTORY/.." && pwd)"
readonly ARTIFACT_DIRECTORY="$REPOSITORY_ROOT/ops/supabase-dr"
readonly ORDER_FILE="$ARTIFACT_DIRECTORY/bootstrap-order.txt"
readonly CHECKSUM_FILE="$ARTIFACT_DIRECTORY/bootstrap-checksums.sha256"
readonly EMPTY_TARGET_ACKNOWLEDGEMENT='YES-I-CONFIRM-EMPTY-TARGET'
readonly DOCKER_BINARY="${DR_DOCKER_BINARY:-docker}"
temporary_postgres_superuser=false

fail() {
  printf 'Erreur bootstrap DR : %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "commande requise absente : $1"
}

require_environment() {
  local variable_name="$1"
  [[ -n "${!variable_name:-}" ]] || fail "variable obligatoire absente : $variable_name"
}

verify_artifact() {
  require_command sha256sum
  [[ -f "$CHECKSUM_FILE" ]] || fail "manifeste SHA-256 absent"
  (
    cd -- "$ARTIFACT_DIRECTORY"
    sha256sum --check --strict --quiet bootstrap-checksums.sha256
  ) || fail "empreinte du bootstrap invalide"
}

preflight_volume() {
  local existing_volumes
  local existing_project_objects
  local claim_id
  local actual_claim

  require_command "$DOCKER_BINARY"
  require_environment DR_PGDATA_VOLUME
  require_environment COMPOSE_PROJECT_NAME
  [[ "$DR_PGDATA_VOLUME" =~ ^corsica-supabase-dr-[a-z0-9][a-z0-9_-]{7,59}$ ]] ||
    fail "DR_PGDATA_VOLUME doit être un nom dédié corsica-supabase-dr-*"
  [[ "$COMPOSE_PROJECT_NAME" =~ ^corsica-supabase-dr-[a-z0-9][a-z0-9_-]{7,59}$ ]] ||
    fail "COMPOSE_PROJECT_NAME doit être un nom dédié corsica-supabase-dr-*"
  [[ "$COMPOSE_PROJECT_NAME" == "$DR_PGDATA_VOLUME" ]] ||
    fail "COMPOSE_PROJECT_NAME et DR_PGDATA_VOLUME doivent partager le même identifiant unique"

  if ! existing_volumes="$("$DOCKER_BINARY" volume ls --quiet)"; then
    fail "impossible d’inventorier les volumes Docker"
  fi

  while IFS= read -r existing_volume; do
    [[ "$existing_volume" != "$DR_PGDATA_VOLUME" ]] ||
      fail "le volume $DR_PGDATA_VOLUME existe déjà ; choisissez un nouveau nom"
  done <<< "$existing_volumes"

  if ! existing_project_objects="$({
    "$DOCKER_BINARY" container ls --all --quiet \
      --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME"
    "$DOCKER_BINARY" network ls --quiet \
      --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME"
    "$DOCKER_BINARY" volume ls --quiet \
      --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME"
  })"; then
    fail "impossible de vérifier l’unicité du projet Compose DR"
  fi
  [[ -z "$existing_project_objects" ]] ||
    fail "le projet Compose $COMPOSE_PROJECT_NAME existe déjà ; choisissez un nouvel identifiant"

  claim_id="$({
    printf '%s:%s:%s:%s' "$DR_PGDATA_VOLUME" "$$" "$RANDOM" "$(date -u +%s%N)"
  } | sha256sum | cut -d ' ' -f 1)"

  if ! "$DOCKER_BINARY" volume create \
    --driver local \
    --label com.corsica.dr.bootstrap=true \
    --label "com.corsica.dr.preflight-claim=$claim_id" \
    --label "com.corsica.dr.compose-project=$COMPOSE_PROJECT_NAME" \
    "$DR_PGDATA_VOLUME" >/dev/null; then
    fail "création du nouveau volume DR impossible"
  fi

  if ! actual_claim="$($DOCKER_BINARY volume inspect \
    --format '{{ index .Labels "com.corsica.dr.preflight-claim" }}' \
    "$DR_PGDATA_VOLUME")"; then
    fail "le volume DR créé ne peut pas être vérifié"
  fi

  [[ "$actual_claim" == "$claim_id" ]] ||
    fail "création concurrente détectée ; le volume ne sera pas utilisé"

  printf 'Nouveau volume DR réservé et vérifié : %s\n' "$DR_PGDATA_VOLUME"
}

run_volume_preflight() {
  verify_artifact
  preflight_volume
}

psql_as() {
  local database_role="$1"
  shift
  psql \
    --no-psqlrc \
    --no-password \
    --set ON_ERROR_STOP=1 \
    --host "$PGHOST" \
    --port "$PGPORT" \
    --dbname "$POSTGRES_DB" \
    --username "$database_role" \
    "$@"
}

preflight_empty_target() {
  local preflight_result
  local role_count
  local canonical_roles_only
  local base_schema_count
  local functions_schema_absent
  local realtime_schema_absent
  local auxiliary_database_absent
  local migrations_schema_absent
  local canonical_database_only
  local canonical_schemas_only
  local public_objects_absent
  local auth_data_absent
  local auth_migrations_canonical
  local storage_data_absent
  local postgres_is_not_superuser

  if ! preflight_result="$(
    psql_as supabase_admin --tuples-only --no-align --command "
      select
        (select count(*) from pg_roles where rolname in (
          'postgres', 'supabase_admin', 'authenticator', 'pgbouncer',
          'supabase_auth_admin', 'supabase_storage_admin'
        )),
        (
          select array_agg(rolname::text order by rolname::text) = array[
            'anon', 'authenticated', 'authenticator', 'dashboard_user',
            'pgbouncer', 'postgres', 'service_role', 'supabase_admin',
            'supabase_auth_admin', 'supabase_read_only_user',
            'supabase_replication_admin', 'supabase_storage_admin'
          ]::text[]
          from pg_roles
          where rolname !~ '^pg_'
        ),
        (select count(*) from pg_namespace where nspname in ('auth', 'extensions', 'storage')),
        to_regnamespace('supabase_functions') is null,
        to_regnamespace('_realtime') is null,
        not exists (select 1 from pg_database where datname = '_supabase'),
        to_regnamespace('supabase_migrations') is null,
        not exists (
          select 1
          from pg_database
          where datallowconn
            and not datistemplate
            and datname <> current_database()
        ),
        not exists (
          select 1
          from pg_namespace namespace
          where namespace.nspname not in (
            'auth', 'extensions', 'graphql', 'graphql_public',
            'information_schema', 'pgbouncer', 'public', 'realtime',
            'storage', 'vault'
          )
            and namespace.nspname !~ '^pg_'
            and not exists (
              select 1
              from pg_depend dependency
              where dependency.classid = 'pg_namespace'::regclass
                and dependency.objid = namespace.oid
                and dependency.deptype = 'e'
            )
        ),
        not exists (
          select 1
          from pg_class relation
          join pg_namespace namespace on namespace.oid = relation.relnamespace
          where namespace.nspname = 'public'
            and relation.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
            and not exists (
              select 1
              from pg_depend dependency
              where dependency.classid = 'pg_class'::regclass
                and dependency.objid = relation.oid
                and dependency.deptype = 'e'
            )
          union all
          select 1
          from pg_proc routine
          join pg_namespace namespace on namespace.oid = routine.pronamespace
          where namespace.nspname = 'public'
            and not exists (
              select 1
              from pg_depend dependency
              where dependency.classid = 'pg_proc'::regclass
                and dependency.objid = routine.oid
                and dependency.deptype = 'e'
            )
          union all
          select 1
          from pg_type data_type
          join pg_namespace namespace on namespace.oid = data_type.typnamespace
          where namespace.nspname = 'public'
            and data_type.typrelid = 0
            and data_type.typtype in ('c', 'd', 'e', 'm', 'r')
            and not exists (
              select 1
              from pg_depend dependency
              where dependency.classid = 'pg_type'::regclass
                and dependency.objid = data_type.oid
                and dependency.deptype = 'e'
            )
        ),
        (
          (select count(*) from auth.users) = 0
          and (select count(*) from auth.refresh_tokens) = 0
          and (select count(*) from auth.instances) = 0
          and (select count(*) from auth.audit_log_entries) = 0
        ),
        (
          select coalesce(
            array_agg(version::text order by version::text),
            array[]::text[]
          ) = array[
            '20171026211738', '20171026211808', '20171026211834',
            '20180103212743', '20180108183307', '20180119214651',
            '20180125194653'
          ]::text[]
          from auth.schema_migrations
        ),
        (
          (select count(*) from storage.buckets) = 0
          and (select count(*) from storage.objects) = 0
          and (select count(*) from storage.migrations) = 0
        ),
        (select not rolsuper from pg_roles where rolname = 'postgres');
    "
  )"; then
    fail "la cible ne correspond pas au socle Supabase vierge qualifié"
  fi

  IFS='|' read -r \
    role_count \
    canonical_roles_only \
    base_schema_count \
    functions_schema_absent \
    realtime_schema_absent \
    auxiliary_database_absent \
    migrations_schema_absent \
    canonical_database_only \
    canonical_schemas_only \
    public_objects_absent \
    auth_data_absent \
    auth_migrations_canonical \
    storage_data_absent \
    postgres_is_not_superuser <<< "$preflight_result"

  [[ "$role_count" == '6' ]] || fail "les rôles système Supabase de base sont incomplets"
  [[ "$canonical_roles_only" == 't' ]] || fail "les rôles diffèrent de l’image qualifiée"
  [[ "$base_schema_count" == '3' ]] || fail "les schémas Supabase de base sont incomplets"
  [[ "$functions_schema_absent" == 't' ]] || fail "supabase_functions existe déjà : cible non vide"
  [[ "$realtime_schema_absent" == 't' ]] || fail "_realtime existe déjà : cible non vide"
  [[ "$auxiliary_database_absent" == 't' ]] || fail "_supabase existe déjà : cible non vide"
  [[ "$migrations_schema_absent" == 't' ]] || fail "supabase_migrations existe déjà : cible non vide"
  [[ "$canonical_database_only" == 't' ]] || fail "une base non canonique existe : cible non vide"
  [[ "$canonical_schemas_only" == 't' ]] || fail "un schéma non canonique existe : cible non vide"
  [[ "$public_objects_absent" == 't' ]] || fail "un objet public non fourni par une extension existe : cible non vide"
  [[ "$auth_data_absent" == 't' ]] || fail "Auth contient déjà des données : cible non vide"
  [[ "$auth_migrations_canonical" == 't' ]] ||
    fail "le baseline de migrations Auth diffère de l’image qualifiée"
  [[ "$storage_data_absent" == 't' ]] || fail "Storage contient déjà des données : cible non vide"
  [[ "$postgres_is_not_superuser" == 't' ]] ||
    fail "postgres est déjà superuser : cible non canonique"
}

grant_temporary_bootstrap_superuser() {
  temporary_postgres_superuser=true
  psql_as supabase_admin \
    --command 'alter role postgres superuser;' >/dev/null || return 1

  [[ "$(
    psql_as supabase_admin --tuples-only --no-align \
      --command "select rolsuper from pg_roles where rolname = 'postgres';" \
      | tr -d '[:space:]'
  )" == 't' ]] || return 1
}

revoke_temporary_bootstrap_superuser() {
  psql_as supabase_admin \
    --command 'alter role postgres nosuperuser;' >/dev/null || return 1

  [[ "$(
    psql_as supabase_admin --tuples-only --no-align \
      --command "select not rolsuper from pg_roles where rolname = 'postgres';" \
      | tr -d '[:space:]'
  )" == 't' ]] || return 1

  temporary_postgres_superuser=false
}

cleanup() {
  local exit_status=$?

  if [[ "$temporary_postgres_superuser" == true ]]; then
    if ! revoke_temporary_bootstrap_superuser; then
      printf 'Erreur bootstrap DR : impossible de retirer le privilège temporaire.\n' >&2
      exit_status=1
    fi
  fi

  unset PGPASSWORD POSTGRES_PASSWORD JWT_SECRET
  exit "$exit_status"
}

apply_artifact() {
  local destination
  local database_role
  local source

  while read -r destination database_role source; do
    [[ -n "$destination" && "${destination:0:1}" != '#' ]] || continue
    if [[ "$destination" == migrations/* && "$temporary_postgres_superuser" == true ]]; then
      revoke_temporary_bootstrap_superuser
    fi
    printf 'Bootstrap DR : application de %s\n' "$destination"
    psql_as "$database_role" --file "$ARTIFACT_DIRECTORY/$source" >/dev/null
  done < "$ORDER_FILE"
}

verify_postconditions() {
  local result

  result="$({
    psql_as supabase_admin --tuples-only --no-align --command "
      select
        (select pg_get_userbyid(datdba) = 'supabase_admin' from pg_database where datname = '_supabase'),
        to_regnamespace('supabase_functions') is not null,
        to_regnamespace('_realtime') is not null,
        (select count(*) = 2
           from pg_db_role_setting settings
           cross join lateral unnest(settings.setconfig) as setting
          where settings.setdatabase = (select oid from pg_database where datname = 'postgres')
            and settings.setrole = 0
            and (setting like 'app.settings.jwt_secret=%' or setting like 'app.settings.jwt_exp=%'));
    "
  } | tr -d '[:space:]')"

  [[ "$result" == 't|t|t|t' ]] || fail "postconditions du bootstrap non satisfaites"
}

run_apply() {
  require_command psql
  require_environment PGHOST
  require_environment PGPORT
  require_environment POSTGRES_DB
  require_environment POSTGRES_USER
  require_environment POSTGRES_PASSWORD
  require_environment JWT_SECRET
  require_environment JWT_EXP
  require_environment DR_ACKNOWLEDGE_EMPTY_TARGET

  [[ "$DR_ACKNOWLEDGE_EMPTY_TARGET" == "$EMPTY_TARGET_ACKNOWLEDGEMENT" ]] ||
    fail "confirmation explicite de cible vide invalide"
  [[ "$POSTGRES_DB" == 'postgres' ]] || fail "seule la base canonique POSTGRES_DB=postgres est acceptée"
  [[ "$POSTGRES_USER" == 'supabase_admin' ]] || fail "seul POSTGRES_USER=supabase_admin est accepté"
  [[ "$PGPORT" =~ ^[0-9]{1,5}$ ]] || fail "PGPORT invalide"
  ((PGPORT >= 1 && PGPORT <= 65535)) || fail "PGPORT hors plage"
  ((${#POSTGRES_PASSWORD} >= 16)) || fail "POSTGRES_PASSWORD doit contenir au moins 16 caractères"
  ((${#JWT_SECRET} >= 32)) || fail "JWT_SECRET doit contenir au moins 32 caractères"
  [[ "$JWT_EXP" =~ ^[1-9][0-9]*$ ]] || fail "JWT_EXP doit être un entier strictement positif"

  export PGPASSWORD="$POSTGRES_PASSWORD"
  trap cleanup EXIT

  verify_artifact
  preflight_empty_target
  grant_temporary_bootstrap_superuser
  apply_artifact
  [[ "$temporary_postgres_superuser" == false ]] || revoke_temporary_bootstrap_superuser
  verify_postconditions
  printf 'Bootstrap DR appliqué et vérifié.\n'
}

usage() {
  printf 'Usage : %s verify|volume-preflight|apply\n' "${0##*/}" >&2
  exit 2
}

case "${1:-}" in
  verify)
    verify_artifact
    printf 'Bootstrap DR intègre : ordre et empreintes valides.\n'
    ;;
  volume-preflight)
    run_volume_preflight
    ;;
  apply)
    run_apply
    ;;
  *)
    usage
    ;;
esac

-- Semantic fingerprint for the application schema's owners and ACLs.
-- Expected on the production Supabase PostgreSQL 15.8 baseline after
-- migrations 001 through 043:
-- 54608488df650684a9136d081f22e0149ec7e9ffee76d6ecfdd059eaa31140a4
--
-- The ordering of PostgreSQL ACL arrays is deliberately normalized through
-- aclexplode(), so independent installations of the same platform baseline
-- produce the same value. A PostgreSQL/Supabase image upgrade requires a new
-- reviewed baseline rather than reusing this expected hash blindly.
with catalog_entries(entry) as (
  select concat_ws(
    E'\t',
    'DB_OWNER',
    database.datdba::regrole::text
  )
  from pg_catalog.pg_database database
  where database.datname = current_database()

  union all

  select concat_ws(
    E'\t',
    'DB_ACL',
    acl.grantor::regrole::text,
    case when acl.grantee = 0 then 'PUBLIC' else acl.grantee::regrole::text end,
    acl.privilege_type,
    acl.is_grantable::text
  )
  from pg_catalog.pg_database database
  cross join lateral aclexplode(
    coalesce(database.datacl, acldefault('d', database.datdba))
  ) acl
  where database.datname = current_database()

  union all

  select concat_ws(
    E'\t',
    'NS_OWNER',
    namespace.nspname,
    namespace.nspowner::regrole::text
  )
  from pg_catalog.pg_namespace namespace
  where namespace.nspname = 'public'

  union all

  select concat_ws(
    E'\t',
    'TYPE_OWNER',
    namespace.nspname,
    type.typname,
    type.typtype,
    type.typowner::regrole::text
  )
  from pg_catalog.pg_type type
  join pg_catalog.pg_namespace namespace
    on namespace.oid = type.typnamespace
  where namespace.nspname = 'public'

  union all

  select concat_ws(
    E'\t',
    'TYPE_ACL',
    namespace.nspname,
    type.typname,
    type.typtype,
    acl.grantor::regrole::text,
    case when acl.grantee = 0 then 'PUBLIC' else acl.grantee::regrole::text end,
    acl.privilege_type,
    acl.is_grantable::text
  )
  from pg_catalog.pg_type type
  join pg_catalog.pg_namespace namespace
    on namespace.oid = type.typnamespace
  cross join lateral aclexplode(
    coalesce(type.typacl, acldefault('T', type.typowner))
  ) acl
  where namespace.nspname = 'public'

  union all

  select concat_ws(
    E'\t',
    'NS_ACL',
    namespace.nspname,
    acl.grantor::regrole::text,
    case when acl.grantee = 0 then 'PUBLIC' else acl.grantee::regrole::text end,
    acl.privilege_type,
    acl.is_grantable::text
  )
  from pg_catalog.pg_namespace namespace
  cross join lateral aclexplode(
    coalesce(namespace.nspacl, acldefault('n', namespace.nspowner))
  ) acl
  where namespace.nspname = 'public'

  union all

  select concat_ws(
    E'\t',
    'REL_OWNER',
    namespace.nspname,
    relation.relname,
    relation.relkind,
    relation.relowner::regrole::text
  )
  from pg_catalog.pg_class relation
  join pg_catalog.pg_namespace namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relkind in ('r', 'p', 'v', 'm', 'S')

  union all

  select concat_ws(
    E'\t',
    'REL_ACL',
    namespace.nspname,
    relation.relname,
    relation.relkind,
    acl.grantor::regrole::text,
    case when acl.grantee = 0 then 'PUBLIC' else acl.grantee::regrole::text end,
    acl.privilege_type,
    acl.is_grantable::text
  )
  from pg_catalog.pg_class relation
  join pg_catalog.pg_namespace namespace
    on namespace.oid = relation.relnamespace
  cross join lateral aclexplode(
    coalesce(
      relation.relacl,
      acldefault(
        case when relation.relkind = 'S' then 'S'::"char" else 'r'::"char" end,
        relation.relowner
      )
    )
  ) acl
  where namespace.nspname = 'public'
    and relation.relkind in ('r', 'p', 'v', 'm', 'S')

  union all

  select concat_ws(
    E'\t',
    'PROC_OWNER',
    namespace.nspname,
    procedure.proname,
    pg_get_function_identity_arguments(procedure.oid),
    procedure.proowner::regrole::text
  )
  from pg_catalog.pg_proc procedure
  join pg_catalog.pg_namespace namespace
    on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'

  union all

  select concat_ws(
    E'\t',
    'PROC_ACL',
    namespace.nspname,
    procedure.proname,
    pg_get_function_identity_arguments(procedure.oid),
    acl.grantor::regrole::text,
    case when acl.grantee = 0 then 'PUBLIC' else acl.grantee::regrole::text end,
    acl.privilege_type,
    acl.is_grantable::text
  )
  from pg_catalog.pg_proc procedure
  join pg_catalog.pg_namespace namespace
    on namespace.oid = procedure.pronamespace
  cross join lateral aclexplode(
    coalesce(procedure.proacl, acldefault('f', procedure.proowner))
  ) acl
  where namespace.nspname = 'public'

  union all

  select concat_ws(
    E'\t',
    'DEFACL',
    namespace.nspname,
    default_acl.defaclrole::regrole::text,
    default_acl.defaclobjtype,
    acl.grantor::regrole::text,
    case when acl.grantee = 0 then 'PUBLIC' else acl.grantee::regrole::text end,
    acl.privilege_type,
    acl.is_grantable::text
  )
  from pg_catalog.pg_default_acl default_acl
  join pg_catalog.pg_namespace namespace
    on namespace.oid = default_acl.defaclnamespace
  cross join lateral aclexplode(default_acl.defaclacl) acl
  where namespace.nspname = 'public'
)
select encode(
  extensions.digest(
    coalesce(string_agg(entry, E'\n' order by entry), ''),
    'sha256'
  ),
  'hex'
) as public_schema_owner_acl_fingerprint
from catalog_entries;

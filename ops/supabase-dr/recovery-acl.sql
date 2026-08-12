\set ON_ERROR_STOP on

BEGIN;

DO $preflight$
DECLARE
  missing_roles text;
  missing_schemas text;
BEGIN
  IF session_user <> 'supabase_admin' OR current_user <> 'supabase_admin' THEN
    RAISE EXCEPTION 'recovery-acl.sql must start as supabase_admin';
  END IF;

  IF (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = current_database()) <> 'postgres' THEN
    RAISE EXCEPTION 'the recovery database must be owned by postgres';
  END IF;

  SELECT string_agg(required_role, ', ' ORDER BY required_role)
    INTO missing_roles
    FROM unnest(ARRAY[
      'anon', 'authenticated', 'authenticator', 'dashboard_user', 'pgbouncer',
      'postgres', 'service_role', 'supabase_admin', 'supabase_auth_admin',
      'supabase_functions_admin', 'supabase_storage_admin'
    ]) AS required_role
   WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = required_role);

  SELECT string_agg(required_schema, ', ' ORDER BY required_schema)
    INTO missing_schemas
    FROM unnest(ARRAY[
      'auth', 'extensions', 'graphql', 'graphql_public', 'public', 'realtime',
      'storage', 'supabase_functions'
    ]) AS required_schema
   WHERE NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = required_schema);

  IF missing_roles IS NOT NULL THEN
    RAISE EXCEPTION 'missing Supabase roles: %', missing_roles;
  END IF;

  IF missing_schemas IS NOT NULL THEN
    RAISE EXCEPTION 'missing Supabase schemas: %', missing_schemas;
  END IF;
END
$preflight$;

SET LOCAL ROLE postgres;

DO $database_acl$
BEGIN
  EXECUTE format('REVOKE ALL PRIVILEGES ON DATABASE %I FROM PUBLIC', current_database());
  EXECUTE format('REVOKE ALL PRIVILEGES ON DATABASE %I FROM dashboard_user', current_database());
  EXECUTE format('REVOKE ALL PRIVILEGES ON DATABASE %I FROM postgres', current_database());
  EXECUTE format('GRANT CONNECT, TEMPORARY ON DATABASE %I TO PUBLIC', current_database());
  EXECUTE format('GRANT ALL PRIVILEGES ON DATABASE %I TO postgres', current_database());
  EXECUTE format('GRANT ALL PRIVILEGES ON DATABASE %I TO dashboard_user', current_database());
END
$database_acl$;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON FUNCTIONS FROM PUBLIC, postgres, anon, authenticated, service_role, dashboard_user, authenticator, pgbouncer, supabase_admin, supabase_auth_admin, supabase_functions_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, postgres, anon, authenticated, service_role, dashboard_user, authenticator, pgbouncer, supabase_admin, supabase_auth_admin, supabase_functions_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, postgres, anon, authenticated, service_role, dashboard_user, authenticator, pgbouncer, supabase_admin, supabase_auth_admin, supabase_functions_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL PRIVILEGES ON FUNCTIONS TO postgres, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO postgres, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage
  REVOKE ALL PRIVILEGES ON FUNCTIONS FROM PUBLIC, postgres, anon, authenticated, service_role, dashboard_user, authenticator, pgbouncer, supabase_admin, supabase_auth_admin, supabase_functions_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, postgres, anon, authenticated, service_role, dashboard_user, authenticator, pgbouncer, supabase_admin, supabase_auth_admin, supabase_functions_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, postgres, anon, authenticated, service_role, dashboard_user, authenticator, pgbouncer, supabase_admin, supabase_auth_admin, supabase_functions_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL PRIVILEGES ON FUNCTIONS TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL PRIVILEGES ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA storage GRANT ALL PRIVILEGES ON TABLES TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA supabase_functions
  REVOKE ALL PRIVILEGES ON FUNCTIONS FROM PUBLIC, postgres, anon, authenticated, service_role, dashboard_user, authenticator, pgbouncer, supabase_admin, supabase_auth_admin, supabase_functions_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA supabase_functions
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, postgres, anon, authenticated, service_role, dashboard_user, authenticator, pgbouncer, supabase_admin, supabase_auth_admin, supabase_functions_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA supabase_functions
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, postgres, anon, authenticated, service_role, dashboard_user, authenticator, pgbouncer, supabase_admin, supabase_auth_admin, supabase_functions_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA supabase_functions GRANT ALL PRIVILEGES ON FUNCTIONS TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA supabase_functions GRANT ALL PRIVILEGES ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA supabase_functions GRANT ALL PRIVILEGES ON TABLES TO postgres, anon, authenticated, service_role;

RESET ROLE;
SET LOCAL ROLE supabase_admin;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions
  REVOKE ALL PRIVILEGES ON FUNCTIONS FROM PUBLIC, postgres, anon, authenticated, service_role, dashboard_user, authenticator, pgbouncer, supabase_admin, supabase_auth_admin, supabase_functions_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, postgres, anon, authenticated, service_role, dashboard_user, authenticator, pgbouncer, supabase_admin, supabase_auth_admin, supabase_functions_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, postgres, anon, authenticated, service_role, dashboard_user, authenticator, pgbouncer, supabase_admin, supabase_auth_admin, supabase_functions_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL PRIVILEGES ON FUNCTIONS TO postgres WITH GRANT OPTION;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL PRIVILEGES ON SEQUENCES TO postgres WITH GRANT OPTION;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA extensions GRANT ALL PRIVILEGES ON TABLES TO postgres WITH GRANT OPTION;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql
  REVOKE ALL PRIVILEGES ON FUNCTIONS FROM PUBLIC, postgres, anon, authenticated, service_role, dashboard_user, authenticator, pgbouncer, supabase_admin, supabase_auth_admin, supabase_functions_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, postgres, anon, authenticated, service_role, dashboard_user, authenticator, pgbouncer, supabase_admin, supabase_auth_admin, supabase_functions_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, postgres, anon, authenticated, service_role, dashboard_user, authenticator, pgbouncer, supabase_admin, supabase_auth_admin, supabase_functions_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL PRIVILEGES ON FUNCTIONS TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL PRIVILEGES ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql GRANT ALL PRIVILEGES ON TABLES TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public
  REVOKE ALL PRIVILEGES ON FUNCTIONS FROM PUBLIC, postgres, anon, authenticated, service_role, dashboard_user, authenticator, pgbouncer, supabase_admin, supabase_auth_admin, supabase_functions_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, postgres, anon, authenticated, service_role, dashboard_user, authenticator, pgbouncer, supabase_admin, supabase_auth_admin, supabase_functions_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, postgres, anon, authenticated, service_role, dashboard_user, authenticator, pgbouncer, supabase_admin, supabase_auth_admin, supabase_functions_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL PRIVILEGES ON FUNCTIONS TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL PRIVILEGES ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA graphql_public GRANT ALL PRIVILEGES ON TABLES TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE ALL PRIVILEGES ON FUNCTIONS FROM PUBLIC, postgres, anon, authenticated, service_role, dashboard_user, authenticator, pgbouncer, supabase_admin, supabase_auth_admin, supabase_functions_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, postgres, anon, authenticated, service_role, dashboard_user, authenticator, pgbouncer, supabase_admin, supabase_auth_admin, supabase_functions_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, postgres, anon, authenticated, service_role, dashboard_user, authenticator, pgbouncer, supabase_admin, supabase_auth_admin, supabase_functions_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL PRIVILEGES ON FUNCTIONS TO postgres, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO postgres, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime
  REVOKE ALL PRIVILEGES ON FUNCTIONS FROM PUBLIC, postgres, anon, authenticated, service_role, dashboard_user, authenticator, pgbouncer, supabase_admin, supabase_auth_admin, supabase_functions_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, postgres, anon, authenticated, service_role, dashboard_user, authenticator, pgbouncer, supabase_admin, supabase_auth_admin, supabase_functions_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, postgres, anon, authenticated, service_role, dashboard_user, authenticator, pgbouncer, supabase_admin, supabase_auth_admin, supabase_functions_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL PRIVILEGES ON FUNCTIONS TO postgres, dashboard_user;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL PRIVILEGES ON SEQUENCES TO postgres, dashboard_user;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA realtime GRANT ALL PRIVILEGES ON TABLES TO postgres, dashboard_user;

RESET ROLE;
SET LOCAL ROLE supabase_auth_admin;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth
  REVOKE ALL PRIVILEGES ON FUNCTIONS FROM PUBLIC, postgres, anon, authenticated, service_role, dashboard_user, authenticator, pgbouncer, supabase_admin, supabase_auth_admin, supabase_functions_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, postgres, anon, authenticated, service_role, dashboard_user, authenticator, pgbouncer, supabase_admin, supabase_auth_admin, supabase_functions_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, postgres, anon, authenticated, service_role, dashboard_user, authenticator, pgbouncer, supabase_admin, supabase_auth_admin, supabase_functions_admin, supabase_storage_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL PRIVILEGES ON FUNCTIONS TO postgres, dashboard_user;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL PRIVILEGES ON SEQUENCES TO postgres, dashboard_user;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth GRANT ALL PRIVILEGES ON TABLES TO postgres, dashboard_user;

RESET ROLE;

DO $postconditions$
BEGIN
  IF (SELECT count(*) FROM pg_default_acl) <> 27 THEN
    RAISE EXCEPTION 'expected exactly 27 Supabase default ACL entries';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_default_acl AS defaults
      JOIN pg_namespace AS namespace ON namespace.oid = defaults.defaclnamespace
      CROSS JOIN LATERAL aclexplode(defaults.defaclacl) AS privilege
     WHERE defaults.defaclrole IN ('postgres'::regrole, 'supabase_admin'::regrole)
       AND namespace.nspname = 'public'
       AND privilege.grantee IN (0, 'anon'::regrole, 'authenticated'::regrole)
  ) THEN
    RAISE EXCEPTION 'PUBLIC/anon/authenticated must not receive postgres or supabase_admin public defaults';
  END IF;

  IF (SELECT datacl::text FROM pg_database WHERE datname = current_database()) <>
     '{=Tc/postgres,postgres=CTc/postgres,dashboard_user=CTc/postgres}' THEN
    RAISE EXCEPTION 'database ACL does not match the strict production reference';
  END IF;
END
$postconditions$;

COMMIT;

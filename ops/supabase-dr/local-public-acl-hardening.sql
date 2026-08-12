\set ON_ERROR_STOP on

BEGIN;

DO $preflight$
BEGIN
  IF session_user <> 'supabase_admin' OR current_user <> 'supabase_admin' THEN
    RAISE EXCEPTION 'local-public-acl-hardening.sql must start as supabase_admin';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'public') OR
     NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') OR
     NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') OR
     NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') OR
     NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION 'required Supabase roles or public schema are missing';
  END IF;
END
$preflight$;

SET LOCAL ROLE postgres;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON FUNCTIONS FROM PUBLIC, postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL PRIVILEGES ON FUNCTIONS TO postgres, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO postgres, service_role;

RESET ROLE;
SET LOCAL ROLE supabase_admin;

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE ALL PRIVILEGES ON FUNCTIONS FROM PUBLIC, postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  GRANT ALL PRIVILEGES ON FUNCTIONS TO postgres, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO postgres, service_role;

RESET ROLE;

DO $postconditions$
BEGIN
  IF (
    SELECT count(*)
      FROM pg_default_acl AS defaults
      JOIN pg_namespace AS namespace ON namespace.oid = defaults.defaclnamespace
     WHERE defaults.defaclrole IN ('postgres'::regrole, 'supabase_admin'::regrole)
       AND namespace.nspname = 'public'
       AND defaults.defaclobjtype IN ('f', 'S', 'r')
  ) <> 6 THEN
    RAISE EXCEPTION 'expected six public default ACL entries';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_default_acl AS defaults
      JOIN pg_namespace AS namespace ON namespace.oid = defaults.defaclnamespace
      CROSS JOIN LATERAL aclexplode(defaults.defaclacl) AS privilege
     WHERE defaults.defaclrole IN ('postgres'::regrole, 'supabase_admin'::regrole)
       AND namespace.nspname = 'public'
       AND privilege.grantee NOT IN ('postgres'::regrole, 'service_role'::regrole)
  ) THEN
    RAISE EXCEPTION 'public defaults contain an unexpected grantee';
  END IF;
END
$postconditions$;

COMMIT;

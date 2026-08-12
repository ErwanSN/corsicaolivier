-- Users may be provisioned by the identity platform before the planning
-- application schema is deployed. Backfill their application profile without
-- changing an existing account status or role assignments.

insert into public.app_users (id, email, display_name)
select
  auth_user.id,
  auth_user.email,
  coalesce(
    nullif(auth_user.raw_user_meta_data ->> 'full_name', ''),
    nullif(auth_user.raw_user_meta_data ->> 'display_name', ''),
    split_part(coalesce(auth_user.email, auth_user.id::text), '@', 1)
  )
from auth.users auth_user
-- Older self-hosted GoTrue schemas do not expose deleted_at. Reading the row
-- as JSON keeps the backfill compatible while still excluding soft-deleted
-- users when that column exists.
where nullif(to_jsonb(auth_user) ->> 'deleted_at', '') is null
on conflict (id) do update
set email = excluded.email,
    display_name = excluded.display_name,
    updated_at = now();

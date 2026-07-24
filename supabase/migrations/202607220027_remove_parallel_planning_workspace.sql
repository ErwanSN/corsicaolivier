-- Planning workspaces are now created exclusively from port calls.
-- Remove the former manual orchestration command to keep a single source of
-- truth for period, requirement and initial draft creation.

revoke all on function public.start_planning_workspace(
  uuid,
  uuid,
  text,
  date,
  date,
  text
) from authenticated;

-- These commands remain implementation details of the automatic escale
-- pipeline. Authenticated clients must not invoke a second creation path.
revoke execute on function public.create_schedule_version(uuid, text, text)
from authenticated;

revoke execute on function public.generate_staffing_requirements(uuid)
from authenticated;

revoke execute on function public.ensure_planning_workspace_for_port_call(uuid)
from authenticated;

drop function public.start_planning_workspace(
  uuid,
  uuid,
  text,
  date,
  date,
  text
);

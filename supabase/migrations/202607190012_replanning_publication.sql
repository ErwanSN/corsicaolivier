-- Complete the controlled replanning lifecycle only when the candidate is
-- effectively published. Notifications are durable and idempotent so an
-- external dispatcher can safely retry delivery.

create or replace function public.finalize_published_replanning()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  applied_scenario public.replanning_scenarios;
begin
  if new.status <> 'published' or old.status = 'published' then
    return new;
  end if;

  for applied_scenario in
    update public.replanning_scenarios
    set status = 'applied',
        applied_at = now(),
        updated_at = now()
    where candidate_schedule_version_id = new.id
      and status = 'approved'
    returning *
  loop
    insert into public.agent_notifications (
      organization_id,
      site_id,
      agent_id,
      scenario_id,
      channel,
      subject,
      body,
      idempotency_key
    )
    select distinct
      impact.organization_id,
      impact.site_id,
      impact.agent_id,
      applied_scenario.id,
      'in_app',
      'Votre planning a été mis à jour',
      'Une évolution d’escale a modifié votre planning. Consultez la nouvelle version publiée.',
      'replanning-applied-' || applied_scenario.id::text || '-agent-' || impact.agent_id::text
    from public.replanning_impacts impact
    where impact.scenario_id = applied_scenario.id
      and impact.agent_id is not null
    on conflict (organization_id, idempotency_key) do nothing;

    insert into public.outbox_events (
      organization_id,
      site_id,
      topic,
      aggregate_type,
      aggregate_id,
      payload,
      idempotency_key
    ) values (
      applied_scenario.organization_id,
      applied_scenario.site_id,
      'planning.replanning.applied',
      'replanning_scenario',
      applied_scenario.id,
      jsonb_build_object(
        'scenarioId', applied_scenario.id,
        'scheduleVersionId', new.id,
        'appliedAt', now()
      ),
      'replanning-applied-' || applied_scenario.id::text
    )
    on conflict (organization_id, idempotency_key) do nothing;
  end loop;

  return new;
end;
$$;

revoke all on function public.finalize_published_replanning() from public;

create trigger schedule_versions_finalize_replanning
after update of status on public.schedule_versions
for each row
execute function public.finalize_published_replanning();

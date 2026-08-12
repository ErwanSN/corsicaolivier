import type { Agent } from '../lib/api/types';
import type { PlanningEditorTarget } from './planning-assignment-editor';
import type { PlanningData } from './weekly-planning-grid.types';
import { dateKey, localInputValue } from './weekly-planning-grid.utils';

export function assignmentEditorTarget(
  assignmentId: string,
  data: PlanningData,
  timeZone: string,
): PlanningEditorTarget | null {
  const assignment = data.assignmentById.get(assignmentId);
  const shift = assignment
    ? data.shiftById.get(assignment.planning_shift_id)
    : undefined;
  const context = data.assignmentEditContextById.get(assignmentId);

  if (!assignment || !shift || !context) return null;

  const serviceSegments = data.assignments
    .filter((item) => item.planning_shift_id === shift.id)
    .sort((left, right) => left.starts_at.localeCompare(right.starts_at));
  const serviceBreaks = [...(data.breaksByShiftId.get(shift.id) ?? [])].sort(
    (left, right) => left.starts_at.localeCompare(right.starts_at),
  );
  const primarySegment = serviceSegments[0];

  if (!primarySegment) return null;

  return {
    mode: 'update',
    shiftId: shift.id,
    ...context,
    agentId: shift.agent_id,
    positionId: primarySegment.position_id,
    portCallId: primarySegment.port_call_id,
    startsAt: localInputValue(shift.starts_at, timeZone),
    endsAt: localInputValue(shift.ends_at, timeZone),
    breakMinutes: shift.break_minutes,
    breaks: serviceBreaks.map((shiftBreak) => ({
      startsAt: localInputValue(shiftBreak.starts_at, timeZone),
      endsAt: localInputValue(shiftBreak.ends_at, timeZone),
      label: shiftBreak.label ?? '',
    })),
    segments: serviceSegments.map((segment) => ({
      positionId: segment.position_id,
      portCallId: segment.port_call_id,
      staffingRequirementId: segment.staffing_requirement_id,
      startsAt: localInputValue(segment.starts_at, timeZone),
      endsAt: localInputValue(segment.ends_at, timeZone),
    })),
    note: shift.note ?? '',
  };
}

export function createEditorTarget(
  positionId: string,
  workDate: string,
  agents: Agent[],
  data: PlanningData,
  timeZone: string,
): PlanningEditorTarget | null {
  const context = data.draftContexts.find(
    (item) => workDate >= item.startsOn && workDate <= item.endsOn,
  );
  const suggestedRequirement = data.requirements
    .filter(
      (requirement) =>
        requirement.position_id === positionId &&
        dateKey(requirement.starts_at, timeZone) === workDate,
    )
    .sort((left, right) => left.starts_at.localeCompare(right.starts_at))[0];
  const hasActiveAgent = agents.some((agent) => agent.active);

  if (!context || !hasActiveAgent) return null;

  const startsAt = suggestedRequirement
    ? localInputValue(suggestedRequirement.starts_at, timeZone)
    : `${workDate}T08:00`;
  const endsAt = suggestedRequirement
    ? localInputValue(suggestedRequirement.ends_at, timeZone)
    : `${workDate}T15:00`;

  return {
    mode: 'create',
    ...context,
    agentId: '',
    positionId,
    portCallId: suggestedRequirement?.port_call_id ?? null,
    startsAt,
    endsAt,
    breakMinutes: 0,
    breaks: [],
    segments: [
      {
        positionId,
        portCallId: suggestedRequirement?.port_call_id ?? null,
        staffingRequirementId: suggestedRequirement?.id ?? null,
        startsAt,
        endsAt,
      },
    ],
    note: '',
  };
}

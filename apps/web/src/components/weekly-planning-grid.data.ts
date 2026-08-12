import { useMemo } from 'react';

import type {
  Agent,
  PortCall,
  Position,
  ScheduleContent,
  ShiftAssignment,
  StaffingRequirement,
  Vessel,
} from '../lib/api/types';
import type {
  AssignmentMoveContext,
  MoveOverride,
  PlanningData,
} from './weekly-planning-grid.types';
import {
  appendToIndex,
  assignmentsMatchingRequirement,
  cellKey,
  dateKey,
  minimumConcurrentCoverage,
  pendingMoveOverride,
} from './weekly-planning-grid.utils';

export function usePlanningData({
  agents,
  calls,
  contents,
  positions,
  requirements,
  timeZone,
  vessels,
}: Readonly<{
  agents: Agent[];
  calls: PortCall[];
  contents: ScheduleContent[];
  positions: Position[];
  requirements: StaffingRequirement[];
  timeZone: string;
  vessels: Vessel[];
}>): PlanningData {
  return useMemo<PlanningData>(() => {
    const shifts = contents.flatMap((content) => content.shifts);
    const assignments = contents.flatMap((content) => content.assignments);
    const breaks = contents.flatMap((content) => content.breaks);
    const breaksByShiftId = new Map<string, ScheduleContent['breaks']>();
    for (const shiftBreak of breaks) {
      appendToIndex(breaksByShiftId, shiftBreak.planning_shift_id, shiftBreak);
    }
    const assignmentEditContextById = new Map<string, AssignmentMoveContext>();
    const assignmentMoveContextById = new Map<string, AssignmentMoveContext>();
    const draftContexts: PlanningData['draftContexts'] = [];

    for (const content of contents) {
      if (content.version.status !== 'draft') continue;

      draftContexts.push({
        lockVersion: content.version.lock_version,
        organizationId: content.version.organization_id,
        scheduleVersionId: content.version.id,
        siteId: content.version.site_id,
        startsOn: content.period.starts_on,
        endsOn: content.period.ends_on,
      });

      const assignmentCounts = new Map<string, number>();
      for (const assignment of content.assignments) {
        assignmentCounts.set(
          assignment.planning_shift_id,
          (assignmentCounts.get(assignment.planning_shift_id) ?? 0) + 1,
        );
      }

      for (const assignment of content.assignments) {
        const context = {
          lockVersion: content.version.lock_version,
          organizationId: content.version.organization_id,
          scheduleVersionId: content.version.id,
          siteId: content.version.site_id,
        };
        assignmentEditContextById.set(assignment.id, context);
        if (assignmentCounts.get(assignment.planning_shift_id) === 1) {
          assignmentMoveContextById.set(assignment.id, context);
        }
      }
    }

    const activeCalls = calls.filter((call) => call.status !== 'cancelled');
    const activeCallIds = new Set(activeCalls.map((call) => call.id));
    const filteredRequirements = requirements.filter(
      (requirement) =>
        !requirement.port_call_id ||
        activeCallIds.has(requirement.port_call_id),
    );
    const requirementsByCell = new Map<string, StaffingRequirement[]>();
    const arrivalCallsByDay = new Map<string, PortCall[]>();
    const departureCallsByDay = new Map<string, PortCall[]>();

    for (const requirement of filteredRequirements) {
      appendToIndex(
        requirementsByCell,
        cellKey(
          requirement.position_id,
          dateKey(requirement.starts_at, timeZone),
        ),
        requirement,
      );
    }

    for (const call of calls) {
      const arrival = call.estimated_arrival_at ?? call.scheduled_arrival_at;
      const departure =
        call.estimated_departure_at ?? call.scheduled_departure_at;
      if (arrival) {
        appendToIndex(arrivalCallsByDay, dateKey(arrival, timeZone), call);
      }
      if (departure) {
        appendToIndex(departureCallsByDay, dateKey(departure, timeZone), call);
      }
    }

    return {
      agentById: new Map(agents.map((agent) => [agent.id, agent])),
      assignmentById: new Map(
        assignments.map((assignment) => [assignment.id, assignment]),
      ),
      assignmentEditContextById,
      assignmentMoveContextById,
      assignments,
      breaksByShiftId,
      calls,
      draftContexts,
      positions: [...positions].sort((left, right) =>
        left.code.localeCompare(right.code, 'fr'),
      ),
      requirements: filteredRequirements,
      requirementsByCell,
      arrivalCallsByDay,
      departureCallsByDay,
      shiftById: new Map(shifts.map((shift) => [shift.id, shift])),
      timeZone,
      vesselById: new Map(vessels.map((vessel) => [vessel.id, vessel])),
    };
  }, [agents, calls, contents, positions, requirements, timeZone, vessels]);
}

export function useAssignmentsByCell(
  assignments: ShiftAssignment[],
  moveOverrides: Readonly<Record<string, MoveOverride>>,
  timeZone: string,
): Map<string, ShiftAssignment[]> {
  return useMemo(() => {
    const index = new Map<string, ShiftAssignment[]>();

    for (const assignment of assignments) {
      const override = pendingMoveOverride(assignment, moveOverrides, timeZone);
      appendToIndex(
        index,
        cellKey(
          override?.positionId ?? assignment.position_id,
          override?.workDate ?? dateKey(assignment.starts_at, timeZone),
        ),
        assignment,
      );
    }

    return index;
  }, [assignments, moveOverrides, timeZone]);
}

export function useCoverageByRequirementId(
  assignmentsByCell: ReadonlyMap<string, ShiftAssignment[]>,
  data: PlanningData,
  timeZone: string,
): Map<string, number> {
  return useMemo(() => {
    const coverage = new Map<string, number>();

    for (const requirement of data.requirements) {
      const key = cellKey(
        requirement.position_id,
        dateKey(requirement.starts_at, timeZone),
      );
      const assignments = assignmentsByCell.get(key) ?? [];
      coverage.set(
        requirement.id,
        minimumConcurrentCoverage(
          requirement,
          assignmentsMatchingRequirement(requirement, assignments),
          data.breaksByShiftId,
        ),
      );
    }

    return coverage;
  }, [assignmentsByCell, data.breaksByShiftId, data.requirements, timeZone]);
}

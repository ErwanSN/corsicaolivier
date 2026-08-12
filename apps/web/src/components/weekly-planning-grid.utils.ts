import {
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from '@dnd-kit/core';

import type {
  ScheduleContent,
  ShiftAssignment,
  StaffingRequirement,
} from '../lib/api/types';
import { addDays, type WeeklyPlanningRange } from '../lib/planning-range';
import type { CalendarDay, MoveOverride } from './weekly-planning-grid.types';

const dateFormatterByTimeZone = new Map<string, Intl.DateTimeFormat>();
const timeFormatterByTimeZone = new Map<string, Intl.DateTimeFormat>();
const localInputFormatterByTimeZone = new Map<string, Intl.DateTimeFormat>();
const weekdayFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  timeZone: 'UTC',
});
const shortDateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'UTC',
});

function dateFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = dateFormatterByTimeZone.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  });
  dateFormatterByTimeZone.set(timeZone, formatter);
  return formatter;
}

function timeFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = timeFormatterByTimeZone.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  });
  timeFormatterByTimeZone.set(timeZone, formatter);
  return formatter;
}

function localInputFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = localInputFormatterByTimeZone.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  });
  localInputFormatterByTimeZone.set(timeZone, formatter);
  return formatter;
}

export function dateKey(value: string, timeZone: string): string {
  return dateFormatter(timeZone).format(new Date(value));
}

export function timeLabel(value: string | null, timeZone: string): string {
  if (!value) return '—';
  return timeFormatter(timeZone).format(new Date(value));
}

export function normalizedSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR')
    .trim();
}

export function localInputValue(value: string, timeZone: string): string {
  const parts = Object.fromEntries(
    localInputFormatter(timeZone)
      .formatToParts(new Date(value))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function calendarDays(range: WeeklyPlanningRange): CalendarDay[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(range.startsOn, index);
    const instant = new Date(`${date}T12:00:00.000Z`);
    const weekday = instant.getUTCDay();

    return {
      date,
      label: weekdayFormatter.format(instant),
      shortNumber: shortDateFormatter.format(instant),
      weekend: weekday === 0 || weekday === 6,
    };
  });
}

export function cellKey(positionId: string, workDate: string): string {
  return `${positionId}:${workDate}`;
}

export function appendToIndex<T>(
  index: Map<string, T[]>,
  key: string,
  value: T,
) {
  const current = index.get(key);
  if (current) current.push(value);
  else index.set(key, [value]);
}

export const planningCollisionDetection: CollisionDetection = (arguments_) => {
  const pointerCollisions = pointerWithin(arguments_);
  return pointerCollisions.length
    ? pointerCollisions
    : rectIntersection(arguments_);
};

export function pendingMoveOverride(
  assignment: ShiftAssignment,
  overrides: Readonly<Record<string, MoveOverride>>,
  timeZone: string,
): MoveOverride | undefined {
  const override = overrides[assignment.id];

  if (
    override?.positionId === assignment.position_id &&
    override.workDate === dateKey(assignment.starts_at, timeZone)
  ) {
    return undefined;
  }

  return override;
}

export function assignmentsMatchingRequirement(
  requirement: StaffingRequirement,
  assignments: ShiftAssignment[],
): ShiftAssignment[] {
  return assignments.filter(
    (assignment) => assignment.staffing_requirement_id === requirement.id,
  );
}

export function minimumConcurrentCoverage(
  requirement: StaffingRequirement,
  assignments: ScheduleContent['assignments'],
  breaksByShiftId: ReadonlyMap<string, ScheduleContent['breaks']>,
): number {
  const requirementStart = new Date(requirement.starts_at).getTime();
  const requirementEnd = new Date(requirement.ends_at).getTime();
  const events: Array<Readonly<{ delta: number; time: number }>> = [];

  for (const assignment of assignments) {
    const assignmentStart = Math.max(
      requirementStart,
      new Date(assignment.starts_at).getTime(),
    );
    const assignmentEnd = Math.min(
      requirementEnd,
      new Date(assignment.ends_at).getTime(),
    );
    if (assignmentEnd <= assignmentStart) continue;

    const pauses = [
      ...(breaksByShiftId.get(assignment.planning_shift_id) ?? []),
    ]
      .map((shiftBreak) => ({
        start: Math.max(
          assignmentStart,
          new Date(shiftBreak.starts_at).getTime(),
        ),
        end: Math.min(assignmentEnd, new Date(shiftBreak.ends_at).getTime()),
      }))
      .filter((pause) => pause.end > pause.start)
      .sort((left, right) => left.start - right.start);
    let workStart = assignmentStart;
    for (const pause of pauses) {
      if (pause.start > workStart) {
        events.push(
          { delta: 1, time: workStart },
          { delta: -1, time: pause.start },
        );
      }
      workStart = Math.max(workStart, pause.end);
    }
    if (workStart < assignmentEnd) {
      events.push(
        { delta: 1, time: workStart },
        { delta: -1, time: assignmentEnd },
      );
    }
  }

  events.sort((left, right) => left.time - right.time);
  let coverage = 0;
  let cursor = requirementStart;
  let minimum = Number.POSITIVE_INFINITY;

  for (let index = 0; index < events.length;) {
    const time = events[index].time;
    if (time > cursor) minimum = Math.min(minimum, coverage);

    let delta = 0;
    while (index < events.length && events[index].time === time) {
      delta += events[index].delta;
      index += 1;
    }
    coverage += delta;
    cursor = time;
  }

  if (cursor < requirementEnd) minimum = Math.min(minimum, coverage);
  return Number.isFinite(minimum) ? minimum : 0;
}

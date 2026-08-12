import type { PortCall } from '../lib/api/types';
import type {
  EditorBreak,
  EditorSegment,
} from './planning-assignment-editor.types';

const callTimeFormatterByTimeZone = new Map<string, Intl.DateTimeFormat>();

function callTimeFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = callTimeFormatterByTimeZone.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  });
  callTimeFormatterByTimeZone.set(timeZone, formatter);
  return formatter;
}

export function callInstant(call: PortCall): string | null {
  return (
    call.estimated_arrival_at ??
    call.scheduled_arrival_at ??
    call.estimated_departure_at ??
    call.scheduled_departure_at
  );
}

export function callTime(value: string | null, timeZone: string): string {
  if (!value) return 'heure inconnue';
  return callTimeFormatter(timeZone).format(new Date(value));
}

export function availableCalls(
  calls: ReadonlyArray<PortCall>,
  selectedPortCallId: string,
): PortCall[] {
  return [...calls]
    .filter(
      (call) => call.status !== 'cancelled' || call.id === selectedPortCallId,
    )
    .sort((left, right) =>
      (callInstant(left) ?? '').localeCompare(callInstant(right) ?? ''),
    );
}

export function durationLabel(
  startsAt: string,
  endsAt: string,
  breakMinutes: number,
): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const totalMinutes = Math.round((end.getTime() - start.getTime()) / 60_000);

  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return 'Horaires à vérifier';
  }

  const paidMinutes = Math.max(0, totalMinutes - breakMinutes);
  const hours = Math.floor(paidMinutes / 60);
  const minutes = paidMinutes % 60;
  return `${hours} h ${String(minutes).padStart(2, '0')} de travail planifié`;
}

function localInstant(value: string): number {
  return new Date(value).getTime();
}

function localInputFromInstant(value: number): string {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(value - offset).toISOString().slice(0, 16);
}

function midpointLocal(startsAt: string, endsAt: string): string {
  const start = localInstant(startsAt);
  const end = localInstant(endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return startsAt;
  }
  return localInputFromInstant(start + (end - start) / 2);
}

export function totalBreakMinutes(
  shiftBreaks: ReadonlyArray<EditorBreak>,
): number {
  return shiftBreaks.reduce((total, shiftBreak) => {
    const duration =
      (localInstant(shiftBreak.endsAt) - localInstant(shiftBreak.startsAt)) /
      60_000;
    return total + (Number.isFinite(duration) && duration > 0 ? duration : 0);
  }, 0);
}

export function appendPositionChange(
  segments: EditorSegment[],
): EditorSegment[] {
  const last = segments.at(-1);
  if (!last || segments.length >= 20) return segments;

  const boundary = midpointLocal(last.startsAt, last.endsAt);
  if (boundary <= last.startsAt || boundary >= last.endsAt) {
    return segments;
  }

  return [
    ...segments.slice(0, -1),
    { ...last, endsAt: boundary },
    { ...last, staffingRequirementId: null, startsAt: boundary },
  ];
}

export function updatePositionChange(
  segments: EditorSegment[],
  index: number,
  update: Partial<
    Pick<EditorSegment, 'startsAt' | 'positionId' | 'portCallId'>
  >,
): EditorSegment[] {
  if (index <= 0 || index >= segments.length) return segments;

  const next = segments.map((segment) => ({ ...segment }));
  const segment = next[index];
  const previous = next[index - 1];
  if (!segment || !previous) return segments;

  if (update.startsAt !== undefined) {
    previous.endsAt = update.startsAt;
    previous.staffingRequirementId = null;
    segment.startsAt = update.startsAt;
    segment.staffingRequirementId = null;
  }
  if (update.positionId !== undefined) {
    segment.positionId = update.positionId;
    segment.staffingRequirementId = null;
  }
  if (update.portCallId !== undefined) {
    segment.portCallId = update.portCallId;
    segment.staffingRequirementId = null;
  }

  return next;
}

export function removePositionChange(
  segments: EditorSegment[],
  index: number,
): EditorSegment[] {
  if (index <= 0 || index >= segments.length) return segments;

  const next = segments.map((segment) => ({ ...segment }));
  const previous = next[index - 1];
  const removed = next[index];
  if (!previous || !removed) return segments;

  previous.endsAt = removed.endsAt;
  next.splice(index, 1);
  return next;
}

export function appendExactBreak(
  shiftBreaks: EditorBreak[],
  startsAt: string,
  endsAt: string,
  breakMinutes: number,
): EditorBreak[] {
  if (shiftBreaks.length >= 10) return shiftBreaks;

  const serviceStart = localInstant(startsAt);
  const serviceEnd = localInstant(endsAt);
  if (
    !Number.isFinite(serviceStart) ||
    !Number.isFinite(serviceEnd) ||
    serviceEnd <= serviceStart
  ) {
    return shiftBreaks;
  }

  const occupied = shiftBreaks
    .map((shiftBreak) => ({
      start: localInstant(shiftBreak.startsAt),
      end: localInstant(shiftBreak.endsAt),
    }))
    .filter(
      (interval) =>
        Number.isFinite(interval.start) &&
        Number.isFinite(interval.end) &&
        interval.end > interval.start,
    )
    .sort((left, right) => left.start - right.start);
  const gaps: Array<{ start: number; end: number }> = [];
  let cursor = serviceStart;
  for (const interval of occupied) {
    if (interval.start > cursor)
      gaps.push({ start: cursor, end: interval.start });
    cursor = Math.max(cursor, interval.end);
  }
  if (cursor < serviceEnd) gaps.push({ start: cursor, end: serviceEnd });

  const gap = gaps.sort(
    (left, right) => right.end - right.start - (left.end - left.start),
  )[0];
  if (!gap || gap.end - gap.start < 5 * 60_000) return shiftBreaks;

  const requestedMinutes = shiftBreaks.length
    ? 15
    : breakMinutes > 0
      ? breakMinutes
      : 15;
  const durationMinutes = Math.min(
    requestedMinutes,
    Math.floor((gap.end - gap.start) / 60_000),
  );
  const paddingMinutes = Math.floor(
    ((gap.end - gap.start) / 60_000 - durationMinutes) / 2,
  );
  const breakStartInstant = gap.start + paddingMinutes * 60_000;

  return [
    ...shiftBreaks,
    {
      startsAt: localInputFromInstant(breakStartInstant),
      endsAt: localInputFromInstant(
        breakStartInstant + durationMinutes * 60_000,
      ),
      label: '',
    },
  ];
}

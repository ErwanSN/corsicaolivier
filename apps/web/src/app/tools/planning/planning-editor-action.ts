'use server';

import { revalidatePath } from 'next/cache';

import { apiFetch } from '../../../lib/api/server';
import { scopedHeaders } from '../../../lib/api/scoped-headers';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type PlanningAssignmentMutationResult =
  | Readonly<{ ok: true; message: string }>
  | Readonly<{ ok: false; error: string }>;

export type SavePlanningAssignmentInput = Readonly<{
  mode: 'create' | 'update';
  assignmentId?: string;
  organizationId: string;
  siteId: string;
  scheduleVersionId: string;
  agentId: string;
  positionId: string;
  portCallId: string | null;
  startsAt: string;
  endsAt: string;
  breakMinutes: number;
  note: string;
  timeZone: string;
}>;

export type DeletePlanningAssignmentInput = Readonly<{
  assignmentId: string;
  organizationId: string;
  siteId: string;
  scheduleVersionId: string;
}>;

export type MovePlanningAssignmentResult =
  Readonly<{ ok: true }> | Readonly<{ ok: false; error: string }>;

function zonedLocalToIso(value: string, timeZone: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    value,
  );

  if (!match) return null;

  const [, year, month, day, hour, minute, second = '0'] = match;
  const localAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    const partsAt = (instant: number) =>
      Object.fromEntries(
        formatter
          .formatToParts(new Date(instant))
          .filter((part) => part.type !== 'literal')
          .map((part) => [part.type, Number(part.value)]),
      );
    const offsetAt = (instant: number) => {
      const parts = partsAt(instant);
      return (
        Date.UTC(
          parts.year,
          parts.month - 1,
          parts.day,
          parts.hour,
          parts.minute,
          parts.second,
        ) - instant
      );
    };
    const firstPass = localAsUtc - offsetAt(localAsUtc);
    const instant = localAsUtc - offsetAt(firstPass);
    const resolved = partsAt(instant);

    if (
      Date.UTC(
        resolved.year,
        resolved.month - 1,
        resolved.day,
        resolved.hour,
        resolved.minute,
        resolved.second,
      ) !== localAsUtc
    ) {
      return null;
    }

    return new Date(instant).toISOString();
  } catch {
    return null;
  }
}

function validateSaveInput(
  input: SavePlanningAssignmentInput,
): Readonly<{ startsAtIso: string; endsAtIso: string }> | null {
  const requiredIds = [
    input.organizationId,
    input.siteId,
    input.scheduleVersionId,
    input.agentId,
    input.positionId,
  ];
  const startsAtIso = zonedLocalToIso(input.startsAt, input.timeZone);
  const endsAtIso = zonedLocalToIso(input.endsAt, input.timeZone);

  if (
    !requiredIds.every((value) => UUID_PATTERN.test(value)) ||
    (input.mode === 'update' &&
      (!input.assignmentId || !UUID_PATTERN.test(input.assignmentId))) ||
    (input.portCallId !== null && !UUID_PATTERN.test(input.portCallId)) ||
    !startsAtIso ||
    !endsAtIso ||
    new Date(endsAtIso) <= new Date(startsAtIso) ||
    !Number.isInteger(input.breakMinutes) ||
    input.breakMinutes < 0 ||
    input.breakMinutes > 720 ||
    input.note.length > 500
  ) {
    return null;
  }

  const durationMinutes =
    (new Date(endsAtIso).getTime() - new Date(startsAtIso).getTime()) / 60_000;

  if (input.breakMinutes >= durationMinutes) return null;
  return { startsAtIso, endsAtIso };
}

export async function savePlanningAssignment(
  input: SavePlanningAssignmentInput,
): Promise<PlanningAssignmentMutationResult> {
  const instants = validateSaveInput(input);

  if (!instants) {
    return {
      ok: false,
      error: 'Vérifiez l’agent, le poste, les horaires et la durée de pause.',
    };
  }

  const endpoint =
    input.mode === 'create'
      ? `/schedule-versions/${input.scheduleVersionId}/shifts`
      : `/schedule-versions/${input.scheduleVersionId}/assignments/${input.assignmentId}/details`;
  const result = await apiFetch(endpoint, {
    method: input.mode === 'create' ? 'POST' : 'PATCH',
    headers: scopedHeaders(input.organizationId, input.siteId),
    body: JSON.stringify({
      agentId: input.agentId,
      positionId: input.positionId,
      portCallId: input.portCallId,
      startsAt: instants.startsAtIso,
      endsAt: instants.endsAtIso,
      breakMinutes: input.breakMinutes,
      note: input.note.trim() || null,
    }),
  });

  if (result.error) return { ok: false, error: result.error };

  revalidatePath('/tools/planning');
  return {
    ok: true,
    message:
      input.mode === 'create'
        ? 'Affectation ajoutée au planning.'
        : 'Affectation mise à jour.',
  };
}

export async function deletePlanningAssignment(
  input: DeletePlanningAssignmentInput,
): Promise<PlanningAssignmentMutationResult> {
  if (
    ![
      input.assignmentId,
      input.organizationId,
      input.siteId,
      input.scheduleVersionId,
    ].every((value) => UUID_PATTERN.test(value))
  ) {
    return { ok: false, error: 'Affectation incorrecte.' };
  }

  const result = await apiFetch(
    `/schedule-versions/${input.scheduleVersionId}/assignments/${input.assignmentId}`,
    {
      method: 'DELETE',
      headers: scopedHeaders(input.organizationId, input.siteId),
    },
  );

  if (result.error) return { ok: false, error: result.error };

  revalidatePath('/tools/planning');
  return { ok: true, message: 'Affectation supprimée.' };
}

export async function movePlanningAssignment(input: {
  assignmentId: string;
  organizationId: string;
  positionId: string;
  scheduleVersionId: string;
  siteId: string;
  workDate: string;
}): Promise<MovePlanningAssignmentResult> {
  if (
    ![
      input.assignmentId,
      input.organizationId,
      input.positionId,
      input.scheduleVersionId,
      input.siteId,
    ].every((value) => UUID_PATTERN.test(value)) ||
    !DATE_PATTERN.test(input.workDate)
  ) {
    return { ok: false, error: 'Destination incorrecte.' };
  }

  const result = await apiFetch(
    `/schedule-versions/${input.scheduleVersionId}/assignments/${input.assignmentId}`,
    {
      method: 'PATCH',
      headers: scopedHeaders(input.organizationId, input.siteId),
      body: JSON.stringify({
        positionId: input.positionId,
        workDate: input.workDate,
      }),
    },
  );

  if (result.error) return { ok: false, error: result.error };

  revalidatePath('/tools/planning');
  return { ok: true };
}

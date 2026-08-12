'use server';

import { revalidatePath } from 'next/cache';

import { apiFetch } from '../../../lib/api/server';
import { scopedHeaders } from '../../../lib/api/scoped-headers';
import { zonedLocalToIso } from '../../../lib/dates';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type PlanningAssignmentMutationResult =
  | Readonly<{ ok: true; message: string }>
  | Readonly<{ ok: false; error: string }>;

export type SavePlanningAssignmentInput = Readonly<{
  mode: 'create' | 'update';
  shiftId?: string;
  organizationId: string;
  siteId: string;
  scheduleVersionId: string;
  lockVersion: number;
  agentId: string;
  positionId: string;
  portCallId: string | null;
  startsAt: string;
  endsAt: string;
  breakMinutes: number;
  breaks: ReadonlyArray<
    Readonly<{ startsAt: string; endsAt: string; label: string }>
  >;
  segments: ReadonlyArray<
    Readonly<{
      positionId: string;
      portCallId: string | null;
      staffingRequirementId: string | null;
      startsAt: string;
      endsAt: string;
    }>
  >;
  changeReason: string;
  note: string;
  timeZone: string;
}>;

export type DeletePlanningAssignmentInput = Readonly<{
  shiftId: string;
  organizationId: string;
  siteId: string;
  scheduleVersionId: string;
  lockVersion: number;
}>;

export type MovePlanningAssignmentResult =
  Readonly<{ ok: true }> | Readonly<{ ok: false; error: string }>;

export type PlanningCandidateRecommendation = Readonly<{
  id: string;
  employeeNumber: string;
  displayName: string;
  rank: number;
  preferenceLevel: 'preferred' | 'neutral' | 'avoid';
  weeklyTargetMinutes: number;
  scheduledWeekMinutes: number;
  projectedWeekMinutes: number;
  weeklyDeficitMinutes: number;
  recentLoadMinutes: number;
  explanation: string;
}>;

export type FindPlanningCandidateRecommendationsResult =
  | Readonly<{
      ok: true;
      candidates: PlanningCandidateRecommendation[];
      total: number;
    }>
  | Readonly<{ ok: false; error: string }>;

export type FindPlanningCandidateRecommendationsInput = Readonly<{
  organizationId: string;
  siteId: string;
  scheduleVersionId: string;
  shiftId?: string;
  startsAt: string;
  endsAt: string;
  breakMinutes: number;
  breaks: ReadonlyArray<
    Readonly<{ startsAt: string; endsAt: string; label: string }>
  >;
  segments: ReadonlyArray<
    Readonly<{
      positionId: string;
      startsAt: string;
      endsAt: string;
    }>
  >;
  query: string;
  timeZone: string;
}>;

type CandidateApiPage = Readonly<{
  items: ReadonlyArray<{
    agent_id: string;
    employee_number: string;
    display_name: string;
    recommendation_rank: number;
    preference_level: string;
    weekly_target_minutes: number;
    scheduled_week_minutes: number;
    projected_week_minutes: number;
    weekly_deficit_minutes: number;
    recent_load_minutes: number;
    explanation: string;
  }>;
  total: number;
}>;

type TimelineSegment = Readonly<{
  positionId: string;
  startsAt: string;
  endsAt: string;
}>;

type TimelineInput<Segment extends TimelineSegment> = Readonly<{
  startsAt: string;
  endsAt: string;
  breakMinutes: number;
  breaks: ReadonlyArray<
    Readonly<{ startsAt: string; endsAt: string; label: string }>
  >;
  segments: ReadonlyArray<Segment>;
  timeZone: string;
}>;

type ConvertedTimeline<Segment extends TimelineSegment> = Readonly<{
  startsAtIso: string;
  endsAtIso: string;
  segments: Array<
    Omit<Segment, 'startsAt' | 'endsAt'> & {
      startsAt: string;
      endsAt: string;
    }
  >;
  breaks: Array<{
    startsAt: string;
    endsAt: string;
    label: string | null;
  }>;
}>;

function convertServiceTimeline<Segment extends TimelineSegment>(
  input: TimelineInput<Segment>,
): ConvertedTimeline<Segment> | null {
  const startsAtIso = zonedLocalToIso(input.startsAt, input.timeZone);
  const endsAtIso = zonedLocalToIso(input.endsAt, input.timeZone);

  if (
    !startsAtIso ||
    !endsAtIso ||
    new Date(endsAtIso) <= new Date(startsAtIso) ||
    !Number.isInteger(input.breakMinutes) ||
    input.breakMinutes < 0 ||
    input.breakMinutes > 720 ||
    input.segments.length < 1 ||
    input.segments.length > 20 ||
    input.breaks.length > 10
  ) {
    return null;
  }

  const durationMinutes =
    (new Date(endsAtIso).getTime() - new Date(startsAtIso).getTime()) / 60_000;

  if (input.breakMinutes >= durationMinutes) return null;

  const convertedSegments = input.segments.map((segment) => ({
    ...segment,
    startsAt: zonedLocalToIso(segment.startsAt, input.timeZone),
    endsAt: zonedLocalToIso(segment.endsAt, input.timeZone),
  }));

  if (
    convertedSegments.some(
      (segment) =>
        !UUID_PATTERN.test(segment.positionId) ||
        !segment.startsAt ||
        !segment.endsAt ||
        segment.startsAt >= segment.endsAt,
    ) ||
    convertedSegments[0]?.startsAt !== startsAtIso ||
    convertedSegments.at(-1)?.endsAt !== endsAtIso ||
    convertedSegments.some(
      (segment, index) =>
        index > 0 && convertedSegments[index - 1]?.endsAt !== segment.startsAt,
    )
  ) {
    return null;
  }

  const convertedBreaks = input.breaks
    .map((shiftBreak) => ({
      startsAt: zonedLocalToIso(shiftBreak.startsAt, input.timeZone),
      endsAt: zonedLocalToIso(shiftBreak.endsAt, input.timeZone),
      label: shiftBreak.label.trim() || null,
    }))
    .sort((left, right) =>
      (left.startsAt ?? '').localeCompare(right.startsAt ?? ''),
    );

  if (
    convertedBreaks.some(
      (shiftBreak, index) =>
        !shiftBreak.startsAt ||
        !shiftBreak.endsAt ||
        shiftBreak.startsAt < startsAtIso ||
        shiftBreak.endsAt > endsAtIso ||
        shiftBreak.startsAt >= shiftBreak.endsAt ||
        (shiftBreak.label?.length ?? 0) > 120 ||
        (index > 0 &&
          (convertedBreaks[index - 1]?.endsAt ?? '') > shiftBreak.startsAt),
    )
  ) {
    return null;
  }

  const breaks = convertedBreaks.length
    ? convertedBreaks
    : input.breakMinutes > 0
      ? [
          {
            startsAt: new Date(
              new Date(startsAtIso).getTime() +
                (durationMinutes - input.breakMinutes) * 30_000,
            ).toISOString(),
            endsAt: new Date(
              new Date(startsAtIso).getTime() +
                (durationMinutes + input.breakMinutes) * 30_000,
            ).toISOString(),
            label: null,
          },
        ]
      : [];

  return {
    startsAtIso,
    endsAtIso,
    segments: convertedSegments.map((segment) => ({
      ...segment,
      startsAt: segment.startsAt!,
      endsAt: segment.endsAt!,
    })),
    breaks: breaks.map((shiftBreak) => ({
      ...shiftBreak,
      startsAt: shiftBreak.startsAt!,
      endsAt: shiftBreak.endsAt!,
    })),
  };
}

function validateSaveInput(input: SavePlanningAssignmentInput): Readonly<{
  startsAtIso: string;
  endsAtIso: string;
  segments: Array<{
    positionId: string;
    portCallId: string | null;
    staffingRequirementId: string | null;
    startsAt: string;
    endsAt: string;
  }>;
  breaks: Array<{
    startsAt: string;
    endsAt: string;
    label: string | null;
  }>;
}> | null {
  const requiredIds = [
    input.organizationId,
    input.siteId,
    input.scheduleVersionId,
    input.agentId,
    input.positionId,
  ];

  if (
    !requiredIds.every((value) => UUID_PATTERN.test(value)) ||
    (input.mode === 'update' &&
      (!input.shiftId || !UUID_PATTERN.test(input.shiftId))) ||
    (input.portCallId !== null && !UUID_PATTERN.test(input.portCallId)) ||
    !Number.isSafeInteger(input.lockVersion) ||
    input.lockVersion < 0 ||
    (input.changeReason.trim().length > 0 &&
      input.changeReason.trim().length < 3) ||
    input.changeReason.length > 200 ||
    input.note.length > 500 ||
    input.segments.some(
      (segment) =>
        (segment.portCallId !== null &&
          !UUID_PATTERN.test(segment.portCallId)) ||
        (segment.staffingRequirementId !== null &&
          !UUID_PATTERN.test(segment.staffingRequirementId)),
    )
  ) {
    return null;
  }

  return convertServiceTimeline(input);
}

export async function findPlanningCandidateRecommendations(
  input: FindPlanningCandidateRecommendationsInput,
): Promise<FindPlanningCandidateRecommendationsResult> {
  const query = input.query.trim();

  if (
    ![input.organizationId, input.siteId, input.scheduleVersionId].every(
      (value) => UUID_PATTERN.test(value),
    ) ||
    (input.shiftId !== undefined && !UUID_PATTERN.test(input.shiftId)) ||
    (query.length > 0 && query.length < 2) ||
    query.length > 80
  ) {
    return { ok: false, error: 'Contexte de recommandation incorrect.' };
  }

  const timeline = convertServiceTimeline(input);
  if (!timeline) {
    return {
      ok: false,
      error: 'Vérifiez les postes, les horaires et les pauses du service.',
    };
  }

  const result = await apiFetch<CandidateApiPage>(
    `/schedule-versions/${input.scheduleVersionId}/agent-candidates/query`,
    {
      method: 'POST',
      headers: scopedHeaders(input.organizationId, input.siteId),
      body: JSON.stringify({
        startsAt: timeline.startsAtIso,
        endsAt: timeline.endsAtIso,
        segments: timeline.segments.map((segment) => ({
          positionId: segment.positionId,
          startsAt: segment.startsAt,
          endsAt: segment.endsAt,
        })),
        breaks: timeline.breaks.map((shiftBreak) => ({
          startsAt: shiftBreak.startsAt,
          endsAt: shiftBreak.endsAt,
        })),
        excludedShiftId: input.shiftId,
        q: query || undefined,
        limit: 20,
        offset: 0,
      }),
    },
  );

  if (!result.data) {
    return {
      ok: false,
      error:
        result.error ?? 'Les recommandations sont momentanément indisponibles.',
    };
  }

  return {
    ok: true,
    total: result.data.total,
    candidates: result.data.items.map((candidate) => ({
      id: candidate.agent_id,
      employeeNumber: candidate.employee_number,
      displayName: candidate.display_name,
      rank: candidate.recommendation_rank,
      preferenceLevel:
        candidate.preference_level === 'preferred' ||
        candidate.preference_level === 'avoid'
          ? candidate.preference_level
          : 'neutral',
      weeklyTargetMinutes: candidate.weekly_target_minutes,
      scheduledWeekMinutes: candidate.scheduled_week_minutes,
      projectedWeekMinutes: candidate.projected_week_minutes,
      weeklyDeficitMinutes: candidate.weekly_deficit_minutes,
      recentLoadMinutes: candidate.recent_load_minutes,
      explanation: candidate.explanation,
    })),
  };
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
      ? `/schedule-versions/${input.scheduleVersionId}/services`
      : `/schedule-versions/${input.scheduleVersionId}/shifts/${input.shiftId}`;
  const trimmedReason = input.changeReason.trim();
  const trimmedNote = input.note.trim();
  const note = trimmedReason
    ? `Dernière minute — ${trimmedReason}${trimmedNote ? `\n${trimmedNote}` : ''}`
    : trimmedNote;

  if (note.length > 500) {
    return {
      ok: false,
      error: 'Le motif et la note sont limités à 500 caractères au total.',
    };
  }

  const result = await apiFetch(endpoint, {
    method: input.mode === 'create' ? 'POST' : 'PATCH',
    headers: scopedHeaders(input.organizationId, input.siteId),
    body: JSON.stringify({
      agentId: input.agentId,
      lockVersion: input.lockVersion,
      startsAt: instants.startsAtIso,
      endsAt: instants.endsAtIso,
      segments: instants.segments,
      breaks: instants.breaks,
      note: note || null,
    }),
  });

  if (result.error) return { ok: false, error: result.error };

  revalidatePath('/tools/planning');
  return {
    ok: true,
    message:
      input.mode === 'create'
        ? trimmedReason
          ? 'Affectation urgente ajoutée au planning.'
          : 'Affectation ajoutée au planning.'
        : trimmedReason
          ? 'Modification de dernière minute enregistrée.'
          : 'Affectation mise à jour.',
  };
}

export async function deletePlanningAssignment(
  input: DeletePlanningAssignmentInput,
): Promise<PlanningAssignmentMutationResult> {
  if (
    ![
      input.shiftId,
      input.organizationId,
      input.siteId,
      input.scheduleVersionId,
    ].every((value) => UUID_PATTERN.test(value)) ||
    !Number.isSafeInteger(input.lockVersion) ||
    input.lockVersion < 0
  ) {
    return { ok: false, error: 'Affectation incorrecte.' };
  }

  const result = await apiFetch(
    `/schedule-versions/${input.scheduleVersionId}/shifts/${input.shiftId}`,
    {
      method: 'DELETE',
      headers: scopedHeaders(input.organizationId, input.siteId),
      body: JSON.stringify({ lockVersion: input.lockVersion }),
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
  lockVersion: number;
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
    !Number.isSafeInteger(input.lockVersion) ||
    input.lockVersion < 0 ||
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
        lockVersion: input.lockVersion,
        positionId: input.positionId,
        workDate: input.workDate,
      }),
    },
  );

  if (result.error) return { ok: false, error: result.error };

  revalidatePath('/tools/planning');
  return { ok: true };
}

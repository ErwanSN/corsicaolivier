'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { apiFetch } from '../../../lib/api/server';
import { scopedHeaders } from '../../../lib/api/scoped-headers';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function stringValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

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

export async function createAgent(formData: FormData): Promise<void> {
  const organizationId = stringValue(formData, 'organizationId');
  const primarySiteId = stringValue(formData, 'primarySiteId');
  const employeeNumber = stringValue(formData, 'employeeNumber');
  const displayName = stringValue(formData, 'displayName');
  const hiredOn = stringValue(formData, 'hiredOn');

  if (
    !UUID_PATTERN.test(organizationId) ||
    !UUID_PATTERN.test(primarySiteId) ||
    !displayName
  ) {
    redirect(
      `/tools/planning/agents?site=${primarySiteId}&add=1&error=invalid`,
    );
  }

  const result = await apiFetch('/agents', {
    method: 'POST',
    headers: scopedHeaders(organizationId, primarySiteId),
    body: JSON.stringify({
      organizationId,
      primarySiteId,
      displayName,
      ...(employeeNumber ? { employeeNumber } : {}),
      ...(hiredOn ? { hiredOn } : {}),
    }),
  });

  if (result.error) {
    redirect(`/tools/planning/agents?site=${primarySiteId}&add=1&error=save`);
  }

  revalidatePath('/tools/planning/agents');
  redirect(`/tools/planning/agents?site=${primarySiteId}&saved=created`);
}

export async function updateAgent(formData: FormData): Promise<void> {
  const agentId = stringValue(formData, 'agentId');
  const organizationId = stringValue(formData, 'organizationId');
  const primarySiteId = stringValue(formData, 'primarySiteId');
  const employeeNumber = stringValue(formData, 'employeeNumber');
  const displayName = stringValue(formData, 'displayName');
  const hiredOn = stringValue(formData, 'hiredOn');
  const leftOn = stringValue(formData, 'leftOn');
  const active = stringValue(formData, 'active') === 'on';
  const path = `/tools/planning/agents?site=${primarySiteId}`;

  if (
    ![agentId, organizationId, primarySiteId].every((value) =>
      UUID_PATTERN.test(value),
    ) ||
    !employeeNumber ||
    !displayName
  ) {
    redirect(`${path}&edit=${agentId}&error=invalid`);
  }

  const result = await apiFetch(`/agents/${agentId}`, {
    method: 'PATCH',
    headers: scopedHeaders(organizationId, primarySiteId),
    body: JSON.stringify({
      organizationId,
      primarySiteId,
      employeeNumber,
      displayName,
      active,
      hiredOn: hiredOn || null,
      leftOn: leftOn || null,
    }),
  });

  if (result.error) {
    redirect(`${path}&edit=${agentId}&error=save`);
  }

  revalidatePath('/tools/planning/agents');
  revalidatePath(`/tools/planning/agents/${agentId}`);
  redirect(`${path}&saved=updated`);
}

export async function createZone(formData: FormData): Promise<void> {
  const organizationId = stringValue(formData, 'organizationId');
  const name = stringValue(formData, 'name');
  const path = '/tools/planning/zones';

  if (!UUID_PATTERN.test(organizationId) || name.length < 2) {
    redirect(`${path}?add=1&error=invalid`);
  }

  const result = await apiFetch<{ id: string }>('/sites', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-organization-id': organizationId,
    },
    body: JSON.stringify({ organizationId, name }),
  });

  if (result.error || !result.data || !UUID_PATTERN.test(result.data.id)) {
    redirect(`${path}?add=1&error=zone`);
  }

  revalidatePath('/tools/planning');
  revalidatePath('/tools/planning/agents');
  revalidatePath('/tools/planning/groupes');
  revalidatePath(path);
  redirect(`${path}?saved=zone`);
}

export async function createPosition(formData: FormData): Promise<void> {
  const organizationId = stringValue(formData, 'organizationId');
  const siteId = stringValue(formData, 'siteId');
  const code = stringValue(formData, 'code').toUpperCase();
  const name = stringValue(formData, 'name');
  const description = stringValue(formData, 'description');
  const path = `/tools/planning/referentiels?site=${siteId}`;

  if (
    !UUID_PATTERN.test(organizationId) ||
    !UUID_PATTERN.test(siteId) ||
    !code ||
    !name
  ) {
    redirect(`${path}&error=invalid`);
  }

  const result = await apiFetch('/positions', {
    method: 'POST',
    headers: scopedHeaders(organizationId, siteId),
    body: JSON.stringify({
      organizationId,
      siteId,
      code,
      name,
      ...(description ? { description } : {}),
    }),
  });

  if (result.error) {
    redirect(`${path}&error=save`);
  }

  revalidatePath('/tools/planning/referentiels');
  redirect(`${path}&saved=1`);
}

export async function createGroup(formData: FormData): Promise<void> {
  const organizationId = stringValue(formData, 'organizationId');
  const name = stringValue(formData, 'name');
  const description = stringValue(formData, 'description');

  if (!UUID_PATTERN.test(organizationId) || !name) {
    redirect('/tools/planning/groupes?error=invalid');
  }

  const result = await apiFetch('/groups', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-organization-id': organizationId,
    },
    body: JSON.stringify({
      organizationId,
      name,
      description: description || undefined,
    }),
  });

  if (result.error) redirect('/tools/planning/groupes?error=save');
  revalidatePath('/tools/planning/groupes');
  redirect('/tools/planning/groupes?saved=group');
}

export async function addGroupMember(formData: FormData): Promise<void> {
  const organizationId = stringValue(formData, 'organizationId');
  const groupId = stringValue(formData, 'groupId');
  const agentId = stringValue(formData, 'agentId');
  const effectiveFrom = stringValue(formData, 'effectiveFrom');
  const isPrimary = stringValue(formData, 'isPrimary') === 'on';

  if (
    ![organizationId, groupId, agentId].every((value) =>
      UUID_PATTERN.test(value),
    ) ||
    !effectiveFrom
  ) {
    redirect(`/tools/planning/groupes?group=${groupId}&error=invalid`);
  }

  const result = await apiFetch(`/groups/${groupId}/members`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-organization-id': organizationId,
    },
    body: JSON.stringify({ organizationId, agentId, effectiveFrom, isPrimary }),
  });

  if (result.error) {
    redirect(`/tools/planning/groupes?group=${groupId}&error=member`);
  }
  revalidatePath('/tools/planning/groupes');
  redirect(`/tools/planning/groupes?group=${groupId}&saved=member`);
}

export async function endGroupMembership(formData: FormData): Promise<void> {
  const organizationId = stringValue(formData, 'organizationId');
  const groupId = stringValue(formData, 'groupId');
  const membershipId = stringValue(formData, 'membershipId');
  const effectiveUntil = stringValue(formData, 'effectiveUntil');
  const path = `/tools/planning/groupes?group=${groupId}`;

  if (
    ![organizationId, groupId, membershipId].every((value) =>
      UUID_PATTERN.test(value),
    ) ||
    !effectiveUntil
  ) {
    redirect(`${path}&error=invalid`);
  }

  const result = await apiFetch(`/groups/${groupId}/members/${membershipId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-organization-id': organizationId,
    },
    body: JSON.stringify({ organizationId, effectiveUntil }),
  });

  if (result.error) redirect(`${path}&error=member`);
  revalidatePath('/tools/planning/groupes');
  redirect(`${path}&saved=member`);
}

export async function setGroupHourTargets(formData: FormData): Promise<void> {
  const organizationId = stringValue(formData, 'organizationId');
  const groupId = stringValue(formData, 'groupId');
  const weeklyHoursValue = stringValue(formData, 'weeklyHours');
  const monthlyHoursValue = stringValue(formData, 'monthlyHours');
  const weeklyHours = weeklyHoursValue ? Number(weeklyHoursValue) : null;
  const monthlyHours = monthlyHoursValue ? Number(monthlyHoursValue) : null;
  const path = `/tools/planning/groupes?group=${groupId}`;

  if (
    !UUID_PATTERN.test(organizationId) ||
    !UUID_PATTERN.test(groupId) ||
    (weeklyHours !== null &&
      (!Number.isFinite(weeklyHours) ||
        weeklyHours < 0 ||
        weeklyHours > 168)) ||
    (monthlyHours !== null &&
      (!Number.isFinite(monthlyHours) ||
        monthlyHours < 0 ||
        monthlyHours > 744))
  ) {
    redirect(`${path}&error=invalid`);
  }

  const result = await apiFetch(`/groups/${groupId}/hour-targets`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-organization-id': organizationId,
    },
    body: JSON.stringify({
      organizationId,
      weeklyTargetMinutes:
        weeklyHours === null ? null : Math.round(weeklyHours * 60),
      monthlyTargetMinutes:
        monthlyHours === null ? null : Math.round(monthlyHours * 60),
    }),
  });

  if (result.error) redirect(`${path}&error=save`);
  revalidatePath('/tools/planning/groupes');
  redirect(`${path}&saved=hours`);
}

export async function setHourTarget(formData: FormData): Promise<void> {
  const organizationId = stringValue(formData, 'organizationId');
  const siteId = stringValue(formData, 'siteId');
  const groupId = stringValue(formData, 'groupId');
  const agentId = stringValue(formData, 'agentId');
  const weekStart = stringValue(formData, 'weekStart');
  const targetHours = Number(stringValue(formData, 'targetHours'));
  const reason = stringValue(formData, 'reason');
  const returnTo = agentId
    ? `/tools/planning/agents/${agentId}`
    : `/tools/planning/groupes?group=${groupId}`;

  if (
    !UUID_PATTERN.test(organizationId) ||
    (Boolean(agentId) && !UUID_PATTERN.test(siteId)) ||
    !(UUID_PATTERN.test(groupId) || UUID_PATTERN.test(agentId)) ||
    !weekStart ||
    !Number.isFinite(targetHours) ||
    targetHours < 0 ||
    !reason
  ) {
    redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=invalid`);
  }

  const result = await apiFetch('/hour-targets', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-organization-id': organizationId,
      ...(siteId ? { 'x-site-id': siteId } : {}),
    },
    body: JSON.stringify({
      organizationId,
      ...(siteId ? { siteId } : {}),
      ...(agentId ? { agentId } : { groupId }),
      weekStart,
      targetMinutes: Math.round(targetHours * 60),
      reason,
    }),
  });

  if (result.error)
    redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}error=save`);
  revalidatePath(returnTo.split('?')[0]);
  redirect(`${returnTo}${returnTo.includes('?') ? '&' : '?'}saved=hours`);
}

export async function setAgentContract(formData: FormData): Promise<void> {
  const organizationId = stringValue(formData, 'organizationId');
  const siteId = stringValue(formData, 'siteId');
  const agentId = stringValue(formData, 'agentId');
  const effectiveFrom = stringValue(formData, 'effectiveFrom');
  const weeklyHours = Number(stringValue(formData, 'weeklyHours'));
  const monthlyHoursValue = stringValue(formData, 'monthlyHours');
  const monthlyHours = monthlyHoursValue
    ? Number(monthlyHoursValue)
    : undefined;
  const label = stringValue(formData, 'label');
  const path = `/tools/planning/agents/${agentId}`;

  if (
    ![organizationId, siteId, agentId].every((value) =>
      UUID_PATTERN.test(value),
    ) ||
    !effectiveFrom ||
    !Number.isFinite(weeklyHours)
  ) {
    redirect(`${path}?error=invalid`);
  }

  const result = await apiFetch(`/agents/${agentId}/contracts`, {
    method: 'POST',
    headers: scopedHeaders(organizationId, siteId),
    body: JSON.stringify({
      organizationId,
      effectiveFrom,
      weeklyTargetMinutes: Math.round(weeklyHours * 60),
      ...(monthlyHours === undefined
        ? {}
        : { monthlyTargetMinutes: Math.round(monthlyHours * 60) }),
      ...(label ? { label } : {}),
    }),
  });

  if (result.error) redirect(`${path}?error=save`);
  revalidatePath(path);
  redirect(`${path}?saved=contract`);
}

export async function setAgentPositionRule(formData: FormData): Promise<void> {
  const organizationId = stringValue(formData, 'organizationId');
  const siteId = stringValue(formData, 'siteId');
  const agentId = stringValue(formData, 'agentId');
  const positionId = stringValue(formData, 'positionId');
  const validFrom = stringValue(formData, 'validFrom');
  const kind = stringValue(formData, 'kind');
  const note = stringValue(formData, 'note');
  const level = stringValue(formData, 'level');
  const returnTo = stringValue(formData, 'returnTo');
  const pagePath =
    returnTo === 'agents'
      ? '/tools/planning/agents'
      : `/tools/planning/agents/${agentId}`;
  const redirectPath =
    returnTo === 'agents'
      ? `${pagePath}?site=${encodeURIComponent(siteId)}&edit=${encodeURIComponent(agentId)}`
      : pagePath;
  const noticePath = (name: 'error' | 'saved', value: string) =>
    `${redirectPath}${redirectPath.includes('?') ? '&' : '?'}${name}=${value}`;
  const isRestriction = kind === 'restriction';

  if (
    ![organizationId, siteId, agentId, positionId].every((value) =>
      UUID_PATTERN.test(value),
    ) ||
    !validFrom ||
    !['preference', 'restriction'].includes(kind) ||
    (isRestriction && note.length < 3) ||
    (!isRestriction && !['preferred', 'neutral', 'avoid'].includes(level))
  ) {
    redirect(noticePath('error', 'invalid'));
  }

  const result = await apiFetch(
    `/agents/${agentId}/${isRestriction ? 'position-restrictions' : 'position-preferences'}`,
    {
      method: 'POST',
      headers: scopedHeaders(organizationId, siteId),
      body: JSON.stringify(
        isRestriction
          ? { organizationId, positionId, reason: note, validFrom }
          : {
              organizationId,
              positionId,
              level,
              priority: 3,
              note: note || undefined,
              validFrom,
            },
      ),
    },
  );

  if (result.error) redirect(noticePath('error', 'save'));
  revalidatePath(pagePath);
  redirect(noticePath('saved', 'rule'));
}

export async function createSkill(formData: FormData): Promise<void> {
  const organizationId = stringValue(formData, 'organizationId');
  const siteId = stringValue(formData, 'siteId');
  const code = stringValue(formData, 'code').toUpperCase();
  const name = stringValue(formData, 'name');
  const description = stringValue(formData, 'description');
  const path = `/tools/planning/referentiels?site=${siteId}`;

  if (
    !UUID_PATTERN.test(organizationId) ||
    !UUID_PATTERN.test(siteId) ||
    !code ||
    !name
  ) {
    redirect(`${path}&error=invalid`);
  }

  const result = await apiFetch('/skills', {
    method: 'POST',
    headers: scopedHeaders(organizationId, siteId),
    body: JSON.stringify({
      organizationId,
      code,
      name,
      description: description || undefined,
    }),
  });

  if (result.error) redirect(`${path}&error=save`);
  revalidatePath(path);
  redirect(`${path}&saved=skill`);
}

export async function createVessel(formData: FormData): Promise<void> {
  const organizationId = stringValue(formData, 'organizationId');
  const siteId = stringValue(formData, 'siteId');
  const code = stringValue(formData, 'code').toUpperCase();
  const name = stringValue(formData, 'name');
  const imoNumber = stringValue(formData, 'imoNumber');
  const path = `/tools/planning/referentiels?site=${siteId}`;

  if (
    !UUID_PATTERN.test(organizationId) ||
    !UUID_PATTERN.test(siteId) ||
    !code ||
    !name
  ) {
    redirect(`${path}&error=invalid`);
  }

  const result = await apiFetch('/vessels', {
    method: 'POST',
    headers: scopedHeaders(organizationId, siteId),
    body: JSON.stringify({
      organizationId,
      code,
      name,
      imoNumber: imoNumber || undefined,
    }),
  });

  if (result.error) redirect(`${path}&error=save`);
  revalidatePath(path);
  redirect(`${path}&saved=vessel`);
}

export async function publishSchedule(formData: FormData): Promise<void> {
  const organizationId = stringValue(formData, 'organizationId');
  const siteId = stringValue(formData, 'siteId');
  const scheduleId = stringValue(formData, 'scheduleId');
  const weekStart = stringValue(formData, 'weekStart');
  const reason = stringValue(formData, 'reason');
  const path = `/tools/planning?site=${encodeURIComponent(siteId)}&date=${encodeURIComponent(weekStart)}`;

  if (
    ![organizationId, siteId, scheduleId].every((value) =>
      UUID_PATTERN.test(value),
    ) ||
    !DATE_PATTERN.test(weekStart) ||
    !reason
  ) {
    redirect(`${path}&error=invalid`);
  }

  const result = await apiFetch(`/schedule-versions/${scheduleId}/publish`, {
    method: 'POST',
    headers: scopedHeaders(organizationId, siteId),
    body: JSON.stringify({ reason }),
  });

  if (result.error) redirect(`${path}&error=publish`);
  revalidatePath('/tools/planning');
  redirect(`${path}&saved=published`);
}

export async function updatePortCallTiming(formData: FormData): Promise<void> {
  const organizationId = stringValue(formData, 'organizationId');
  const siteId = stringValue(formData, 'siteId');
  const portCallId = stringValue(formData, 'portCallId');
  const timeZone = stringValue(formData, 'timeZone');
  const arrival = stringValue(formData, 'estimatedArrivalAt');
  const departure = stringValue(formData, 'estimatedDepartureAt');
  const status = stringValue(formData, 'status');
  const sourceRevision = stringValue(formData, 'sourceRevision');
  const arrivalIso = arrival ? zonedLocalToIso(arrival, timeZone) : null;
  const departureIso = departure ? zonedLocalToIso(departure, timeZone) : null;
  const path = `/tools/planning/escales?site=${siteId}&call=${portCallId}`;

  if (
    ![organizationId, siteId, portCallId].every((value) =>
      UUID_PATTERN.test(value),
    ) ||
    (arrival && !arrivalIso) ||
    (departure && !departureIso) ||
    !status
  ) {
    redirect(`${path}&error=invalid`);
  }

  const result = await apiFetch(`/port-calls/${portCallId}/timing`, {
    method: 'PATCH',
    headers: scopedHeaders(organizationId, siteId),
    body: JSON.stringify({
      estimatedArrivalAt: arrivalIso,
      estimatedDepartureAt: departureIso,
      status,
      source: 'tools-panel',
      sourceRevision: sourceRevision || undefined,
    }),
  });

  if (result.error) redirect(`${path}&error=timing`);
  revalidatePath('/tools/planning');
  revalidatePath('/tools/planning/escales');
  redirect(`${path}&saved=timing`);
}

export async function createLoadForecast(formData: FormData): Promise<void> {
  const organizationId = stringValue(formData, 'organizationId');
  const siteId = stringValue(formData, 'siteId');
  const portCallId = stringValue(formData, 'portCallId');
  const passengerCount = Number(stringValue(formData, 'passengerCount'));
  const passengerQuota = Number(stringValue(formData, 'passengerQuota'));
  const vehicleCount = Number(stringValue(formData, 'vehicleCount'));
  const freightUnitCount = Number(
    stringValue(formData, 'freightUnitCount') || '0',
  );
  const coachCount = Number(stringValue(formData, 'coachCount') || '0');
  const path = `/tools/planning/escales?site=${siteId}&call=${portCallId}`;

  if (
    ![organizationId, siteId, portCallId].every((value) =>
      UUID_PATTERN.test(value),
    ) ||
    ![
      passengerCount,
      passengerQuota,
      vehicleCount,
      freightUnitCount,
      coachCount,
    ].every((value) => Number.isInteger(value) && value >= 0)
  ) {
    redirect(`${path}&error=invalid`);
  }

  const result = await apiFetch('/load-forecasts', {
    method: 'POST',
    headers: scopedHeaders(organizationId, siteId),
    body: JSON.stringify({
      organizationId,
      siteId,
      portCallId,
      passengerCount,
      passengerQuota,
      vehicleCount,
      freightUnitCount,
      coachCount,
      source: 'tools-panel',
    }),
  });

  if (result.error) redirect(`${path}&error=forecast`);
  revalidatePath('/tools/planning');
  revalidatePath('/tools/planning/escales');
  redirect(`${path}&saved=forecast`);
}

export async function assignDemandProfile(formData: FormData): Promise<void> {
  const organizationId = stringValue(formData, 'organizationId');
  const siteId = stringValue(formData, 'siteId');
  const portCallId = stringValue(formData, 'portCallId');
  const demandProfileId = stringValue(formData, 'demandProfileId');
  const path = `/tools/planning/escales?site=${siteId}&call=${portCallId}`;

  if (
    ![organizationId, siteId, portCallId].every((value) =>
      UUID_PATTERN.test(value),
    ) ||
    (demandProfileId && !UUID_PATTERN.test(demandProfileId))
  ) {
    redirect(`${path}&error=invalid`);
  }

  const result = await apiFetch(`/port-calls/${portCallId}/demand-profile`, {
    method: 'PATCH',
    headers: scopedHeaders(organizationId, siteId),
    body: JSON.stringify({ demandProfileId: demandProfileId || null }),
  });

  if (result.error) redirect(`${path}&error=profile`);
  revalidatePath('/tools/planning');
  revalidatePath('/tools/planning/escales');
  redirect(`${path}&saved=profile`);
}

export async function createDemandProfile(formData: FormData): Promise<void> {
  const organizationId = stringValue(formData, 'organizationId');
  const siteId = stringValue(formData, 'siteId');
  const code = stringValue(formData, 'code').toUpperCase();
  const name = stringValue(formData, 'name');
  const version = Number(stringValue(formData, 'version'));
  const path = `/tools/planning/besoins?site=${siteId}`;

  if (
    !UUID_PATTERN.test(organizationId) ||
    !UUID_PATTERN.test(siteId) ||
    !code ||
    !name ||
    !Number.isInteger(version) ||
    version < 1
  ) {
    redirect(`${path}&error=invalid`);
  }

  const result = await apiFetch('/demand-profiles', {
    method: 'POST',
    headers: scopedHeaders(organizationId, siteId),
    body: JSON.stringify({ organizationId, siteId, code, name, version }),
  });

  if (result.error) redirect(`${path}&error=profile`);
  revalidatePath(path);
  redirect(`${path}&saved=profile`);
}

export async function createDemandProfileLine(
  formData: FormData,
): Promise<void> {
  const organizationId = stringValue(formData, 'organizationId');
  const siteId = stringValue(formData, 'siteId');
  const profileId = stringValue(formData, 'profileId');
  const positionId = stringValue(formData, 'positionId');
  const anchor = stringValue(formData, 'anchor');
  const startsOffsetMinutes = Number(
    stringValue(formData, 'startsOffsetMinutes'),
  );
  const durationMinutes = Number(stringValue(formData, 'durationMinutes'));
  const baseAgents = Number(stringValue(formData, 'baseAgents'));
  const minimumAgents = Number(stringValue(formData, 'minimumAgents'));
  const maximumValue = stringValue(formData, 'maximumAgents');
  const maximumAgents = maximumValue ? Number(maximumValue) : undefined;
  const passengersValue = stringValue(formData, 'passengersPerExtraAgent');
  const passengersPerExtraAgent = passengersValue
    ? Number(passengersValue)
    : undefined;
  const vehiclesValue = stringValue(formData, 'vehiclesPerExtraAgent');
  const vehiclesPerExtraAgent = vehiclesValue
    ? Number(vehiclesValue)
    : undefined;
  const path = `/tools/planning/besoins?site=${siteId}&profile=${profileId}`;

  if (
    ![organizationId, siteId, profileId, positionId].every((value) =>
      UUID_PATTERN.test(value),
    ) ||
    ![startsOffsetMinutes, durationMinutes, baseAgents, minimumAgents].every(
      Number.isInteger,
    ) ||
    (maximumAgents !== undefined && !Number.isInteger(maximumAgents)) ||
    (passengersPerExtraAgent !== undefined &&
      (!Number.isInteger(passengersPerExtraAgent) ||
        passengersPerExtraAgent < 1)) ||
    (vehiclesPerExtraAgent !== undefined &&
      (!Number.isInteger(vehiclesPerExtraAgent) || vehiclesPerExtraAgent < 1))
  ) {
    redirect(`${path}&error=invalid`);
  }

  const result = await apiFetch(`/demand-profiles/${profileId}/lines`, {
    method: 'POST',
    headers: scopedHeaders(organizationId, siteId),
    body: JSON.stringify({
      organizationId,
      siteId,
      positionId,
      anchor,
      startsOffsetMinutes,
      durationMinutes,
      baseAgents,
      minimumAgents,
      maximumAgents,
      passengersPerExtraAgent,
      vehiclesPerExtraAgent,
    }),
  });

  if (result.error) redirect(`${path}&error=line`);
  revalidatePath('/tools/planning/besoins');
  redirect(`${path}&saved=line`);
}

export async function createPortCall(formData: FormData): Promise<void> {
  const organizationId = stringValue(formData, 'organizationId');
  const siteId = stringValue(formData, 'siteId');
  const vesselId = stringValue(formData, 'vesselId');
  const externalReference = stringValue(formData, 'externalReference');
  const timeZone = stringValue(formData, 'timeZone');
  const arrival = stringValue(formData, 'scheduledArrivalAt');
  const departure = stringValue(formData, 'scheduledDepartureAt');
  const scheduledArrivalAt = arrival
    ? zonedLocalToIso(arrival, timeZone)
    : null;
  const scheduledDepartureAt = departure
    ? zonedLocalToIso(departure, timeZone)
    : null;
  const path = `/tools/planning/escales?site=${siteId}`;

  if (
    ![organizationId, siteId, vesselId].every((value) =>
      UUID_PATTERN.test(value),
    ) ||
    (!scheduledArrivalAt && !scheduledDepartureAt) ||
    (arrival && !scheduledArrivalAt) ||
    (departure && !scheduledDepartureAt)
  ) {
    redirect(`${path}&error=invalid`);
  }

  const result = await apiFetch('/port-calls', {
    method: 'POST',
    headers: scopedHeaders(organizationId, siteId),
    body: JSON.stringify({
      organizationId,
      siteId,
      vesselId,
      externalReference: externalReference || undefined,
      scheduledArrivalAt,
      scheduledDepartureAt,
      source: 'tools-panel',
    }),
  });

  if (result.error) redirect(`${path}&error=create`);
  revalidatePath('/tools/planning');
  revalidatePath(path);
  redirect(`${path}&saved=create`);
}

export async function setPositionSkill(formData: FormData): Promise<void> {
  const organizationId = stringValue(formData, 'organizationId');
  const siteId = stringValue(formData, 'siteId');
  const positionId = stringValue(formData, 'positionId');
  const skillId = stringValue(formData, 'skillId');
  const minimumLevel = Number(stringValue(formData, 'minimumLevel'));
  const mandatory = stringValue(formData, 'mandatory') === 'on';
  const path = `/tools/planning/referentiels?site=${siteId}&position=${positionId}`;

  if (
    ![organizationId, siteId, positionId, skillId].every((value) =>
      UUID_PATTERN.test(value),
    ) ||
    !Number.isInteger(minimumLevel) ||
    minimumLevel < 1 ||
    minimumLevel > 5
  ) {
    redirect(`${path}&error=invalid`);
  }

  const result = await apiFetch(`/positions/${positionId}/skills`, {
    method: 'POST',
    headers: scopedHeaders(organizationId, siteId),
    body: JSON.stringify({
      organizationId,
      skillId,
      minimumLevel,
      mandatory,
    }),
  });

  if (result.error) redirect(`${path}&error=skill`);
  revalidatePath('/tools/planning/referentiels');
  redirect(`${path}&saved=skill`);
}

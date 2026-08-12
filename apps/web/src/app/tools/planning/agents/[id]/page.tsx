import { notFound } from 'next/navigation';

import { apiFetch } from '../../../../../lib/api/server';
import { scopedHeaders } from '../../../../../lib/api/scoped-headers';
import type {
  Agent,
  AgentOffboardingPlan,
  AgentRules,
  AgentSkill,
  AgentUnavailabilityPage,
  HourBalance,
  PositionSearchPage,
  Site,
  Skill,
} from '../../../../../lib/api/types';
import {
  currentDateInTimeZone,
  currentInstant,
  mondayOf,
} from '../../../../../lib/dates';
import { AgentOverview } from './agent-overview';
import { AgentPositionRulesSection } from './agent-position-rules-section';
import { AgentSkillsSection } from './agent-skills-section';
import { AgentUnavailabilitySection } from './agent-unavailability-section';
import { AgentWorkTimeSection } from './agent-work-time-section';

type AgentDetailPageProps = Readonly<{
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    absencePage?: string;
    absenceQ?: string;
    absenceUpcomingPage?: string;
    error?: string;
    saved?: string;
  }>;
}>;

export default async function AgentDetailPage({
  params,
  searchParams,
}: AgentDetailPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const [agentResult, sitesResult] = await Promise.all([
    apiFetch<Agent>(`/agents/${id}`),
    apiFetch<Site[]>('/sites'),
  ]);

  if (!agentResult.data) {
    notFound();
  }

  const agent = agentResult.data;
  const timeZone =
    sitesResult.data?.find((site) => site.id === agent.primary_site_id)
      ?.timezone ?? 'Europe/Paris';
  const today = currentDateInTimeZone(timeZone);
  const weekStart = mondayOf(today);
  const absenceQuery = query.absenceQ?.trim().slice(0, 80) ?? '';
  const requestedAbsencePage = Math.max(
    1,
    Number.parseInt(query.absencePage ?? '1', 10) || 1,
  );
  const requestedUpcomingPage = Math.max(
    1,
    Number.parseInt(query.absenceUpcomingPage ?? '1', 10) || 1,
  );
  const pastAbsenceSearch = new URLSearchParams({
    page: String(requestedAbsencePage),
    pageSize: '10',
    scope: 'past',
  });
  if (absenceQuery) pastAbsenceSearch.set('q', absenceQuery);

  const [
    positionsResult,
    rulesResult,
    balanceResult,
    skillsResult,
    agentSkillsResult,
    upcomingUnavailabilityResult,
    pastUnavailabilityResult,
    offboardingPlanResult,
  ] = await Promise.all([
    apiFetch<PositionSearchPage>(
      `/positions?organizationId=${encodeURIComponent(agent.organization_id)}&siteId=${encodeURIComponent(agent.primary_site_id)}&pageSize=200`,
    ),
    apiFetch<AgentRules>(`/agents/${agent.id}/rules`),
    apiFetch<HourBalance>(
      `/hour-balances?agentId=${agent.id}&weekStart=${weekStart}`,
    ),
    apiFetch<Skill[]>(
      `/skills?organizationId=${encodeURIComponent(agent.organization_id)}`,
    ),
    apiFetch<AgentSkill[]>(`/agents/${agent.id}/skills`),
    apiFetch<AgentUnavailabilityPage>(
      `/agents/${agent.id}/unavailability?scope=upcoming&pageSize=10&page=${requestedUpcomingPage}`,
    ),
    apiFetch<AgentUnavailabilityPage>(
      `/agents/${agent.id}/unavailability?${pastAbsenceSearch.toString()}`,
    ),
    apiFetch<AgentOffboardingPlan>(
      `/agents/${agent.id}/offboarding-plan?organizationId=${encodeURIComponent(agent.organization_id)}`,
      {
        headers: scopedHeaders(agent.organization_id, agent.primary_site_id),
      },
    ),
  ]);

  const positions = positionsResult.data?.items ?? [];
  const rules = rulesResult.data ?? {
    preferences: [],
    restrictions: [],
    contracts: [],
  };
  const skills = skillsResult.data ?? [];
  const agentSkills = agentSkillsResult.data ?? [];
  const unavailabilityLoadFailed = Boolean(
    upcomingUnavailabilityResult.error || pastUnavailabilityResult.error,
  );
  const skillsLoadFailed = Boolean(
    skillsResult.error || agentSkillsResult.error,
  );
  const now = currentInstant();

  return (
    <div className="space-y-6">
      <AgentOverview
        agent={agent}
        balance={balanceResult.data}
        error={query.error}
        offboardingLoadFailed={Boolean(offboardingPlanResult.error)}
        offboardingPlan={offboardingPlanResult.data}
        positionsHasMore={positionsResult.data?.hasMore ?? false}
        positionsTotal={positionsResult.data?.total ?? positions.length}
        saved={query.saved}
        timeZone={timeZone}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <AgentUnavailabilitySection
          absenceQuery={absenceQuery}
          agent={agent}
          loadFailed={unavailabilityLoadFailed}
          now={now}
          pastPage={pastUnavailabilityResult.data}
          requestedAbsencePage={requestedAbsencePage}
          timeZone={timeZone}
          today={today}
          upcomingPage={upcomingUnavailabilityResult.data}
        />
        <AgentSkillsSection
          agent={agent}
          agentSkills={agentSkills}
          loadFailed={skillsLoadFailed}
          skills={skills}
          today={today}
        />
      </div>

      <AgentWorkTimeSection
        agent={agent}
        contracts={rules.contracts}
        today={today}
        weekStart={weekStart}
      />

      <AgentPositionRulesSection
        agent={agent}
        positions={positions}
        rules={rules}
        today={today}
      />
    </div>
  );
}

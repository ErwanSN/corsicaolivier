import Link from 'next/link';

import { PlanningExportButton } from '../../../components/planning-export-button';
import { PlanningGrid } from '../../../components/weekly-planning-grid';
import { apiFetch } from '../../../lib/api/server';
import type {
  AgentSearchPage,
  PlanningPeriod,
  PlanningWorkforceConflict,
  PortCall,
  PositionSearchPage,
  ReplanningScenarioDetail,
  ReplanningScenarioPage,
  ScheduleContent,
  ScheduleVersion,
  Site,
  StaffingRequirement,
  Vessel,
} from '../../../lib/api/types';
import { currentDateInTimeZone } from '../../../lib/dates';
import {
  addDays,
  resolveWeeklyRange,
  type WeeklyPlanningRange,
} from '../../../lib/planning-range';
import { orderSites } from '../../../lib/sites';
import {
  approveReplanningScenario,
  prepareWorkforceConflictDraft,
  publishSchedule,
  rejectReplanningScenario,
  resolveWorkforceConflict,
} from './actions';
import styles from './planning-page.module.css';

type PlanningPageProps = Readonly<{
  searchParams: Promise<{
    date?: string;
    error?: string;
    saved?: string;
    incidentPage?: string;
    site?: string;
    version?: string;
  }>;
}>;

type PlanningVersionView = 'draft' | 'published';

const rangeDateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const compactDayFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  timeZone: 'UTC',
});
const compactDateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

function weekHref(
  siteId: string,
  startsOn: string,
  versionView: PlanningVersionView = 'published',
): string {
  const params = new URLSearchParams({ date: startsOn, site: siteId });
  if (versionView === 'draft') params.set('version', 'draft');

  return `/tools/planning?${params.toString()}`;
}

function adjacentWeekHref(
  siteId: string,
  range: WeeklyPlanningRange,
  direction: -1 | 1,
  versionView: PlanningVersionView,
): string {
  return weekHref(siteId, addDays(range.startsOn, direction * 7), versionView);
}

function rangeLabel(range: WeeklyPlanningRange): string {
  const start = rangeDateFormatter.format(
    new Date(`${range.startsOn}T12:00:00.000Z`),
  );
  const end = rangeDateFormatter.format(
    new Date(`${range.endsOn}T12:00:00.000Z`),
  );

  return `${start} — ${end}`;
}

function compactRangeLabel(range: WeeklyPlanningRange): string {
  const start = new Date(`${range.startsOn}T12:00:00.000Z`);
  const end = new Date(`${range.endsOn}T12:00:00.000Z`);
  const sameMonth =
    start.getUTCFullYear() === end.getUTCFullYear() &&
    start.getUTCMonth() === end.getUTCMonth();

  return sameMonth
    ? `${compactDayFormatter.format(start)}–${compactDateFormatter.format(end)}`
    : `${compactDateFormatter.format(start)} – ${compactDateFormatter.format(end)}`;
}

function conflictMomentLabel(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    timeZone,
  }).format(new Date(value));
}

export default async function PlanningPage({
  searchParams,
}: PlanningPageProps) {
  const params = await searchParams;
  const sitesResult = await apiFetch<Site[]>('/sites');
  const sites = orderSites(sitesResult.data ?? []);
  const site = sites.find((item) => item.id === params.site) ?? sites.at(0);

  if (!site) {
    return (
      <p className="border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        Aucun site de planification n’est disponible.
      </p>
    );
  }

  const today = currentDateInTimeZone(site.timezone);
  const range = resolveWeeklyRange(params.date, today);

  const maritimeWindow = new URLSearchParams({
    from: `${addDays(range.startsOn, -1)}T00:00:00.000Z`,
    limit: '250',
    siteId: site.id,
    to: `${addDays(range.endsOn, 2)}T00:00:00.000Z`,
  });
  const workforceConflictWindow = new URLSearchParams({
    endsOn: range.endsOn,
    limit: '100',
    siteId: site.id,
    startsOn: range.startsOn,
  });

  const [
    callsResult,
    conflictsResult,
    periodsResult,
    positionsResult,
    vesselsResult,
  ] = await Promise.all([
    apiFetch<PortCall[]>(`/port-calls?${maritimeWindow.toString()}`),
    apiFetch<PlanningWorkforceConflict[]>(
      `/planning-workforce-conflicts?${workforceConflictWindow.toString()}`,
    ),
    apiFetch<PlanningPeriod[]>(
      `/planning-periods?${new URLSearchParams({
        endsOn: range.endsOn,
        siteId: site.id,
        startsOn: range.startsOn,
      }).toString()}`,
    ),
    apiFetch<PositionSearchPage>(
      `/positions?organizationId=${encodeURIComponent(site.organization_id)}&siteId=${encodeURIComponent(site.id)}&pageSize=200`,
    ),
    apiFetch<Vessel[]>(
      `/vessels?organizationId=${encodeURIComponent(site.organization_id)}`,
    ),
  ]);
  const workforceConflicts = conflictsResult.data ?? [];
  const workforceConflictTotal = workforceConflicts[0]?.total_count ?? 0;
  const periods = periodsResult.data ?? [];
  const versionView: PlanningVersionView =
    params.version === 'draft' ? 'draft' : 'published';
  const isCurrentWeek = today >= range.startsOn && today <= range.endsOn;
  const visiblePeriods = periods.filter(
    (period) =>
      period.starts_on <= range.endsOn && period.ends_on >= range.startsOn,
  );
  const periodBundles = await Promise.all(
    visiblePeriods.map(async (period) => {
      const versionsResult = await apiFetch<ScheduleVersion[]>(
        `/schedule-versions?planningPeriodId=${encodeURIComponent(period.id)}`,
      );
      const versions = versionsResult.data ?? [];
      const publishedVersion = versions.find(
        (version) => version.status === 'published',
      );
      const draftVersion = versions.find(
        (version) =>
          version.status === 'draft' || version.status === 'validated',
      );
      const displayedVersion =
        versionView === 'draft'
          ? (draftVersion ?? publishedVersion ?? versions.at(0))
          : (publishedVersion ?? draftVersion ?? versions.at(0));
      const [contentResult, requirementsResult] = displayedVersion
        ? await Promise.all([
            apiFetch<ScheduleContent>(
              `/schedule-versions/${displayedVersion.id}`,
            ),
            apiFetch<StaffingRequirement[]>(
              `/schedule-versions/${displayedVersion.id}/requirements`,
            ),
          ])
        : [
            { data: null, error: null },
            { data: [] as StaffingRequirement[], error: null },
          ];

      return {
        content: contentResult.data,
        error: Boolean(
          versionsResult.error ||
          requirementsResult.error ||
          contentResult.error,
        ),
        period,
        requirements: requirementsResult.data ?? [],
        versions,
      };
    }),
  );
  const scheduleContents = periodBundles.flatMap((bundle) =>
    bundle.content ? [bundle.content] : [],
  );
  const assignedAgentIds = [
    ...new Set(
      scheduleContents.flatMap((content) =>
        content.shifts.map((shift) => shift.agent_id),
      ),
    ),
  ];
  const assignedAgentIdChunks = Array.from(
    { length: Math.max(1, Math.ceil(assignedAgentIds.length / 100)) },
    (_, index) => assignedAgentIds.slice(index * 100, (index + 1) * 100),
  );
  const planningAgentResults = await Promise.all(
    assignedAgentIdChunks.map((includeIds) => {
      const search = new URLSearchParams({
        page: '1',
        pageSize: '50',
        siteId: site.id,
        status: 'active',
      });
      if (includeIds.length) search.set('includeIds', includeIds.join(','));
      return apiFetch<AgentSearchPage>(`/agents/search?${search}`);
    }),
  );
  const firstPlanningAgentPage = planningAgentResults.at(0)?.data;
  const planningAgents = [
    ...new Map(
      [
        ...(firstPlanningAgentPage?.items ?? []),
        ...planningAgentResults.flatMap(
          (result) => result.data?.included ?? [],
        ),
      ].map((agent) => [agent.id, agent]),
    ).values(),
  ];
  const activeAgentCount = firstPlanningAgentPage?.counts.active ?? 0;
  const visibleVersionIds = new Set(
    periodBundles.flatMap((bundle) =>
      bundle.versions.map((version) => version.id),
    ),
  );
  const requestedIncidentPage = Math.max(
    1,
    Number.parseInt(params.incidentPage ?? '1', 10) || 1,
  );
  const scenarioSearch = new URLSearchParams({
    page: String(requestedIncidentPage),
    pageSize: '3',
    siteId: site.id,
    status: 'simulated',
  });
  if (visibleVersionIds.size) {
    scenarioSearch.set(
      'baseScheduleVersionIds',
      [...visibleVersionIds].join(','),
    );
  }
  const scenariosResult = visibleVersionIds.size
    ? await apiFetch<ReplanningScenarioPage>(
        `/replanning-scenarios?${scenarioSearch.toString()}`,
      )
    : { data: null, error: null };
  const pendingScenarios = scenariosResult.data?.items ?? [];
  const incidentTotal = scenariosResult.data?.total ?? 0;
  const pendingScenarioDetails = await Promise.all(
    pendingScenarios.map(async (scenario) => {
      const result = await apiFetch<ReplanningScenarioDetail>(
        `/replanning-scenarios/${scenario.id}`,
      );
      return result.data ?? { scenario, impacts: [] };
    }),
  );
  const activeBundle = periodBundles.at(0);
  const draftVersion = activeBundle?.versions.find(
    (version) => version.status === 'draft' || version.status === 'validated',
  );
  const publishedVersion = activeBundle?.versions.find(
    (version) => version.status === 'published',
  );
  const displayedVersion = activeBundle?.content?.version;
  const showingDraft =
    displayedVersion?.status === 'draft' ||
    displayedVersion?.status === 'validated';
  const activeVersionId = displayedVersion?.id;
  const excelExportHref = activeVersionId
    ? `/tools/planning/export/${activeVersionId}`
    : `/tools/planning/export/week?${new URLSearchParams({
        date: range.startsOn,
        site: site.id,
      }).toString()}`;
  const hasError = Boolean(
    sitesResult.error ||
    planningAgentResults.some((result) => result.error) ||
    callsResult.error ||
    conflictsResult.error ||
    periodsResult.error ||
    positionsResult.error ||
    scenariosResult.error ||
    vesselsResult.error ||
    periodBundles.some((bundle) => bundle.error),
  );

  return (
    <div className={`${styles.page} planning-print-root`}>
      <h1 className={styles.visuallyHidden}>Planning opérationnel</h1>
      <header className={`${styles.printHeader} planning-print-only`}>
        <h1>Planning opérationnel</h1>
        <p>{rangeLabel(range)}</p>
      </header>

      <section
        aria-label="Commandes du planning"
        className={styles.toolbar}
        data-print-hide
      >
        <div className={styles.toolbarPrimary}>
          {sites.length > 1 ? (
            <details className={`${styles.menu} ${styles.siteMenu}`}>
              <summary>{site.name.replace('Marseille ', '')}</summary>
              <nav aria-label="Changer de site" className={styles.sitePanel}>
                {sites.map((item) => (
                  <Link
                    aria-current={item.id === site.id ? 'page' : undefined}
                    className={
                      item.id === site.id
                        ? styles.activeSiteLink
                        : styles.siteLink
                    }
                    href={weekHref(item.id, range.startsOn, versionView)}
                    key={item.id}
                  >
                    {item.name.replace('Marseille ', '')}
                  </Link>
                ))}
              </nav>
            </details>
          ) : (
            <p className={styles.siteLabel}>
              {site.name.replace('Marseille ', '')}
            </p>
          )}
          <nav
            aria-label="Changer de semaine"
            className={styles.weekNavigation}
          >
            <Link
              aria-label="Semaine précédente"
              className={styles.arrowButton}
              href={adjacentWeekHref(site.id, range, -1, versionView)}
              title="Semaine précédente"
            >
              <span aria-hidden="true">←</span>
            </Link>
            <div className={styles.weekLabel}>
              <strong>{compactRangeLabel(range)}</strong>
            </div>
            <Link
              aria-label="Semaine suivante"
              className={styles.arrowButton}
              href={adjacentWeekHref(site.id, range, 1, versionView)}
              title="Semaine suivante"
            >
              <span aria-hidden="true">→</span>
            </Link>
            {!isCurrentWeek ? (
              <Link
                className={styles.todayButton}
                href={weekHref(site.id, today, versionView)}
              >
                <span className={styles.todayLong}>Aujourd’hui</span>
                <span className={styles.todayShort}>Auj.</span>
              </Link>
            ) : null}
          </nav>
        </div>

        <details className={`${styles.menu} ${styles.actionsMenu}`}>
          <summary>Actions</summary>
          <div className={styles.actionsPanel}>
            {displayedVersion ? (
              <p className={styles.versionStatus}>
                {showingDraft
                  ? `Copie de travail v${displayedVersion.version_number}`
                  : `Version publiée v${displayedVersion.version_number}`}
              </p>
            ) : null}

            {draftVersion && publishedVersion ? (
              <nav
                aria-label="Version du planning affichée"
                className={styles.versionNavigation}
              >
                <Link
                  aria-current={!showingDraft ? 'page' : undefined}
                  href={weekHref(site.id, range.startsOn)}
                >
                  Planning publié
                </Link>
                <Link
                  aria-current={showingDraft ? 'page' : undefined}
                  href={weekHref(site.id, range.startsOn, 'draft')}
                >
                  Afficher le brouillon
                </Link>
              </nav>
            ) : null}

            {draftVersion ? (
              <section className={styles.publishSection}>
                <p className={styles.panelTitle}>
                  {publishedVersion
                    ? 'Publier les modifications'
                    : 'Publier cette semaine'}
                </p>
                <p className={styles.panelHelp}>
                  Le motif assure la traçabilité, notamment pour les changements
                  de dernière minute.
                </p>
                <form action={publishSchedule} className={styles.publishForm}>
                  <input
                    name="organizationId"
                    type="hidden"
                    value={site.organization_id}
                  />
                  <input name="siteId" type="hidden" value={site.id} />
                  <input
                    name="scheduleId"
                    type="hidden"
                    value={draftVersion.id}
                  />
                  <input
                    name="lockVersion"
                    type="hidden"
                    value={draftVersion.lock_version}
                  />
                  <input
                    name="weekStart"
                    type="hidden"
                    value={range.startsOn}
                  />
                  <label htmlFor="publication-reason">
                    Motif de publication
                  </label>
                  <input
                    className="field-input"
                    id="publication-reason"
                    minLength={3}
                    name="reason"
                    placeholder={
                      publishedVersion
                        ? 'Ex. remplacement urgent du 24 juillet'
                        : 'Ex. validation du planning initial'
                    }
                    required
                  />
                  <button className="primary-button" type="submit">
                    {publishedVersion
                      ? 'Publier les modifications'
                      : 'Confirmer la publication'}
                  </button>
                </form>
              </section>
            ) : null}

            <form
              action="/tools/planning"
              className={styles.dateForm}
              method="get"
            >
              <input name="site" type="hidden" value={site.id} />
              {versionView === 'draft' ? (
                <input name="version" type="hidden" value="draft" />
              ) : null}
              <label htmlFor="week-date">Aller à une date</label>
              <div>
                <input
                  defaultValue={range.startsOn}
                  id="week-date"
                  name="date"
                  type="date"
                />
                <button className="secondary-button" type="submit">
                  Afficher
                </button>
              </div>
            </form>

            <div className={styles.exportGroup}>
              <p className={styles.panelTitle}>Exporter</p>
              <div className={styles.exportActions}>
                <a className="secondary-button" download href={excelExportHref}>
                  {publishedVersion
                    ? 'Télécharger le tableau en Excel'
                    : 'Télécharger le brouillon en Excel'}
                </a>
                <PlanningExportButton
                  draftVersionNumber={
                    showingDraft ? draftVersion?.version_number : undefined
                  }
                  siteName={site.name}
                  weekStart={range.startsOn}
                />
                {draftVersion && publishedVersion ? (
                  <a
                    className="secondary-button"
                    download
                    href={`/tools/planning/export/${draftVersion.id}`}
                  >
                    Télécharger le brouillon en Excel
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </details>
      </section>
      {params.saved === 'published' ? (
        <p
          className="border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900"
          data-print-hide
          role="status"
        >
          La semaine a été publiée. Un nouveau brouillon modifiable reste
          disponible dans ce calendrier.
        </p>
      ) : null}
      {params.saved === 'replanning' ? (
        <p
          className="border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900"
          data-print-hide
          role="status"
        >
          Le brouillon de correction est prêt. Vérifiez-le avant de le publier.
        </p>
      ) : null}
      {params.saved === 'rejected' ? (
        <p
          className="border border-zinc-300 bg-zinc-50 p-3 text-sm text-zinc-800"
          data-print-hide
          role="status"
        >
          L’imprévu a été écarté avec son motif. Le planning publié reste
          inchangé.
        </p>
      ) : null}
      {params.saved === 'workforce-draft' ? (
        <p
          className="border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900"
          data-print-hide
          role="status"
        >
          Le brouillon reprend le planning publié. Corrigez l’affectation puis
          publiez-le pour refermer l’alerte.
        </p>
      ) : null}
      {params.saved === 'workforce-resolved' ? (
        <p
          className="border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900"
          data-print-hide
          role="status"
        >
          La correction publiée a été vérifiée et l’alerte est résolue.
        </p>
      ) : null}
      {workforceConflicts.length > 0 ? (
        <details className={styles.workforceConflictNotice} data-print-hide>
          <summary>
            <span aria-hidden="true">!</span>
            <strong>
              {workforceConflictTotal === 1
                ? 'Une contrainte RH à corriger'
                : `${workforceConflictTotal} contraintes RH à corriger`}
            </strong>
            <small>Voir</small>
          </summary>
          <div className={styles.workforceConflictBody}>
            <p>
              Une donnée collaborateur a changé après publication. Le planning
              reste visible, mais ces affectations doivent être remplacées.
            </p>
            <ul>
              {workforceConflicts.slice(0, 5).map((conflict) => (
                <li key={conflict.id}>
                  <div>
                    <Link
                      href={`/tools/planning/agents/${conflict.agent_id}?site=${encodeURIComponent(site.id)}`}
                    >
                      {conflict.agent_display_name}
                    </Link>
                    <span>
                      {conflictMomentLabel(
                        conflict.shift_starts_at,
                        site.timezone,
                      )}{' '}
                      · {conflict.summary}
                    </span>
                  </div>
                  <div className={styles.workforceConflictActions}>
                    <form action={prepareWorkforceConflictDraft}>
                      <input
                        name="organizationId"
                        type="hidden"
                        value={conflict.organization_id}
                      />
                      <input
                        name="siteId"
                        type="hidden"
                        value={conflict.site_id}
                      />
                      <input
                        name="conflictId"
                        type="hidden"
                        value={conflict.id}
                      />
                      <input
                        name="weekStart"
                        type="hidden"
                        value={conflict.planning_period_starts_on}
                      />
                      <button className="secondary-button" type="submit">
                        {conflict.editable_schedule_version_id
                          ? 'Afficher la copie de travail'
                          : 'Créer la copie de travail'}
                      </button>
                    </form>
                    <form action={resolveWorkforceConflict}>
                      <input
                        name="organizationId"
                        type="hidden"
                        value={conflict.organization_id}
                      />
                      <input
                        name="siteId"
                        type="hidden"
                        value={conflict.site_id}
                      />
                      <input
                        name="conflictId"
                        type="hidden"
                        value={conflict.id}
                      />
                      <input
                        name="weekStart"
                        type="hidden"
                        value={conflict.planning_period_starts_on}
                      />
                      <button className="secondary-button" type="submit">
                        Revérifier
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
            {workforceConflicts.length > 5 ? (
              <details className={styles.workforceConflictMore}>
                <summary>
                  Voir {workforceConflicts.length - 5} autre
                  {workforceConflicts.length - 5 > 1 ? 's' : ''}
                  {workforceConflictTotal > workforceConflicts.length
                    ? ` sur ${workforceConflictTotal}`
                    : ''}
                </summary>
                <ul>
                  {workforceConflicts.slice(5).map((conflict) => (
                    <li key={conflict.id}>
                      <div>
                        <Link
                          href={`/tools/planning/agents/${conflict.agent_id}?site=${encodeURIComponent(site.id)}`}
                        >
                          {conflict.agent_display_name}
                        </Link>
                        <span>
                          {conflictMomentLabel(
                            conflict.shift_starts_at,
                            site.timezone,
                          )}{' '}
                          · {conflict.summary}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        </details>
      ) : null}
      {pendingScenarioDetails.length > 0 ? (
        <section
          aria-labelledby="pending-disruptions-title"
          className={styles.disruptionPanel}
          data-print-hide
        >
          <div className={styles.disruptionHeading}>
            <div>
              <h2 id="pending-disruptions-title">
                {incidentTotal === 1
                  ? 'Un imprévu à traiter'
                  : `${incidentTotal} imprévus à traiter`}
              </h2>
              <p>Le planning publié reste inchangé jusqu’à votre validation.</p>
            </div>
          </div>
          <div className={styles.disruptionList}>
            {pendingScenarioDetails.map(({ scenario, impacts }) => {
              const criticalCount = impacts.filter(
                (impact) => impact.severity === 'critical',
              ).length;

              return (
                <article className={styles.disruptionItem} key={scenario.id}>
                  <div>
                    <strong>{scenario.title}</strong>
                    {scenario.summary ? <p>{scenario.summary}</p> : null}
                    <small>
                      {impacts.length} impact{impacts.length > 1 ? 's' : ''}
                      {criticalCount > 0
                        ? ` · ${criticalCount} critique${criticalCount > 1 ? 's' : ''}`
                        : ''}
                    </small>
                  </div>
                  <details>
                    <summary>Préparer la correction</summary>
                    <form action={approveReplanningScenario}>
                      <input
                        name="organizationId"
                        type="hidden"
                        value={site.organization_id}
                      />
                      <input name="siteId" type="hidden" value={site.id} />
                      <input
                        name="scenarioId"
                        type="hidden"
                        value={scenario.id}
                      />
                      <input
                        name="weekStart"
                        type="hidden"
                        value={range.startsOn}
                      />
                      <label htmlFor={`scenario-reason-${scenario.id}`}>
                        Motif de correction
                      </label>
                      <input
                        className="field-input"
                        id={`scenario-reason-${scenario.id}`}
                        minLength={3}
                        name="reason"
                        placeholder="Ex. retard confirmé par l’exploitation"
                        required
                      />
                      <button className="primary-button" type="submit">
                        Créer le brouillon corrigé
                      </button>
                    </form>
                    <details className={styles.rejectScenario}>
                      <summary>Écarter cet imprévu</summary>
                      <form action={rejectReplanningScenario}>
                        <input
                          name="organizationId"
                          type="hidden"
                          value={site.organization_id}
                        />
                        <input name="siteId" type="hidden" value={site.id} />
                        <input
                          name="scenarioId"
                          type="hidden"
                          value={scenario.id}
                        />
                        <input
                          name="weekStart"
                          type="hidden"
                          value={range.startsOn}
                        />
                        <label htmlFor={`scenario-reject-${scenario.id}`}>
                          Motif du rejet
                        </label>
                        <input
                          className="field-input"
                          id={`scenario-reject-${scenario.id}`}
                          minLength={3}
                          name="reason"
                          placeholder="Ex. information non confirmée"
                          required
                        />
                        <button className="secondary-button" type="submit">
                          Confirmer le rejet
                        </button>
                      </form>
                    </details>
                  </details>
                </article>
              );
            })}
          </div>
          {(scenariosResult.data?.totalPages ?? 1) > 1 ? (
            <nav
              aria-label="Pagination des imprévus"
              className="flex items-center justify-between gap-3 border-t border-zinc-200 pt-3 text-sm"
            >
              {scenariosResult.data && scenariosResult.data.page > 1 ? (
                <Link
                  className="secondary-button"
                  href={`/tools/planning?${new URLSearchParams({
                    date: range.startsOn,
                    incidentPage: String(scenariosResult.data.page - 1),
                    site: site.id,
                    ...(versionView === 'draft' ? { version: 'draft' } : {}),
                  }).toString()}`}
                >
                  ← Précédents
                </Link>
              ) : (
                <span />
              )}
              <span className="text-zinc-500">
                {scenariosResult.data?.page} /{' '}
                {scenariosResult.data?.totalPages}
              </span>
              {scenariosResult.data?.hasMore ? (
                <Link
                  className="secondary-button"
                  href={`/tools/planning?${new URLSearchParams({
                    date: range.startsOn,
                    incidentPage: String(scenariosResult.data.page + 1),
                    site: site.id,
                    ...(versionView === 'draft' ? { version: 'draft' } : {}),
                  }).toString()}`}
                >
                  Suivants →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </section>
      ) : null}
      {params.error ? (
        <p
          className="border border-red-300 bg-red-50 p-3 text-sm text-red-900"
          data-print-hide
          role="alert"
        >
          L’action n’a pas pu être terminée. Vérifiez le motif et les règles du
          planning.
        </p>
      ) : null}
      {hasError ? (
        <p className="text-sm text-amber-700" data-print-hide role="alert">
          Certaines données n’ont pas pu être chargées.
        </p>
      ) : null}
      {positionsResult.data?.hasMore ? (
        <p className="text-sm text-amber-700" data-print-hide role="alert">
          Le planning affiche les 200 premiers postes sur{' '}
          {positionsResult.data.total}. Recherchez les postes suivants dans les
          réglages.
        </p>
      ) : null}

      <PlanningGrid
        activeAgentCount={activeAgentCount}
        agents={planningAgents}
        calls={callsResult.data ?? []}
        contents={scheduleContents}
        key={`${site.id}:${range.startsOn}:${periodBundles
          .map((bundle) => bundle.content?.version.id ?? 'empty')
          .join(':')}`}
        positions={positionsResult.data?.items ?? []}
        range={range}
        requirements={periodBundles.flatMap((bundle) => bundle.requirements)}
        siteName={site.name.replace('Marseille ', '')}
        timeZone={site.timezone}
        vessels={vesselsResult.data ?? []}
      />
    </div>
  );
}

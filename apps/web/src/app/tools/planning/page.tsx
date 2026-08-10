import Link from 'next/link';

import { PlanningExportButton } from '../../../components/planning-export-button';
import { PlanningGrid } from '../../../components/weekly-planning-grid';
import { apiFetch } from '../../../lib/api/server';
import type {
  Agent,
  PlanningPeriod,
  PortCall,
  Position,
  ScheduleContent,
  ScheduleVersion,
  Site,
  StaffingRequirement,
  Vessel,
} from '../../../lib/api/types';
import { currentParisDate } from '../../../lib/dates';
import {
  addDays,
  resolveWeeklyRange,
  type WeeklyPlanningRange,
} from '../../../lib/planning-range';
import { orderSites } from '../../../lib/sites';
import { publishSchedule } from './actions';
import styles from './planning-page.module.css';

type PlanningPageProps = Readonly<{
  searchParams: Promise<{
    date?: string;
    error?: string;
    saved?: string;
    site?: string;
  }>;
}>;

function weekHref(siteId: string, startsOn: string): string {
  const params = new URLSearchParams({ date: startsOn, site: siteId });

  return `/tools/planning?${params.toString()}`;
}

function adjacentWeekHref(
  siteId: string,
  range: WeeklyPlanningRange,
  direction: -1 | 1,
): string {
  return weekHref(siteId, addDays(range.startsOn, direction * 7));
}

function rangeLabel(range: WeeklyPlanningRange): string {
  const format = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const start = format.format(new Date(`${range.startsOn}T12:00:00.000Z`));
  const end = format.format(new Date(`${range.endsOn}T12:00:00.000Z`));

  return `${start} — ${end}`;
}

function compactRangeLabel(range: WeeklyPlanningRange): string {
  const start = new Date(`${range.startsOn}T12:00:00.000Z`);
  const end = new Date(`${range.endsOn}T12:00:00.000Z`);
  const sameMonth =
    start.getUTCFullYear() === end.getUTCFullYear() &&
    start.getUTCMonth() === end.getUTCMonth();
  const day = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    timeZone: 'UTC',
  });
  const date = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return sameMonth
    ? `${day.format(start)}–${date.format(end)}`
    : `${date.format(start)} – ${date.format(end)}`;
}

export default async function PlanningPage({
  searchParams,
}: PlanningPageProps) {
  const params = await searchParams;
  const today = currentParisDate();
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

  const [
    agentsResult,
    callsResult,
    periodsResult,
    positionsResult,
    vesselsResult,
  ] = await Promise.all([
    apiFetch<Agent[]>(`/agents?siteId=${encodeURIComponent(site.id)}`),
    apiFetch<PortCall[]>(`/port-calls?siteId=${encodeURIComponent(site.id)}`),
    apiFetch<PlanningPeriod[]>(
      `/planning-periods?siteId=${encodeURIComponent(site.id)}`,
    ),
    apiFetch<Position[]>(
      `/positions?organizationId=${encodeURIComponent(site.organization_id)}&siteId=${encodeURIComponent(site.id)}`,
    ),
    apiFetch<Vessel[]>(
      `/vessels?organizationId=${encodeURIComponent(site.organization_id)}`,
    ),
  ]);
  const periods = periodsResult.data ?? [];
  const range = resolveWeeklyRange(params.date, today);
  const isCurrentWeek = today >= range.startsOn && today <= range.endsOn;
  const visiblePeriods = periods.filter(
    (period) =>
      period.starts_on <= range.endsOn && period.ends_on >= range.startsOn,
  );
  const periodBundles = await Promise.all(
    visiblePeriods.map(async (period) => {
      const [versionsResult, requirementsResult] = await Promise.all([
        apiFetch<ScheduleVersion[]>(
          `/schedule-versions?planningPeriodId=${encodeURIComponent(period.id)}`,
        ),
        apiFetch<StaffingRequirement[]>(
          `/staffing-requirements?planningPeriodId=${encodeURIComponent(period.id)}`,
        ),
      ]);
      const versions = versionsResult.data ?? [];
      const publishedVersion = versions.find(
        (version) => version.status === 'published',
      );
      const draftVersion = versions.find(
        (version) => version.status === 'draft',
      );
      const displayedVersion =
        draftVersion ?? publishedVersion ?? versions.at(0);
      const contentResult = displayedVersion
        ? await apiFetch<ScheduleContent>(
            `/schedule-versions/${displayedVersion.id}`,
          )
        : { data: null, error: null };

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
  const activeBundle = periodBundles.at(0);
  const draftVersion = activeBundle?.versions.find(
    (version) => version.status === 'draft',
  );
  const publishedVersion = activeBundle?.versions.find(
    (version) => version.status === 'published',
  );
  const activeVersionId = activeBundle?.content?.version.id;
  const excelExportHref = activeVersionId
    ? `/tools/planning/export/${activeVersionId}`
    : `/tools/planning/export/week?${new URLSearchParams({
        date: range.startsOn,
        site: site.id,
      }).toString()}`;
  const hasError = Boolean(
    sitesResult.error ||
    agentsResult.error ||
    callsResult.error ||
    periodsResult.error ||
    positionsResult.error ||
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
                    href={weekHref(item.id, range.startsOn)}
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
            <a
              aria-label="Semaine précédente"
              className={styles.arrowButton}
              href={adjacentWeekHref(site.id, range, -1)}
              title="Semaine précédente"
            >
              ←
            </a>
            <div className={styles.weekLabel}>
              <strong>{compactRangeLabel(range)}</strong>
            </div>
            <a
              aria-label="Semaine suivante"
              className={styles.arrowButton}
              href={adjacentWeekHref(site.id, range, 1)}
              title="Semaine suivante"
            >
              →
            </a>
            {!isCurrentWeek ? (
              <a className={styles.todayButton} href={weekHref(site.id, today)}>
                <span className={styles.todayLong}>Aujourd’hui</span>
                <span className={styles.todayShort}>Auj.</span>
              </a>
            ) : null}
          </nav>
        </div>

        <details className={`${styles.menu} ${styles.actionsMenu}`}>
          <summary>Actions</summary>
          <div className={styles.actionsPanel}>
            {draftVersion || publishedVersion ? (
              <p className={styles.versionStatus}>
                {draftVersion
                  ? `Copie de travail v${draftVersion.version_number}`
                  : `Version publiée v${publishedVersion?.version_number}`}
              </p>
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
                  {draftVersion
                    ? 'Télécharger le brouillon en Excel'
                    : 'Télécharger le tableau en Excel'}
                </a>
                <PlanningExportButton
                  draftVersionNumber={draftVersion?.version_number}
                  siteName={site.name}
                  weekStart={range.startsOn}
                />
                {draftVersion && publishedVersion ? (
                  <a
                    className="secondary-button"
                    download
                    href={`/tools/planning/export/${publishedVersion.id}`}
                  >
                    Télécharger la version publiée en Excel
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

      <PlanningGrid
        agents={agentsResult.data ?? []}
        calls={callsResult.data ?? []}
        contents={periodBundles.flatMap((bundle) =>
          bundle.content ? [bundle.content] : [],
        )}
        key={`${site.id}:${range.startsOn}`}
        positions={positionsResult.data ?? []}
        range={range}
        requirements={periodBundles.flatMap((bundle) => bundle.requirements)}
        siteName={site.name.replace('Marseille ', '')}
        timeZone={site.timezone}
        vessels={vesselsResult.data ?? []}
      />
    </div>
  );
}

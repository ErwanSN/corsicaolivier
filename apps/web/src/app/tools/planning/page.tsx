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

function publicationLabel(
  publishedAt: string | null,
  timeZone: string,
): string {
  if (!publishedAt) return 'précédemment';

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(publishedAt));
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
    <div className="planning-print-root space-y-4">
      <header className="border-b border-zinc-300 pb-4">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Planning opérationnel
            </h1>
            <p className="planning-print-only mt-1 text-sm font-semibold">
              {rangeLabel(range)}
            </p>
          </div>
          {sites.length > 1 ? (
            <nav
              aria-label="Zones"
              className="flex flex-wrap gap-2"
              data-print-hide
            >
              {sites.map((item) => (
                <Link
                  aria-current={item.id === site.id ? 'page' : undefined}
                  className={
                    item.id === site.id
                      ? 'bg-zinc-950 px-3 py-2 text-sm font-semibold text-white'
                      : 'border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-950'
                  }
                  href={weekHref(item.id, range.startsOn)}
                  key={item.id}
                >
                  {item.name.replace('Marseille ', '')}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
      </header>

      <section
        className="border border-zinc-300 bg-zinc-50 px-4 py-3"
        data-print-hide
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <p className="text-base font-semibold text-zinc-950">
              Semaine du {rangeLabel(range)}
            </p>
            <nav
              aria-label="Changer de semaine"
              className="flex flex-wrap items-center gap-2"
            >
              <a
                className="secondary-button"
                href={adjacentWeekHref(site.id, range, -1)}
              >
                ← Semaine précédente
              </a>
              <a className="secondary-button" href={weekHref(site.id, today)}>
                Aujourd’hui
              </a>
              <a
                className="secondary-button"
                href={adjacentWeekHref(site.id, range, 1)}
              >
                Semaine suivante →
              </a>
            </nav>
            <form
              action="/tools/planning"
              className="flex flex-wrap items-end gap-2"
              method="get"
            >
              <input name="site" type="hidden" value={site.id} />
              <label
                className="grid gap-1 text-sm font-medium"
                htmlFor="week-date"
              >
                Aller à une date
                <input
                  className="border border-zinc-300 bg-white px-3 py-2 text-zinc-950"
                  defaultValue={range.startsOn}
                  id="week-date"
                  name="date"
                  type="date"
                />
              </label>
              <button className="secondary-button" type="submit">
                Afficher cette semaine
              </button>
            </form>
          </div>
          <div className="flex flex-wrap gap-2">
            <PlanningExportButton
              draftVersionNumber={draftVersion?.version_number}
              siteName={site.name}
              weekStart={range.startsOn}
            />
            {activeVersionId ? (
              <a
                className="secondary-button"
                download
                href={`/tools/planning/export/${activeVersionId}`}
              >
                {draftVersion
                  ? 'Exporter le brouillon en Excel'
                  : 'Exporter en Excel'}
              </a>
            ) : null}
            {draftVersion && publishedVersion ? (
              <a
                className="secondary-button"
                download
                href={`/tools/planning/export/${publishedVersion.id}`}
              >
                Exporter la version publiée en Excel
              </a>
            ) : null}
          </div>
        </div>
      </section>
      {params.saved === 'published' ? (
        <p
          className="border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900"
          role="status"
        >
          La semaine a été publiée. Un nouveau brouillon modifiable reste
          disponible dans ce calendrier.
        </p>
      ) : null}
      {params.error ? (
        <p
          className="border border-red-300 bg-red-50 p-3 text-sm text-red-900"
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

      {draftVersion ? (
        <aside
          className="border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          data-print-hide
        >
          <p className="font-semibold">
            {publishedVersion
              ? `Brouillon de modifications — version ${draftVersion.version_number}`
              : `Brouillon initial — version ${draftVersion.version_number}`}
          </p>
          <p className="mt-1 leading-6">
            {publishedVersion ? (
              <>
                La version {publishedVersion.version_number}, publiée{' '}
                {publicationLabel(publishedVersion.published_at, site.timezone)}
                , reste la référence. Toute modification, y compris de dernière
                minute, doit être republiée avec un motif.
              </>
            ) : (
              <>
                Aucun planning n’est encore publié pour cette période. Les
                exports portent explicitement la mention brouillon.
              </>
            )}
          </p>
        </aside>
      ) : null}

      {draftVersion ? (
        <details
          className="border border-zinc-300 bg-white p-4"
          data-print-hide
        >
          <summary className="cursor-pointer text-sm font-semibold">
            {publishedVersion
              ? 'Publier les modifications'
              : 'Publier cette semaine'}
          </summary>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Le motif est conservé avec la version pour assurer la traçabilité
            des changements.
          </p>
          <form
            action={publishSchedule}
            className="mt-3 flex flex-col gap-2 sm:flex-row"
          >
            <input
              name="organizationId"
              type="hidden"
              value={site.organization_id}
            />
            <input name="siteId" type="hidden" value={site.id} />
            <input name="scheduleId" type="hidden" value={draftVersion.id} />
            <input name="weekStart" type="hidden" value={range.startsOn} />
            <input
              className="field-input flex-1"
              minLength={3}
              name="reason"
              placeholder={
                publishedVersion
                  ? 'Motif des modifications'
                  : 'Motif de publication'
              }
              required
            />
            <button className="primary-button" type="submit">
              {publishedVersion
                ? 'Publier les modifications'
                : 'Confirmer la publication'}
            </button>
          </form>
        </details>
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

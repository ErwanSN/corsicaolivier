import Link from 'next/link';

import { SiteSwitcher } from '../../../../components/site-switcher';
import { PlatformSelect } from '../../../../components/ui/platform-select';
import { apiFetch } from '../../../../lib/api/server';
import type {
  Agent,
  AgentSearchPage,
  PositionSearchPage,
  Site,
} from '../../../../lib/api/types';
import { currentDateInTimeZone } from '../../../../lib/dates';
import { orderSites } from '../../../../lib/sites';
import { createAgent, reactivateAgent, updateAgent } from '../actions';
import { AgentPositionQuickActions } from './agent-position-quick-actions';

type AgentsPageProps = Readonly<{
  searchParams: Promise<{
    site?: string;
    add?: string;
    edit?: string;
    error?: string;
    page?: string;
    q?: string;
    saved?: string;
    status?: string;
  }>;
}>;

const AGENTS_PER_PAGE = 25;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AgentListHrefOptions = Readonly<{
  edit?: string;
  page?: number;
  query: string;
  siteId: string;
  status: 'active' | 'all' | 'inactive';
}>;

function agentListHref({
  edit,
  page,
  query,
  siteId,
  status,
}: AgentListHrefOptions): string {
  const params = new URLSearchParams({ site: siteId, status });
  if (query) params.set('q', query);
  if (page && page > 1) params.set('page', String(page));
  if (edit) params.set('edit', edit);
  return `/tools/planning/agents?${params.toString()}`;
}

function visibleEmployeeNumber(agent: Agent): string {
  return agent.employee_number.startsWith('AG-')
    ? 'Matricule à renseigner'
    : agent.employee_number;
}

export default async function AgentsPage({ searchParams }: AgentsPageProps) {
  const params = await searchParams;
  const sitesResult = await apiFetch<Site[]>('/sites');
  const sites = orderSites(sitesResult.data ?? []);
  const selectedSite =
    sites.find((site) => site.id === params.site) ?? sites.at(0);
  const query = params.q?.trim().slice(0, 80) ?? '';
  const status: AgentListHrefOptions['status'] =
    params.status === 'all' || params.status === 'inactive'
      ? params.status
      : 'active';
  const parsedPage = Number.parseInt(params.page ?? '1', 10);
  const requestedPage = Number.isFinite(parsedPage)
    ? Math.max(1, parsedPage)
    : 1;
  const agentSearchParams = selectedSite
    ? new URLSearchParams({
        siteId: selectedSite.id,
        page: String(requestedPage),
        pageSize: String(AGENTS_PER_PAGE),
        status,
      })
    : null;
  if (query) agentSearchParams?.set('q', query);
  if (params.edit && UUID_PATTERN.test(params.edit)) {
    agentSearchParams?.set('includeIds', params.edit);
  }
  const [agentsResult, positionsResult] = selectedSite
    ? await Promise.all([
        apiFetch<AgentSearchPage>(`/agents/search?${agentSearchParams}`),
        apiFetch<PositionSearchPage>(
          `/positions?organizationId=${encodeURIComponent(selectedSite.organization_id)}&siteId=${encodeURIComponent(selectedSite.id)}&pageSize=200`,
        ),
      ])
    : [
        { data: null, error: sitesResult.error ?? 'Aucun site disponible.' },
        { data: null, error: sitesResult.error },
      ];
  const pageData = agentsResult.data;
  const editedAgent = pageData?.included.find(
    (agent) => agent.id === params.edit,
  );
  const paginatedAgents = editedAgent
    ? [editedAgent, ...(pageData?.items ?? [])]
    : (pageData?.items ?? []);
  const positions = (positionsResult.data?.items ?? []).filter(
    (position) => position.active,
  );
  const today = currentDateInTimeZone(selectedSite?.timezone ?? 'Europe/Paris');
  const activeCount = pageData?.counts.active ?? 0;
  const inactiveCount = pageData?.counts.inactive ?? 0;
  const resultCount = pageData?.total ?? 0;
  const pageCount = pageData?.totalPages ?? 1;
  const currentPage = pageData?.page ?? requestedPage;
  const pageSize = pageData?.pageSize ?? AGENTS_PER_PAGE;
  const pageStart = (currentPage - 1) * pageSize;
  const currentListHref = selectedSite
    ? agentListHref({
        page: currentPage,
        query,
        siteId: selectedSite.id,
        status,
      })
    : '/tools/planning/agents';

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Collaborateurs
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {activeCount} actif{activeCount > 1 ? 's' : ''}
            {inactiveCount
              ? ` · ${inactiveCount} inactif${inactiveCount > 1 ? 's' : ''}`
              : ''}
          </p>
        </div>
        {selectedSite ? (
          <Link
            className="primary-button"
            href={`/tools/planning/agents?site=${selectedSite.id}&add=1`}
          >
            Ajouter un collaborateur
          </Link>
        ) : null}
      </header>

      {params.saved ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {params.saved === 'created'
            ? 'Agent ajouté.'
            : params.saved === 'rule'
              ? 'Poste ajouté au collaborateur.'
              : 'Modifications enregistrées.'}
        </p>
      ) : null}

      {params.error ? (
        <p
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          Impossible d’enregistrer. Vérifiez les informations saisies.
        </p>
      ) : null}

      {sites.length > 1 ? (
        <SiteSwitcher
          path="/tools/planning/agents"
          selectedSiteId={selectedSite?.id ?? ''}
          sites={sites}
        />
      ) : null}

      {params.add && selectedSite ? (
        <section className="rounded-2xl border border-zinc-300 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Nouveau collaborateur</h2>
            <Link
              className="text-sm text-zinc-500 hover:text-zinc-950"
              href={`/tools/planning/agents?site=${selectedSite.id}`}
            >
              Annuler et revenir à la liste
            </Link>
          </div>
          <form
            action={createAgent}
            className="mt-4 grid gap-3 lg:grid-cols-[2fr_1fr_auto]"
          >
            <input
              name="organizationId"
              type="hidden"
              value={selectedSite.organization_id}
            />
            <div className="space-y-1.5">
              <label className="field-label" htmlFor="newAgentName">
                Nom et prénom
              </label>
              <input
                autoFocus
                className="field-input"
                id="newAgentName"
                maxLength={160}
                name="displayName"
                placeholder="Ex. Marie Dupont"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="field-label" htmlFor="newAgentSite">
                Zone
              </label>
              <PlatformSelect
                className="field-input"
                defaultValue={selectedSite.id}
                id="newAgentSite"
                name="primarySiteId"
                required
              >
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name.replace('Marseille ', '')}
                  </option>
                ))}
              </PlatformSelect>
            </div>
            <div className="flex items-end">
              <button className="primary-button w-full" type="submit">
                Ajouter le collaborateur
              </button>
            </div>
            <details className="lg:col-span-3">
              <summary className="w-fit cursor-pointer text-sm font-medium text-zinc-500 hover:text-zinc-950">
                Matricule et date d’entrée
              </summary>
              <div className="mt-3 grid gap-3 border-t border-zinc-100 pt-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="field-label" htmlFor="newEmployeeNumber">
                    Matricule, s’il est connu
                  </label>
                  <input
                    className="field-input"
                    id="newEmployeeNumber"
                    maxLength={32}
                    name="employeeNumber"
                    pattern="[A-Za-z0-9._-]+"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="field-label" htmlFor="newAgentHiredOn">
                    Date d’entrée
                  </label>
                  <input
                    className="field-input"
                    id="newAgentHiredOn"
                    name="hiredOn"
                    type="date"
                  />
                </div>
              </div>
            </details>
          </form>
        </section>
      ) : null}

      <section className="overflow-hidden border border-zinc-300 bg-white">
        <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3">
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            {sites.length > 1 ? '2.' : '1.'} Rechercher puis cliquer sur une
            personne pour la modifier
          </p>
        </div>
        <form
          className="flex flex-col gap-3 border-b border-zinc-200 p-4 sm:flex-row"
          method="get"
        >
          {selectedSite ? (
            <input name="site" type="hidden" value={selectedSite.id} />
          ) : null}
          <label className="sr-only" htmlFor="agentSearch">
            Rechercher un agent
          </label>
          <input
            className="field-input min-w-0 flex-1"
            defaultValue={query}
            id="agentSearch"
            name="q"
            placeholder="Rechercher un nom ou un matricule"
          />
          <label className="sr-only" htmlFor="agentStatus">
            Statut
          </label>
          <PlatformSelect
            className="field-input sm:w-36"
            defaultValue={status}
            id="agentStatus"
            name="status"
          >
            <option value="active">Actifs ({activeCount})</option>
            <option value="inactive">Inactifs ({inactiveCount})</option>
            <option value="all">Tous ({activeCount + inactiveCount})</option>
          </PlatformSelect>
          <button className="secondary-button" type="submit">
            Rechercher
          </button>
        </form>

        {resultCount ? (
          <p
            aria-live="polite"
            className="border-b border-zinc-200 px-4 py-2 text-xs text-zinc-600"
          >
            {pageStart + 1}–{Math.min(pageStart + pageSize, resultCount)} sur{' '}
            {resultCount} collaborateur{resultCount > 1 ? 's' : ''}
          </p>
        ) : null}

        {agentsResult.error || positionsResult.error ? (
          <p className="m-4 text-sm text-amber-800" role="alert">
            Certaines données des collaborateurs n’ont pas pu être chargées.
          </p>
        ) : null}
        {positionsResult.data?.hasMore ? (
          <p className="m-4 text-sm text-amber-800" role="alert">
            Les actions rapides proposent 200 postes sur{' '}
            {positionsResult.data.total}. Les autres restent accessibles depuis
            les réglages.
          </p>
        ) : null}

        {paginatedAgents.length ? (
          <div className="divide-y divide-zinc-100">
            {paginatedAgents.map((agent) =>
              params.edit !== agent.id ? (
                <Link
                  className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-zinc-50 focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-red-600"
                  href={
                    selectedSite
                      ? agentListHref({
                          edit: agent.id,
                          page: currentPage,
                          query,
                          siteId: selectedSite.id,
                          status,
                        })
                      : `/tools/planning/agents?edit=${agent.id}`
                  }
                  key={agent.id}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {agent.display_name}
                    </span>
                    <span className="block truncate text-xs text-zinc-500">
                      {visibleEmployeeNumber(agent)}
                    </span>
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      agent.active
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-zinc-100 text-zinc-500'
                    }`}
                  >
                    {agent.active ? 'Actif' : 'Inactif'}
                  </span>
                  <span className="text-sm font-medium text-red-700">
                    Modifier →
                  </span>
                </Link>
              ) : (
                <section
                  aria-labelledby={`agent-title-${agent.id}`}
                  key={agent.id}
                >
                  <div className="flex min-h-16 items-center gap-3 bg-zinc-50 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <h2
                        className="truncate font-semibold"
                        id={`agent-title-${agent.id}`}
                      >
                        {agent.display_name}
                      </h2>
                      <span className="block truncate text-xs text-zinc-500">
                        {visibleEmployeeNumber(agent)}
                      </span>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        agent.active
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-zinc-100 text-zinc-500'
                      }`}
                    >
                      {agent.active ? 'Actif' : 'Inactif'}
                    </span>
                    <Link className="secondary-button" href={currentListHref}>
                      Fermer
                    </Link>
                  </div>

                  <form
                    action={updateAgent}
                    className="grid gap-4 border-t border-zinc-100 bg-zinc-50 p-5 md:grid-cols-2 xl:grid-cols-3"
                  >
                    <input name="agentId" type="hidden" value={agent.id} />
                    <input
                      name="organizationId"
                      type="hidden"
                      value={agent.organization_id}
                    />
                    <div className="space-y-1.5">
                      <label
                        className="field-label"
                        htmlFor={`agentName-${agent.id}`}
                      >
                        Nom affiché dans le planning
                      </label>
                      <input
                        className="field-input"
                        defaultValue={agent.display_name}
                        id={`agentName-${agent.id}`}
                        maxLength={160}
                        name="displayName"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label
                        className="field-label"
                        htmlFor={`agentSite-${agent.id}`}
                      >
                        Zone
                      </label>
                      <PlatformSelect
                        className="field-input"
                        defaultValue={agent.primary_site_id}
                        id={`agentSite-${agent.id}`}
                        name="primarySiteId"
                        required
                      >
                        {sites.map((site) => (
                          <option key={site.id} value={site.id}>
                            {site.name.replace('Marseille ', '')}
                          </option>
                        ))}
                      </PlatformSelect>
                    </div>
                    <div className="space-y-1.5">
                      <label
                        className="field-label"
                        htmlFor={`employeeNumber-${agent.id}`}
                      >
                        Matricule
                      </label>
                      <input
                        className="field-input font-mono"
                        defaultValue={agent.employee_number}
                        id={`employeeNumber-${agent.id}`}
                        maxLength={32}
                        name="employeeNumber"
                        pattern="[A-Za-z0-9._-]+"
                        required
                      />
                      <p className="text-xs text-zinc-500">
                        Utilisé pour les imports et le rapprochement RH.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <label
                        className="field-label"
                        htmlFor={`hiredOn-${agent.id}`}
                      >
                        Date d’entrée
                      </label>
                      <input
                        className="field-input"
                        defaultValue={agent.hired_on ?? ''}
                        id={`hiredOn-${agent.id}`}
                        name="hiredOn"
                        type="date"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label
                        className="field-label"
                        htmlFor={`leftOn-${agent.id}`}
                      >
                        Date de sortie
                      </label>
                      <input
                        className="field-input"
                        defaultValue={agent.left_on ?? ''}
                        id={`leftOn-${agent.id}`}
                        name="leftOn"
                        type="date"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <span className="field-label">
                        Statut dans le planning
                      </span>
                      <label className="flex h-11 items-center gap-3 border border-zinc-400 bg-white px-3.5 text-sm">
                        <input
                          className="size-4 accent-red-600"
                          defaultChecked={agent.active}
                          name="active"
                          type="checkbox"
                        />
                        <strong className="font-medium">Agent actif</strong>
                      </label>
                    </div>
                    <details className="md:col-span-2 xl:col-span-3">
                      <summary className="w-fit cursor-pointer text-sm font-medium text-zinc-600 hover:text-zinc-950">
                        Préparer un départ
                      </summary>
                      <div className="mt-3 max-w-xl space-y-1.5 border-t border-zinc-200 pt-3">
                        <label
                          className="field-label"
                          htmlFor={`offboardingReason-${agent.id}`}
                        >
                          Motif du départ
                        </label>
                        <textarea
                          className="field-input min-h-20"
                          id={`offboardingReason-${agent.id}`}
                          maxLength={500}
                          minLength={3}
                          name="offboardingReason"
                          placeholder="Requis pour désactiver l’agent ou modifier sa date de sortie"
                        />
                        <p className="text-xs text-zinc-500">
                          Les accès restent inchangés jusqu’à la date effective.
                        </p>
                      </div>
                    </details>
                    <div className="flex flex-wrap items-center justify-end gap-3 md:col-span-2 xl:col-span-3">
                      <Link
                        className="secondary-button"
                        href={`/tools/planning/agents/${agent.id}?site=${encodeURIComponent(agent.primary_site_id)}`}
                      >
                        Ouvrir la fiche complète
                      </Link>
                      <button className="primary-button" type="submit">
                        Enregistrer
                      </button>
                    </div>
                  </form>

                  {!agent.active ? (
                    <details className="border-t border-zinc-200 bg-white px-5 py-4">
                      <summary className="w-fit cursor-pointer text-sm font-semibold text-zinc-700">
                        Réactiver ce collaborateur
                      </summary>
                      <form
                        action={reactivateAgent}
                        className="mt-3 flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-end"
                      >
                        <input name="agentId" type="hidden" value={agent.id} />
                        <input
                          name="organizationId"
                          type="hidden"
                          value={agent.organization_id}
                        />
                        <input
                          name="siteId"
                          type="hidden"
                          value={agent.primary_site_id}
                        />
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <label
                            className="field-label"
                            htmlFor={`reactivationReason-${agent.id}`}
                          >
                            Motif de réactivation
                          </label>
                          <input
                            className="field-input"
                            id={`reactivationReason-${agent.id}`}
                            maxLength={500}
                            minLength={3}
                            name="reason"
                            required
                          />
                        </div>
                        <button className="secondary-button" type="submit">
                          Réactiver avec accès minimal
                        </button>
                      </form>
                    </details>
                  ) : null}

                  <AgentPositionQuickActions
                    agentId={agent.id}
                    organizationId={agent.organization_id}
                    positions={positions}
                    siteId={agent.primary_site_id}
                    validFrom={today}
                  />
                </section>
              ),
            )}

            {pageCount > 1 && selectedSite ? (
              <nav
                aria-label="Pagination des collaborateurs"
                className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                {currentPage > 1 ? (
                  <Link
                    className="secondary-button"
                    href={agentListHref({
                      page: currentPage - 1,
                      query,
                      siteId: selectedSite.id,
                      status,
                    })}
                    rel="prev"
                  >
                    ← Précédents
                  </Link>
                ) : (
                  <span />
                )}
                <span className="order-first w-full text-center text-sm text-zinc-600 sm:order-none sm:w-auto">
                  Page {currentPage} sur {pageCount}
                </span>
                {currentPage < pageCount ? (
                  <Link
                    className="secondary-button"
                    href={agentListHref({
                      page: currentPage + 1,
                      query,
                      siteId: selectedSite.id,
                      status,
                    })}
                    rel="next"
                  >
                    Suivants →
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </div>
        ) : (
          <p className="p-10 text-center text-sm text-zinc-500">
            Aucun agent ne correspond à cette recherche.
          </p>
        )}
      </section>
    </div>
  );
}

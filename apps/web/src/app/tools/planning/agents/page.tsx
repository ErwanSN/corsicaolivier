import Link from 'next/link';

import { SiteSwitcher } from '../../../../components/site-switcher';
import { PlatformSelect } from '../../../../components/ui/platform-select';
import { apiFetch } from '../../../../lib/api/server';
import type { Agent, Site } from '../../../../lib/api/types';
import { orderSites } from '../../../../lib/sites';
import { createAgent, updateAgent } from '../actions';

type AgentsPageProps = Readonly<{
  searchParams: Promise<{
    site?: string;
    add?: string;
    edit?: string;
    error?: string;
    q?: string;
    saved?: string;
    status?: string;
  }>;
}>;

function visibleEmployeeNumber(agent: Agent): string {
  return agent.employee_number.startsWith('DOC-') ||
    agent.employee_number.startsWith('AG-')
    ? 'Matricule à renseigner'
    : agent.employee_number;
}

export default async function AgentsPage({ searchParams }: AgentsPageProps) {
  const params = await searchParams;
  const sitesResult = await apiFetch<Site[]>('/sites');
  const sites = orderSites(sitesResult.data ?? []);
  const selectedSite =
    sites.find((site) => site.id === params.site) ?? sites.at(0);
  const agentsResult = selectedSite
    ? await apiFetch<Agent[]>(
        `/agents?siteId=${encodeURIComponent(selectedSite.id)}`,
      )
    : { data: [] as Agent[], error: sitesResult.error };
  const agents = agentsResult.data ?? [];
  const query = params.q?.trim().toLocaleLowerCase('fr-FR') ?? '';
  const status = ['all', 'inactive'].includes(params.status ?? '')
    ? params.status
    : 'active';
  const visibleAgents = agents.filter((agent) => {
    const matchesStatus =
      status === 'all' || (status === 'active' ? agent.active : !agent.active);
    const matchesQuery =
      !query ||
      agent.display_name.toLocaleLowerCase('fr-FR').includes(query) ||
      agent.employee_number.toLocaleLowerCase('fr-FR').includes(query);
    return matchesStatus && matchesQuery;
  });
  const activeCount = agents.filter((agent) => agent.active).length;
  const inactiveCount = agents.length - activeCount;

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
            : 'Modifications enregistrées.'}
        </p>
      ) : null}

      {params.error ? (
        <p
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          Impossible d’enregistrer. Vérifiez le nom, le matricule et les dates.
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
            defaultValue={params.q}
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
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
            <option value="all">Tous</option>
          </PlatformSelect>
          <button className="secondary-button" type="submit">
            Rechercher
          </button>
        </form>

        {agentsResult.error ? (
          <p className="m-4 text-sm text-amber-800" role="alert">
            {agentsResult.error}
          </p>
        ) : null}

        {visibleAgents.length ? (
          <div className="divide-y divide-zinc-100">
            {visibleAgents.map((agent) => (
              <details key={agent.id} open={params.edit === agent.id}>
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-zinc-50 [&::-webkit-details-marker]:hidden">
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
                  <span
                    aria-hidden="true"
                    className="text-sm font-medium text-red-700"
                  >
                    Ouvrir et modifier ↓
                  </span>
                </summary>

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
                    <span className="field-label">Statut dans le planning</span>
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
                  <div className="flex flex-wrap items-center justify-end gap-3 md:col-span-2 xl:col-span-3">
                    <Link
                      className="secondary-button"
                      href={`/tools/planning/agents/${agent.id}`}
                    >
                      Gérer ses horaires, compétences et préférences
                    </Link>
                    <button className="primary-button" type="submit">
                      Enregistrer
                    </button>
                  </div>
                </form>
              </details>
            ))}
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

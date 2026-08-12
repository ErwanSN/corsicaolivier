import Link from 'next/link';

import { HoursInput } from '../../../../components/ui/hours-input';
import { apiFetch } from '../../../../lib/api/server';
import type {
  AgentSearchPage,
  AgentGroup,
  GroupMembership,
  Site,
} from '../../../../lib/api/types';
import { currentDateInTimeZone } from '../../../../lib/dates';
import { orderSites } from '../../../../lib/sites';
import {
  addGroupMember,
  createGroup,
  endGroupMembership,
  setGroupHourTargets,
} from '../actions';

type GroupsPageProps = Readonly<{
  searchParams: Promise<{
    add?: string;
    agentPage?: string;
    agentQ?: string;
    group?: string;
    error?: string;
    saved?: string;
    site?: string;
  }>;
}>;

export default async function GroupsPage({ searchParams }: GroupsPageProps) {
  const params = await searchParams;
  const sitesResult = await apiFetch<Site[]>('/sites');
  const sites = orderSites(sitesResult.data ?? []);
  const site = sites.find((item) => item.id === params.site) ?? sites.at(0);
  const groupsResult = site
    ? await apiFetch<AgentGroup[]>(
        `/groups?siteId=${encodeURIComponent(site.id)}`,
      )
    : { data: [] as AgentGroup[], error: sitesResult.error };
  const groups = groupsResult.data ?? [];
  const organizationId = site?.organization_id;
  const selectedGroup = groups.find((group) => group.id === params.group);
  const today = currentDateInTimeZone(site?.timezone ?? 'Europe/Paris');
  const agentQuery = params.agentQ?.trim().slice(0, 80) ?? '';
  const requestedAgentPage = Math.max(
    1,
    Number.parseInt(params.agentPage ?? '1', 10) || 1,
  );
  const membersResult = selectedGroup
    ? await apiFetch<GroupMembership[]>(`/groups/${selectedGroup.id}/members`)
    : { data: [] as GroupMembership[], error: null };
  const members = (membersResult.data ?? []).filter(
    (membership) =>
      membership.effective_from <= today &&
      (!membership.effective_until || membership.effective_until > today),
  );
  const memberAgentIds = new Set(
    members.map((membership) => membership.agent_id),
  );
  const memberIdChunks = Array.from(
    {
      length: Math.max(1, Math.ceil(memberAgentIds.size / 200)),
    },
    (_, index) => [...memberAgentIds].slice(index * 200, (index + 1) * 200),
  );
  const agentResults =
    organizationId && selectedGroup
      ? await Promise.all(
          memberIdChunks.map((includeIds, index) => {
            const search = new URLSearchParams({
              organizationId,
              page: String(index === 0 ? requestedAgentPage : 1),
              pageSize: index === 0 ? '10' : '1',
              siteId: site.id,
              status: 'active',
            });
            if (agentQuery && index === 0) search.set('q', agentQuery);
            if (includeIds.length)
              search.set('includeIds', includeIds.join(','));
            return apiFetch<AgentSearchPage>(`/agents/search?${search}`);
          }),
        )
      : [];
  const agentPage = agentResults.at(0)?.data;
  const agents = [
    ...new Map(
      [
        ...(agentPage?.items ?? []),
        ...agentResults.flatMap((result) => result.data?.included ?? []),
      ].map((agent) => [agent.id, agent]),
    ).values(),
  ];
  const availableAgents = (agentPage?.items ?? []).filter(
    (agent) => !memberAgentIds.has(agent.id),
  );
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  const agentLoadFailed = agentResults.some((result) => result.error);
  const weeklyTargetMinutes = selectedGroup?.weekly_target_minutes ?? null;
  const monthlyTargetMinutes = selectedGroup?.monthly_target_minutes ?? null;
  const groupsHref = `/tools/planning/groupes?site=${site?.id ?? ''}`;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            aria-label="Retour aux réglages"
            className="secondary-button mb-4"
            href={`/tools/planning/referentiels?site=${site?.id ?? ''}`}
          >
            ← Retour aux réglages
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">
            Groupes de collaborateurs
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Rassemblez les collaborateurs qui travaillent ensemble.
          </p>
        </div>
        {organizationId && !params.add && !selectedGroup ? (
          <Link className="primary-button" href={`${groupsHref}&add=1`}>
            Créer un groupe
          </Link>
        ) : null}
      </header>

      {params.saved ? (
        <p className="border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Enregistré.
        </p>
      ) : null}
      {params.error ? (
        <p
          className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          Impossible d’enregistrer.
        </p>
      ) : null}

      {params.add && organizationId ? (
        <section className="border border-zinc-400 bg-white p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Créer un groupe</h2>
            <Link
              className="text-sm font-medium text-zinc-500 hover:text-zinc-950"
              href={groupsHref}
            >
              Annuler et revenir à la liste
            </Link>
          </div>
          <form
            action={createGroup}
            className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <input name="organizationId" type="hidden" value={organizationId} />
            <input name="siteId" type="hidden" value={site?.id ?? ''} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <label className="field-label" htmlFor="groupName">
                Nom du groupe
              </label>
              <input
                autoFocus
                className="field-input"
                id="groupName"
                maxLength={120}
                name="name"
                placeholder="Ex. Équipe du matin"
                required
              />
            </div>
            <button className="primary-button" type="submit">
              Créer le groupe
            </button>
          </form>
        </section>
      ) : null}

      {selectedGroup && organizationId ? (
        <section className="border border-zinc-300 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-300 bg-zinc-50 px-4 py-3">
            <div>
              <h2 className="font-semibold">{selectedGroup.name}</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {members.length} collaborateur{members.length > 1 ? 's' : ''}
              </p>
            </div>
            <Link className="secondary-button" href={groupsHref}>
              ← Tous les groupes
            </Link>
          </div>

          <div className="border-b border-zinc-200 bg-zinc-50/60 p-4 sm:p-5">
            <div>
              <h3 className="font-semibold">Objectifs horaires</h3>
              <p className="mt-1 text-sm text-zinc-500">
                Définissez le temps de travail attendu pour cette équipe.
              </p>
            </div>

            <form action={setGroupHourTargets} className="mt-5">
              <input
                name="organizationId"
                type="hidden"
                value={organizationId}
              />
              <input name="groupId" type="hidden" value={selectedGroup.id} />
              <input name="siteId" type="hidden" value={site?.id ?? ''} />

              <div className="grid items-start gap-4 sm:grid-cols-2">
                <HoursInput
                  defaultValue={
                    weeklyTargetMinutes === null ? '' : weeklyTargetMinutes / 60
                  }
                  description="Exemple courant : 35 heures"
                  id="weeklyHours"
                  label="Par semaine"
                  max="168"
                  min="0"
                  name="weeklyHours"
                  placeholder="35"
                  step="0.25"
                />
                <HoursInput
                  defaultValue={
                    monthlyTargetMinutes === null
                      ? ''
                      : monthlyTargetMinutes / 60
                  }
                  description="Exemple courant : 151,67 heures"
                  id="monthlyHours"
                  label="Par mois"
                  max="744"
                  min="0"
                  name="monthlyHours"
                  placeholder="151,67"
                  step="0.01"
                />
              </div>

              <div className="mt-5 flex flex-col gap-3 border-t border-zinc-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-2xl text-xs leading-5 text-zinc-500">
                  Laissez un champ vide pour ne pas définir d’objectif. Ces
                  valeurs s’appliquent aux collaborateurs dont ce groupe est
                  l’équipe principale.
                </p>
                <button className="primary-button shrink-0" type="submit">
                  Enregistrer les objectifs
                </button>
              </div>
            </form>
          </div>

          <details
            className="border-b border-zinc-200 p-4"
            open={Boolean(agentQuery) || requestedAgentPage > 1}
          >
            <summary className="cursor-pointer text-sm font-semibold">
              + Ajouter un collaborateur
            </summary>
            <form className="mt-4 flex flex-col gap-2 sm:flex-row" method="get">
              <input name="site" type="hidden" value={site?.id ?? ''} />
              <input name="group" type="hidden" value={selectedGroup.id} />
              <input
                autoComplete="off"
                className="field-input min-w-0 flex-1"
                defaultValue={agentQuery}
                maxLength={80}
                name="agentQ"
                placeholder="Nom ou matricule"
                type="search"
              />
              <button className="secondary-button" type="submit">
                Rechercher
              </button>
              {agentQuery ? (
                <Link
                  className="secondary-button"
                  href={`${groupsHref}&group=${selectedGroup.id}`}
                >
                  Effacer
                </Link>
              ) : null}
            </form>

            {agentLoadFailed ? (
              <p className="mt-3 text-sm text-red-700" role="alert">
                La recherche de collaborateurs est momentanément indisponible.
              </p>
            ) : availableAgents.length ? (
              <div className="mt-3 divide-y divide-zinc-100 border border-zinc-200">
                {availableAgents.map((agent) => (
                  <form
                    action={addGroupMember}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                    key={agent.id}
                  >
                    <input
                      name="organizationId"
                      type="hidden"
                      value={organizationId}
                    />
                    <input
                      name="groupId"
                      type="hidden"
                      value={selectedGroup.id}
                    />
                    <input name="siteId" type="hidden" value={site.id} />
                    <input name="effectiveFrom" type="hidden" value={today} />
                    <input name="isPrimary" type="hidden" value="true" />
                    <input name="agentId" type="hidden" value={agent.id} />
                    <span className="min-w-0">
                      <strong className="block truncate text-sm">
                        {agent.display_name}
                      </strong>
                      <span className="text-xs text-zinc-500">
                        {agent.employee_number}
                      </span>
                    </span>
                    <button className="secondary-button shrink-0" type="submit">
                      Ajouter
                    </button>
                  </form>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">
                {agentPage?.total
                  ? 'Les résultats de cette page appartiennent déjà au groupe.'
                  : 'Aucun collaborateur actif ne correspond.'}
              </p>
            )}

            {(agentPage?.totalPages ?? 1) > 1 ? (
              <nav
                aria-label="Pagination des collaborateurs disponibles"
                className="mt-3 flex items-center justify-between gap-2 text-xs"
              >
                {agentPage && agentPage.page > 1 ? (
                  <Link
                    className="secondary-button"
                    href={`${groupsHref}&group=${selectedGroup.id}&agentPage=${agentPage.page - 1}${agentQuery ? `&agentQ=${encodeURIComponent(agentQuery)}` : ''}`}
                  >
                    ← Précédents
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-zinc-500">
                  {agentPage?.page} / {agentPage?.totalPages}
                </span>
                {agentPage?.hasMore ? (
                  <Link
                    className="secondary-button"
                    href={`${groupsHref}&group=${selectedGroup.id}&agentPage=${agentPage.page + 1}${agentQuery ? `&agentQ=${encodeURIComponent(agentQuery)}` : ''}`}
                  >
                    Suivants →
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </details>

          {members.length ? (
            <div className="divide-y divide-zinc-200">
              {members.map((membership, index) => (
                <article
                  className="flex items-center gap-3 px-4 py-4"
                  key={membership.id}
                >
                  <span className="grid size-8 shrink-0 place-items-center border border-zinc-300 bg-zinc-50 text-sm font-bold text-zinc-600">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 font-semibold">
                    {agentById.get(membership.agent_id)?.display_name ??
                      'Collaborateur indisponible'}
                  </span>
                  {membership.is_primary ? (
                    <span className="shrink-0 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
                      Groupe principal
                    </span>
                  ) : null}
                  <form action={endGroupMembership}>
                    <input
                      name="organizationId"
                      type="hidden"
                      value={organizationId}
                    />
                    <input
                      name="groupId"
                      type="hidden"
                      value={selectedGroup.id}
                    />
                    <input name="siteId" type="hidden" value={site?.id ?? ''} />
                    <input
                      name="membershipId"
                      type="hidden"
                      value={membership.id}
                    />
                    <input name="effectiveUntil" type="hidden" value={today} />
                    <button className="secondary-button" type="submit">
                      Retirer
                    </button>
                  </form>
                </article>
              ))}
            </div>
          ) : (
            <p className="px-4 py-12 text-center text-sm text-zinc-500">
              Ce groupe est vide.
            </p>
          )}
        </section>
      ) : groups.length ? (
        <section className="border border-zinc-300 bg-white">
          <div className="border-b border-zinc-300 bg-zinc-50 px-4 py-3">
            <h2 className="font-semibold">
              Groupes existants ({groups.length})
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Choisissez un groupe pour gérer ses collaborateurs.
            </p>
          </div>
          <div className="divide-y divide-zinc-200">
            {groups.map((group, index) => (
              <article
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center"
                key={group.id}
              >
                <span className="grid size-8 shrink-0 place-items-center border border-zinc-300 bg-zinc-50 text-sm font-bold text-zinc-600">
                  {index + 1}
                </span>
                <h3 className="min-w-0 flex-1 font-semibold">{group.name}</h3>
                <Link
                  className="secondary-button"
                  href={`${groupsHref}&group=${group.id}`}
                >
                  Gérer les collaborateurs →
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="grid min-h-64 place-items-center border border-dashed border-zinc-400 text-sm text-zinc-600">
          Aucun groupe. Cliquez sur « Créer un groupe ».
        </section>
      )}
    </div>
  );
}

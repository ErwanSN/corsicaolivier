import Link from 'next/link';

import { HoursInput } from '../../../../components/ui/hours-input';
import { PlatformSelect } from '../../../../components/ui/platform-select';
import { apiFetch } from '../../../../lib/api/server';
import type {
  Agent,
  AgentGroup,
  GroupMembership,
  Site,
} from '../../../../lib/api/types';
import { currentParisDate } from '../../../../lib/dates';
import {
  addGroupMember,
  createGroup,
  endGroupMembership,
  setGroupHourTargets,
} from '../actions';

type GroupsPageProps = Readonly<{
  searchParams: Promise<{
    add?: string;
    group?: string;
    error?: string;
    saved?: string;
  }>;
}>;

export default async function GroupsPage({ searchParams }: GroupsPageProps) {
  const params = await searchParams;
  const [sitesResult, groupsResult] = await Promise.all([
    apiFetch<Site[]>('/sites'),
    apiFetch<AgentGroup[]>('/groups'),
  ]);
  const sites = sitesResult.data ?? [];
  const groups = groupsResult.data ?? [];
  const organizationId =
    groups.at(0)?.organization_id ?? sites.at(0)?.organization_id;
  const selectedGroup = groups.find((group) => group.id === params.group);
  const today = currentParisDate();

  const [agentsResult, membersResult] = organizationId
    ? await Promise.all([
        apiFetch<Agent[]>(
          `/agents?organizationId=${encodeURIComponent(organizationId)}`,
        ),
        selectedGroup
          ? apiFetch<GroupMembership[]>(`/groups/${selectedGroup.id}/members`)
          : Promise.resolve({ data: [] as GroupMembership[], error: null }),
      ])
    : [
        { data: [] as Agent[], error: sitesResult.error },
        { data: [] as GroupMembership[], error: groupsResult.error },
      ];

  const agents = agentsResult.data ?? [];
  const members = (membersResult.data ?? []).filter(
    (membership) =>
      membership.effective_from <= today &&
      (!membership.effective_until || membership.effective_until > today),
  );
  const memberAgentIds = new Set(
    members.map((membership) => membership.agent_id),
  );
  const availableAgents = agents.filter(
    (agent) => agent.active && !memberAgentIds.has(agent.id),
  );
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  const weeklyTargetMinutes = selectedGroup?.weekly_target_minutes ?? null;
  const monthlyTargetMinutes = selectedGroup?.monthly_target_minutes ?? null;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Groupes de collaborateurs
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Rassemblez les collaborateurs qui travaillent ensemble.
          </p>
        </div>
        {organizationId && !params.add && !selectedGroup ? (
          <Link className="primary-button" href="/tools/planning/groupes?add=1">
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
              href="/tools/planning/groupes"
            >
              Annuler et revenir à la liste
            </Link>
          </div>
          <form
            action={createGroup}
            className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <input name="organizationId" type="hidden" value={organizationId} />
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
            <Link className="secondary-button" href="/tools/planning/groupes">
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

          {availableAgents.length ? (
            <form
              action={addGroupMember}
              className="flex flex-col gap-3 border-b border-zinc-200 p-4 sm:flex-row sm:items-end"
            >
              <input
                name="organizationId"
                type="hidden"
                value={organizationId}
              />
              <input name="groupId" type="hidden" value={selectedGroup.id} />
              <input name="effectiveFrom" type="hidden" value={today} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <label className="field-label" htmlFor="groupAgent">
                  Ajouter un collaborateur
                </label>
                <PlatformSelect id="groupAgent" name="agentId" required>
                  <option value="">Choisir dans la liste…</option>
                  {availableAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.display_name}
                    </option>
                  ))}
                </PlatformSelect>
              </div>
              <button className="primary-button" type="submit">
                Ajouter au groupe
              </button>
            </form>
          ) : (
            <p className="border-b border-zinc-200 p-4 text-sm text-zinc-500">
              Tous les collaborateurs actifs sont déjà dans ce groupe.
            </p>
          )}

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
                  href={`/tools/planning/groupes?group=${group.id}`}
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

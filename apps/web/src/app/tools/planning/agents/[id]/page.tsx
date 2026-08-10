import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PlatformSelect } from '../../../../../components/ui/platform-select';
import { apiFetch } from '../../../../../lib/api/server';
import type {
  Agent,
  AgentRules,
  HourBalance,
  Position,
} from '../../../../../lib/api/types';
import { currentParisDate, mondayOf } from '../../../../../lib/dates';
import {
  setAgentContract,
  setAgentPositionRule,
  setHourTarget,
} from '../../actions';

type AgentDetailPageProps = Readonly<{
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}>;

function hours(minutes: number | null): string {
  if (minutes === null) return '—';
  return `${(minutes / 60).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} h`;
}

export default async function AgentDetailPage({
  params,
  searchParams,
}: AgentDetailPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const agentResult = await apiFetch<Agent>(`/agents/${id}`);

  if (!agentResult.data) {
    notFound();
  }

  const agent = agentResult.data;
  const today = currentParisDate();
  const weekStart = mondayOf(today);
  const [positionsResult, rulesResult, balanceResult] = await Promise.all([
    apiFetch<Position[]>(
      `/positions?organizationId=${encodeURIComponent(agent.organization_id)}&siteId=${encodeURIComponent(agent.primary_site_id)}`,
    ),
    apiFetch<AgentRules>(`/agents/${agent.id}/rules`),
    apiFetch<HourBalance>(
      `/hour-balances?agentId=${agent.id}&weekStart=${weekStart}`,
    ),
  ]);
  const positions = positionsResult.data ?? [];
  const rules = rulesResult.data ?? {
    preferences: [],
    restrictions: [],
    contracts: [],
  };
  const balance = balanceResult.data;
  const positionById = new Map(
    positions.map((position) => [position.id, position]),
  );
  const preferredPositions = rules.preferences.filter(
    (preference) => preference.level === 'preferred',
  );
  const avoidedPositions = rules.preferences.filter(
    (preference) => preference.level === 'avoid',
  );
  const neutralPositions = rules.preferences.filter(
    (preference) => preference.level === 'neutral',
  );

  return (
    <div className="space-y-6">
      <header>
        <Link
          className="text-sm font-medium text-zinc-500 hover:text-zinc-900"
          href="/tools/planning/agents"
        >
          ← Retour aux agents
        </Link>
        <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="eyebrow">{agent.employee_number}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {agent.display_name}
            </h1>
          </div>
          <span
            className={`w-fit rounded-full px-3 py-1.5 text-xs font-medium ${
              agent.active
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-zinc-200 text-zinc-600'
            }`}
          >
            {agent.active ? 'Agent actif' : 'Agent inactif'}
          </span>
        </div>
      </header>

      {query.saved ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          La fiche a été mise à jour.
        </p>
      ) : null}
      {query.error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          La modification a échoué. Vérifiez les périodes d’effet et vos
          habilitations.
        </p>
      ) : null}

      <section className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-600">
        <strong className="text-zinc-950">
          {hours(balance?.weeklyTargetMinutes ?? null)}
        </strong>{' '}
        prévues par semaine ·{' '}
        <strong className="text-zinc-950">
          {hours(balance?.scheduledWeekMinutes ?? 0)}
        </strong>{' '}
        planifiées ·{' '}
        <strong className="text-zinc-950">
          {hours(balance?.workedMonthMinutes ?? 0)}
        </strong>{' '}
        réalisées ce mois
      </section>

      <details className="rounded-2xl border border-zinc-200 bg-white p-5">
        <summary className="cursor-pointer font-semibold">
          Temps de travail
        </summary>
        <div className="mt-5 grid gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Référence contractuelle</h2>
            <ul className="mt-4 space-y-2">
              {rules.contracts.map((contract) => (
                <li
                  className="rounded-xl bg-zinc-50 px-4 py-3 text-sm"
                  key={contract.id}
                >
                  <div className="flex justify-between gap-4">
                    <span className="font-medium">
                      {contract.label ?? 'Contrat'}
                    </span>
                    <span>
                      {hours(contract.weekly_target_minutes)} / semaine
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Depuis le {contract.effective_from}
                  </p>
                </li>
              ))}
            </ul>
            <form
              action={setAgentContract}
              className="mt-5 grid gap-4 border-t border-zinc-100 pt-5 sm:grid-cols-2"
            >
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
              <input name="agentId" type="hidden" value={agent.id} />
              <div className="space-y-2">
                <label className="field-label" htmlFor="contractFrom">
                  Date d’effet
                </label>
                <input
                  className="field-input"
                  defaultValue={today}
                  id="contractFrom"
                  name="effectiveFrom"
                  required
                  type="date"
                />
              </div>
              <div className="space-y-2">
                <label className="field-label" htmlFor="contractLabel">
                  Libellé
                </label>
                <input
                  className="field-input"
                  id="contractLabel"
                  name="label"
                  placeholder="Temps plein"
                />
              </div>
              <div className="space-y-2">
                <label className="field-label" htmlFor="weeklyHours">
                  Heures par semaine
                </label>
                <input
                  className="field-input"
                  defaultValue="35"
                  id="weeklyHours"
                  min="0"
                  name="weeklyHours"
                  required
                  step="0.25"
                  type="number"
                />
              </div>
              <div className="space-y-2">
                <label className="field-label" htmlFor="monthlyHours">
                  Heures par mois
                </label>
                <input
                  className="field-input"
                  id="monthlyHours"
                  min="0"
                  name="monthlyHours"
                  step="0.25"
                  type="number"
                />
              </div>
              <div className="sm:col-span-2 sm:text-right">
                <button className="primary-button" type="submit">
                  Ajouter une version
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Dérogation individuelle</h2>
            <p className="mt-2 text-sm text-zinc-500">
              Cette cible remplace celle du groupe uniquement pour la semaine
              sélectionnée.
            </p>
            <form
              action={setHourTarget}
              className="mt-5 grid gap-4 sm:grid-cols-2"
            >
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
              <input name="agentId" type="hidden" value={agent.id} />
              <div className="space-y-2">
                <label className="field-label" htmlFor="agentTargetWeek">
                  Semaine du
                </label>
                <input
                  className="field-input"
                  defaultValue={weekStart}
                  id="agentTargetWeek"
                  name="weekStart"
                  required
                  type="date"
                />
              </div>
              <div className="space-y-2">
                <label className="field-label" htmlFor="agentTargetHours">
                  Heures
                </label>
                <input
                  className="field-input"
                  defaultValue="35"
                  id="agentTargetHours"
                  min="0"
                  name="targetHours"
                  required
                  step="0.25"
                  type="number"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="field-label" htmlFor="agentTargetReason">
                  Motif obligatoire
                </label>
                <input
                  className="field-input"
                  id="agentTargetReason"
                  name="reason"
                  required
                />
              </div>
              <div className="sm:col-span-2 sm:text-right">
                <button className="primary-button" type="submit">
                  Enregistrer la dérogation
                </button>
              </div>
            </form>
          </section>
        </div>
      </details>

      <section
        className="rounded-2xl border border-zinc-200 bg-white p-5"
        id="affectation-postes"
      >
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h2 className="font-semibold">Affectation aux postes</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Un coup d’œil suffit pour savoir où affecter cet agent.
            </p>
          </div>
          <div className="flex gap-2 text-xs font-medium">
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
              {preferredPositions.length} à privilégier
            </span>
            <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">
              {avoidedPositions.length + rules.restrictions.length} à éviter
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <article className="flex min-h-64 flex-col border border-emerald-200 bg-emerald-50/40 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                À privilégier
              </p>
              <h3 className="mt-1 text-lg font-semibold text-zinc-950">
                Postes appréciés
              </h3>
              <p className="mt-1 text-sm text-zinc-600">
                Le planning essaiera d’y affecter l’agent en priorité.
              </p>
            </div>

            <div className="mt-4 flex-1 space-y-2">
              {preferredPositions.map((preference) => (
                <div
                  className="border border-emerald-200 bg-white px-4 py-3 text-sm"
                  key={preference.id}
                >
                  <p className="font-medium text-zinc-950">
                    {positionById.get(preference.position_id)?.name ??
                      'Poste archivé'}
                  </p>
                  {preference.note ? (
                    <p className="mt-1 text-xs text-zinc-500">
                      {preference.note}
                    </p>
                  ) : null}
                </div>
              ))}
              {!preferredPositions.length ? (
                <p className="border border-dashed border-emerald-300 bg-white/60 px-4 py-6 text-center text-sm text-zinc-500">
                  Aucun poste favori pour le moment.
                </p>
              ) : null}
              {neutralPositions.length ? (
                <p className="text-xs leading-5 text-zinc-500">
                  Autres postes possibles :{' '}
                  {neutralPositions
                    .map(
                      (preference) =>
                        positionById.get(preference.position_id)?.name ??
                        'poste archivé',
                    )
                    .join(', ')}
                </p>
              ) : null}
            </div>

            <details className="mt-4 border-t border-emerald-200 pt-4">
              <summary className="cursor-pointer text-sm font-semibold text-emerald-800">
                + Ajouter un poste apprécié
              </summary>
              <form action={setAgentPositionRule} className="mt-4 space-y-3">
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
                <input name="agentId" type="hidden" value={agent.id} />
                <input name="kind" type="hidden" value="preference" />
                <input name="level" type="hidden" value="preferred" />
                <input name="validFrom" type="hidden" value={today} />
                <div className="space-y-2">
                  <label className="field-label" htmlFor="preferredPosition">
                    Poste à privilégier
                  </label>
                  <PlatformSelect
                    id="preferredPosition"
                    name="positionId"
                    required
                  >
                    <option value="">Choisir un poste</option>
                    {positions.map((position) => (
                      <option key={position.id} value={position.id}>
                        {position.name}
                      </option>
                    ))}
                  </PlatformSelect>
                </div>
                <div className="space-y-2">
                  <label className="field-label" htmlFor="preferredNote">
                    Commentaire{' '}
                    <span className="font-normal">(facultatif)</span>
                  </label>
                  <input
                    className="field-input"
                    id="preferredNote"
                    name="note"
                    placeholder="Ex. poste habituel"
                  />
                </div>
                <button className="primary-button w-full" type="submit">
                  Ajouter aux préférences
                </button>
              </form>
            </details>
          </article>

          <article className="flex min-h-64 flex-col border border-red-200 bg-red-50/40 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                À éviter
              </p>
              <h3 className="mt-1 text-lg font-semibold text-zinc-950">
                Postes déconseillés ou interdits
              </h3>
              <p className="mt-1 text-sm text-zinc-600">
                « À éviter » reste possible. « Interdit » bloque l’affectation.
              </p>
            </div>

            <div className="mt-4 flex-1 space-y-2">
              {avoidedPositions.map((preference) => (
                <div
                  className="flex items-start justify-between gap-3 border border-amber-200 bg-white px-4 py-3 text-sm"
                  key={preference.id}
                >
                  <div>
                    <p className="font-medium text-zinc-950">
                      {positionById.get(preference.position_id)?.name ??
                        'Poste archivé'}
                    </p>
                    {preference.note ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        {preference.note}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                    À éviter
                  </span>
                </div>
              ))}
              {rules.restrictions.map((restriction) => (
                <div
                  className="flex items-start justify-between gap-3 border border-red-200 bg-white px-4 py-3 text-sm"
                  key={restriction.id}
                >
                  <div>
                    <p className="font-medium text-zinc-950">
                      {positionById.get(restriction.position_id)?.name ??
                        'Poste archivé'}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {restriction.reason}
                    </p>
                  </div>
                  <span className="shrink-0 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                    Interdit
                  </span>
                </div>
              ))}
              {!avoidedPositions.length && !rules.restrictions.length ? (
                <p className="border border-dashed border-red-300 bg-white/60 px-4 py-6 text-center text-sm text-zinc-500">
                  Aucun poste à éviter ou interdit.
                </p>
              ) : null}
            </div>

            <details className="mt-4 border-t border-red-200 pt-4">
              <summary className="cursor-pointer text-sm font-semibold text-red-800">
                + Interdire un poste
              </summary>
              <form action={setAgentPositionRule} className="mt-4 space-y-3">
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
                <input name="agentId" type="hidden" value={agent.id} />
                <input name="kind" type="hidden" value="restriction" />
                <input name="level" type="hidden" value="avoid" />
                <input name="validFrom" type="hidden" value={today} />
                <div className="space-y-2">
                  <label className="field-label" htmlFor="restrictedPosition">
                    Poste à interdire
                  </label>
                  <PlatformSelect
                    id="restrictedPosition"
                    name="positionId"
                    required
                  >
                    <option value="">Choisir un poste</option>
                    {positions.map((position) => (
                      <option key={position.id} value={position.id}>
                        {position.name}
                      </option>
                    ))}
                  </PlatformSelect>
                </div>
                <div className="space-y-2">
                  <label className="field-label" htmlFor="restrictionReason">
                    Pourquoi ce poste est-il interdit ?
                  </label>
                  <input
                    className="field-input"
                    id="restrictionReason"
                    minLength={3}
                    name="note"
                    placeholder="Ex. restriction médicale"
                    required
                  />
                </div>
                <button className="primary-button w-full" type="submit">
                  Interdire ce poste
                </button>
              </form>
            </details>
          </article>
        </div>
      </section>
    </div>
  );
}

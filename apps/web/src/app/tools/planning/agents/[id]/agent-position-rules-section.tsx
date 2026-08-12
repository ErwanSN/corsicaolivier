import { PlatformSelect } from '../../../../../components/ui/platform-select';
import type { Agent, AgentRules, Position } from '../../../../../lib/api/types';
import { setAgentPositionRule } from '../../actions';
import { activeOn } from './agent-detail-utils';

type AgentPositionRulesSectionProps = Readonly<{
  agent: Agent;
  positions: readonly Position[];
  rules: AgentRules;
  today: string;
}>;

export function AgentPositionRulesSection({
  agent,
  positions,
  rules,
  today,
}: AgentPositionRulesSectionProps) {
  const positionById = new Map(
    positions.map((position) => [position.id, position]),
  );
  const activePreferences = rules.preferences.filter((preference) =>
    activeOn(preference.valid_from, preference.valid_until, today),
  );
  const activeRestrictions = rules.restrictions.filter((restriction) =>
    activeOn(restriction.valid_from, restriction.valid_until, today),
  );
  const preferredPositions = activePreferences.filter(
    (preference) => preference.level === 'preferred',
  );
  const avoidedPositions = activePreferences.filter(
    (preference) => preference.level === 'avoid',
  );
  const neutralPositions = activePreferences.filter(
    (preference) => preference.level === 'neutral',
  );

  return (
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
            {avoidedPositions.length + activeRestrictions.length} à éviter
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
                  Commentaire <span className="font-normal">(facultatif)</span>
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
            {activeRestrictions.map((restriction) => (
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
            {!avoidedPositions.length && !activeRestrictions.length ? (
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
  );
}

import type { Agent, AgentRules } from '../../../../../lib/api/types';
import { setAgentContract, setHourTarget } from '../../actions';
import { hours } from './agent-detail-utils';

type AgentWorkTimeSectionProps = Readonly<{
  agent: Agent;
  contracts: AgentRules['contracts'];
  today: string;
  weekStart: string;
}>;

export function AgentWorkTimeSection({
  agent,
  contracts,
  today,
  weekStart,
}: AgentWorkTimeSectionProps) {
  return (
    <details className="rounded-2xl border border-zinc-200 bg-white p-5">
      <summary className="cursor-pointer font-semibold">
        Temps de travail
      </summary>
      <div className="mt-5 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Référence contractuelle</h2>
          <ul className="mt-4 space-y-2">
            {contracts.map((contract) => (
              <li
                className="rounded-xl bg-zinc-50 px-4 py-3 text-sm"
                key={contract.id}
              >
                <div className="flex justify-between gap-4">
                  <span className="font-medium">
                    {contract.label ?? 'Contrat'}
                  </span>
                  <span>{hours(contract.weekly_target_minutes)} / semaine</span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  Du {contract.effective_from}{' '}
                  {contract.effective_until
                    ? `au ${contract.effective_until}`
                    : 'sans date de fin'}
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
            <input name="siteId" type="hidden" value={agent.primary_site_id} />
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
              <p className="mb-3 text-xs text-zinc-500">
                La version en cours sera clôturée automatiquement la veille.
              </p>
              <button className="primary-button" type="submit">
                Mettre à jour le contrat
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
            <input name="siteId" type="hidden" value={agent.primary_site_id} />
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
  );
}

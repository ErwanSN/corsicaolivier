import Link from 'next/link';

import type {
  Agent,
  AgentOffboardingPlan,
  HourBalance,
} from '../../../../../lib/api/types';
import { reactivateAgent, retryAgentOffboarding } from '../../actions';
import { dateTimeFormatter, hours } from './agent-detail-utils';

type AgentOverviewProps = Readonly<{
  agent: Agent;
  balance: HourBalance | null;
  error?: string;
  offboardingLoadFailed: boolean;
  offboardingPlan: AgentOffboardingPlan | null;
  positionsHasMore: boolean;
  positionsTotal: number;
  saved?: string;
  timeZone: string;
}>;

export function AgentOverview({
  agent,
  balance,
  error,
  offboardingLoadFailed,
  offboardingPlan,
  positionsHasMore,
  positionsTotal,
  saved,
  timeZone,
}: AgentOverviewProps) {
  const formatDateTime = dateTimeFormatter(timeZone);

  return (
    <>
      <header>
        <Link
          className="text-sm font-medium text-zinc-500 hover:text-zinc-900"
          href={`/tools/planning/agents?site=${encodeURIComponent(agent.primary_site_id)}`}
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

      {saved ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {saved === 'retry'
            ? 'La relance du départ a été enregistrée.'
            : saved === 'reactivated'
              ? 'Le collaborateur est réactivé avec son accès minimal.'
              : 'La fiche a été mise à jour.'}
        </p>
      ) : null}

      {offboardingPlan ? (
        <details
          className={`rounded-2xl border bg-white px-5 py-4 ${
            offboardingPlan.status === 'failed'
              ? 'border-amber-300'
              : 'border-zinc-200'
          }`}
          open={offboardingPlan.status === 'failed'}
        >
          <summary className="cursor-pointer text-sm font-semibold text-zinc-800">
            Suivi du départ ·{' '}
            {offboardingPlan.status === 'scheduled'
              ? 'programmé'
              : offboardingPlan.status === 'completed'
                ? 'terminé'
                : offboardingPlan.status === 'cancelled'
                  ? 'annulé'
                  : 'action requise'}
          </summary>
          <div className="mt-3 space-y-3 border-t border-zinc-100 pt-3 text-sm text-zinc-600">
            <p>
              Échéance :{' '}
              <strong className="font-medium text-zinc-950">
                {formatDateTime.format(new Date(offboardingPlan.effectiveAt))}
              </strong>
            </p>
            {offboardingPlan.status === 'failed' ? (
              <>
                <p className="text-amber-900" role="status">
                  {offboardingPlan.retryCount} tentative
                  {offboardingPlan.retryCount > 1 ? 's' : ''} · code{' '}
                  {offboardingPlan.failureCode ?? 'inconnu'}. Les données
                  techniques détaillées ne sont pas affichées ici.
                </p>
                <form
                  action={retryAgentOffboarding}
                  className="flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-end"
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
                      htmlFor="offboardingRetryReason"
                    >
                      Motif de la relance
                    </label>
                    <input
                      className="field-input"
                      id="offboardingRetryReason"
                      maxLength={500}
                      minLength={3}
                      name="reason"
                      placeholder="Ex. incident corrigé et vérifié"
                      required
                    />
                  </div>
                  <button className="secondary-button" type="submit">
                    Relancer
                  </button>
                </form>
              </>
            ) : null}
          </div>
        </details>
      ) : null}

      {offboardingLoadFailed ? (
        <p
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="alert"
        >
          <span>
            Suivi du départ indisponible — désactivation non confirmée.
          </span>
          <Link
            className="font-semibold underline underline-offset-2"
            href={`/tools/planning/agents/${agent.id}`}
          >
            Réessayer
          </Link>
        </p>
      ) : null}

      {!agent.active ||
      offboardingPlan?.status === 'scheduled' ||
      offboardingPlan?.status === 'failed' ? (
        <details className="rounded-2xl border border-zinc-200 bg-white px-5 py-4">
          <summary className="cursor-pointer text-sm font-semibold text-zinc-800">
            {offboardingPlan?.status === 'scheduled'
              ? 'Annuler le départ programmé'
              : offboardingPlan?.status === 'failed'
                ? 'Annuler le départ en échec'
                : 'Réactiver ce collaborateur'}
          </summary>
          <form
            action={reactivateAgent}
            className="mt-3 flex max-w-2xl flex-col gap-3 border-t border-zinc-100 pt-3 sm:flex-row sm:items-end"
          >
            <input name="agentId" type="hidden" value={agent.id} />
            <input
              name="organizationId"
              type="hidden"
              value={agent.organization_id}
            />
            <input name="siteId" type="hidden" value={agent.primary_site_id} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <label className="field-label" htmlFor="reactivationReason">
                {agent.active
                  ? 'Motif de l’annulation'
                  : 'Motif de réactivation'}
              </label>
              <input
                className="field-input"
                id="reactivationReason"
                maxLength={500}
                minLength={3}
                name="reason"
                required
              />
            </div>
            <button className="secondary-button" type="submit">
              {agent.active
                ? 'Annuler le départ'
                : 'Réactiver avec accès minimal'}
            </button>
          </form>
        </details>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          La modification a échoué. Vérifiez les périodes d’effet et vos
          habilitations.
        </p>
      ) : null}

      {positionsHasMore ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Cette fiche propose 200 postes sur {positionsTotal}. Les postes
          suivants peuvent être retrouvés par la recherche des réglages.
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
    </>
  );
}

import Link from 'next/link';

import { PlatformSelect } from '../../../../components/ui/platform-select';
import type { Position } from '../../../../lib/api/types';
import { setAgentPositionRule } from '../actions';

type AgentPositionQuickActionsProps = Readonly<{
  agentId: string;
  organizationId: string;
  positions: ReadonlyArray<Position>;
  siteId: string;
  validFrom: string;
}>;

type RuleFieldsProps = Readonly<{
  agentId: string;
  kind: 'preference' | 'restriction';
  organizationId: string;
  siteId: string;
  validFrom: string;
}>;

function RuleFields({
  agentId,
  kind,
  organizationId,
  siteId,
  validFrom,
}: RuleFieldsProps) {
  return (
    <>
      <input name="agentId" type="hidden" value={agentId} />
      <input name="kind" type="hidden" value={kind} />
      {kind === 'preference' ? (
        <input name="level" type="hidden" value="preferred" />
      ) : null}
      <input name="organizationId" type="hidden" value={organizationId} />
      <input name="returnTo" type="hidden" value="agents" />
      <input name="siteId" type="hidden" value={siteId} />
      <input name="validFrom" type="hidden" value={validFrom} />
    </>
  );
}

export function AgentPositionQuickActions({
  agentId,
  organizationId,
  positions,
  siteId,
  validFrom,
}: AgentPositionQuickActionsProps) {
  const detailHref = `/tools/planning/agents/${agentId}?site=${encodeURIComponent(siteId)}#affectation-postes`;

  return (
    <section className="border-t border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Postes du collaborateur</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Ajoutez ici l’essentiel. La fiche complète conserve tout
            l’historique.
          </p>
        </div>
        <Link
          className="text-sm font-medium text-zinc-600 hover:text-zinc-950"
          href={detailHref}
        >
          Voir les postes enregistrés →
        </Link>
      </div>

      {positions.length ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <form
            action={setAgentPositionRule}
            className="border border-emerald-200 bg-emerald-50/50 p-4"
          >
            <RuleFields
              agentId={agentId}
              kind="preference"
              organizationId={organizationId}
              siteId={siteId}
              validFrom={validFrom}
            />
            <label
              className="text-sm font-semibold text-emerald-900"
              htmlFor={`preferred-position-${agentId}`}
            >
              Poste qu’il apprécie
            </label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <PlatformSelect
                className="min-w-0 flex-1 bg-white"
                id={`preferred-position-${agentId}`}
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
              <button className="primary-button shrink-0" type="submit">
                Ajouter
              </button>
            </div>
          </form>

          <form
            action={setAgentPositionRule}
            className="border border-red-200 bg-red-50/50 p-4"
          >
            <RuleFields
              agentId={agentId}
              kind="restriction"
              organizationId={organizationId}
              siteId={siteId}
              validFrom={validFrom}
            />
            <label
              className="text-sm font-semibold text-red-900"
              htmlFor={`restricted-position-${agentId}`}
            >
              Poste qu’il ne doit pas faire
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <PlatformSelect
                className="min-w-0 bg-white"
                id={`restricted-position-${agentId}`}
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
              <input
                aria-label="Motif de l’interdiction"
                className="field-input bg-white"
                minLength={3}
                name="note"
                placeholder="Motif en quelques mots"
                required
              />
            </div>
            <button className="primary-button mt-2 w-full" type="submit">
              Ne pas affecter à ce poste
            </button>
          </form>
        </div>
      ) : (
        <p className="mt-4 border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Créez d’abord les postes de cette zone dans les réglages.
        </p>
      )}
    </section>
  );
}

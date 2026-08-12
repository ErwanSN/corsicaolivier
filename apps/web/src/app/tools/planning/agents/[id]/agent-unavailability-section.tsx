import Link from 'next/link';

import { PlatformSelect } from '../../../../../components/ui/platform-select';
import type {
  Agent,
  AgentUnavailability,
  AgentUnavailabilityPage,
} from '../../../../../lib/api/types';
import {
  createAgentUnavailability,
  endAgentUnavailability,
} from '../../actions';
import { dateTimeFormatter } from './agent-detail-utils';

const UNAVAILABILITY_LABELS: Record<AgentUnavailability['kind'], string> = {
  leave: 'Congé',
  training: 'Formation',
  medical: 'Indisponibilité médicale',
  rest: 'Repos',
  other: 'Autre',
};

type AgentUnavailabilitySectionProps = Readonly<{
  absenceQuery: string;
  agent: Agent;
  loadFailed: boolean;
  now: number;
  pastPage: AgentUnavailabilityPage | null;
  requestedAbsencePage: number;
  timeZone: string;
  today: string;
  upcomingPage: AgentUnavailabilityPage | null;
}>;

export function AgentUnavailabilitySection({
  absenceQuery,
  agent,
  loadFailed,
  now,
  pastPage,
  requestedAbsencePage,
  timeZone,
  today,
  upcomingPage,
}: AgentUnavailabilitySectionProps) {
  const formatDateTime = dateTimeFormatter(timeZone);
  const currentAndUpcoming = (upcomingPage?.items ?? [])
    .filter((item) => new Date(item.ends_at).getTime() > now)
    .sort(
      (left, right) =>
        new Date(left.starts_at).getTime() -
        new Date(right.starts_at).getTime(),
    );
  const past = pastPage?.items ?? [];

  return (
    <details className="rounded-2xl border border-zinc-200 bg-white p-5">
      <summary className="cursor-pointer font-semibold">
        Disponibilités ·{' '}
        {loadFailed
          ? 'données indisponibles'
          : `${upcomingPage?.total ?? 0} en cours ou à venir`}
      </summary>
      <div className="mt-5 space-y-4">
        {currentAndUpcoming.length ? (
          <ul className="space-y-2">
            {currentAndUpcoming.map((item) => {
              const ongoing = new Date(item.starts_at).getTime() <= now;

              return (
                <li
                  className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm"
                  key={item.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-zinc-950">
                        {UNAVAILABILITY_LABELS[item.kind]}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">
                        Du {formatDateTime.format(new Date(item.starts_at))} au{' '}
                        {formatDateTime.format(new Date(item.ends_at))}
                      </p>
                      {item.note ? (
                        <p className="mt-1 text-xs text-zinc-600">
                          {item.note}
                        </p>
                      ) : null}
                    </div>
                    {ongoing ? (
                      <form action={endAgentUnavailability}>
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
                        <input
                          name="unavailabilityId"
                          type="hidden"
                          value={item.id}
                        />
                        <button className="secondary-button" type="submit">
                          Terminer maintenant
                        </button>
                      </form>
                    ) : (
                      <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
                        À venir
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : loadFailed ? (
          <p
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
            role="alert"
          >
            Les indisponibilités ne peuvent pas être chargées pour le moment.
            Réessayez avant d’en saisir une.
          </p>
        ) : (
          <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-5 text-center text-sm text-zinc-500">
            Aucune indisponibilité en cours ou prévue.
          </p>
        )}

        {(upcomingPage?.totalPages ?? 1) > 1 ? (
          <nav
            aria-label="Pagination des indisponibilités à venir"
            className="flex items-center justify-between gap-2 text-xs"
          >
            {upcomingPage && upcomingPage.page > 1 ? (
              <Link
                className="secondary-button"
                href={`?${new URLSearchParams({
                  absenceUpcomingPage: String(upcomingPage.page - 1),
                  ...(absenceQuery ? { absenceQ: absenceQuery } : {}),
                  ...(requestedAbsencePage > 1
                    ? { absencePage: String(requestedAbsencePage) }
                    : {}),
                }).toString()}`}
              >
                ← Précédentes
              </Link>
            ) : (
              <span />
            )}
            <span className="text-zinc-500">
              {upcomingPage?.page} / {upcomingPage?.totalPages}
            </span>
            {upcomingPage?.hasMore ? (
              <Link
                className="secondary-button"
                href={`?${new URLSearchParams({
                  absenceUpcomingPage: String(upcomingPage.page + 1),
                  ...(absenceQuery ? { absenceQ: absenceQuery } : {}),
                  ...(requestedAbsencePage > 1
                    ? { absencePage: String(requestedAbsencePage) }
                    : {}),
                }).toString()}`}
              >
                Suivantes →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}

        {!loadFailed ? (
          <details className="border-t border-zinc-100 pt-4">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-700">
              + Saisir une absence ou indisponibilité
            </summary>
            <form
              action={createAgentUnavailability}
              className="mt-4 grid gap-3 sm:grid-cols-2"
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
              <input name="timeZone" type="hidden" value={timeZone} />
              <div className="space-y-2 sm:col-span-2">
                <label className="field-label" htmlFor="unavailabilityKind">
                  Motif
                </label>
                <PlatformSelect id="unavailabilityKind" name="kind" required>
                  <option value="leave">Congé</option>
                  <option value="training">Formation</option>
                  <option value="medical">Médical</option>
                  <option value="rest">Repos</option>
                  <option value="other">Autre</option>
                </PlatformSelect>
              </div>
              <div className="space-y-2">
                <label className="field-label" htmlFor="unavailabilityFrom">
                  Début
                </label>
                <input
                  className="field-input"
                  defaultValue={`${today}T08:00`}
                  id="unavailabilityFrom"
                  name="startsAt"
                  required
                  type="datetime-local"
                />
              </div>
              <div className="space-y-2">
                <label className="field-label" htmlFor="unavailabilityUntil">
                  Fin
                </label>
                <input
                  className="field-input"
                  defaultValue={`${today}T18:00`}
                  id="unavailabilityUntil"
                  name="endsAt"
                  required
                  type="datetime-local"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="field-label" htmlFor="unavailabilityNote">
                  Note <span className="font-normal">(facultatif)</span>
                </label>
                <input
                  className="field-input"
                  id="unavailabilityNote"
                  maxLength={500}
                  name="note"
                  placeholder="Information utile au planning"
                />
              </div>
              <button className="primary-button sm:col-span-2" type="submit">
                Enregistrer l’indisponibilité
              </button>
            </form>
          </details>
        ) : null}

        {!loadFailed && ((pastPage?.total ?? 0) > 0 || absenceQuery) ? (
          <details
            className="border-t border-zinc-100 pt-4"
            open={Boolean(absenceQuery)}
          >
            <summary className="cursor-pointer text-sm text-zinc-500">
              Historique ({pastPage?.total ?? 0})
            </summary>
            <form className="mt-3 flex gap-2" method="get">
              <input
                className="field-input min-w-0 flex-1"
                defaultValue={absenceQuery}
                maxLength={80}
                name="absenceQ"
                placeholder="Rechercher dans les notes"
                type="search"
              />
              <button className="secondary-button" type="submit">
                Rechercher
              </button>
            </form>
            {past.length === 0 ? (
              <p className="mt-3 text-xs text-zinc-500">
                Aucun historique ne correspond à cette recherche.
              </p>
            ) : null}
            <ul className="mt-3 space-y-2 text-xs text-zinc-600">
              {past.map((item) => (
                <li className="rounded-lg bg-zinc-50 px-3 py-2" key={item.id}>
                  <strong>{UNAVAILABILITY_LABELS[item.kind]}</strong> ·{' '}
                  {formatDateTime.format(new Date(item.starts_at))} →{' '}
                  {formatDateTime.format(new Date(item.ends_at))}
                </li>
              ))}
            </ul>
            {(pastPage?.totalPages ?? 1) > 1 ? (
              <nav
                aria-label="Pagination de l’historique"
                className="mt-3 flex items-center justify-between gap-2 text-xs"
              >
                {pastPage && pastPage.page > 1 ? (
                  <Link
                    className="secondary-button"
                    href={`?${new URLSearchParams({
                      absencePage: String(pastPage.page - 1),
                      ...(absenceQuery ? { absenceQ: absenceQuery } : {}),
                    }).toString()}`}
                  >
                    ← Précédentes
                  </Link>
                ) : (
                  <span />
                )}
                <span>
                  {pastPage?.page} / {pastPage?.totalPages}
                </span>
                {pastPage?.hasMore ? (
                  <Link
                    className="secondary-button"
                    href={`?${new URLSearchParams({
                      absencePage: String(pastPage.page + 1),
                      ...(absenceQuery ? { absenceQ: absenceQuery } : {}),
                    }).toString()}`}
                  >
                    Suivantes →
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </details>
        ) : null}
      </div>
    </details>
  );
}

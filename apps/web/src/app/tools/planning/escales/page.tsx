import Link from 'next/link';
import type { ReactNode } from 'react';

import { SiteSwitcher } from '../../../../components/site-switcher';
import { PlatformSelect } from '../../../../components/ui/platform-select';
import { apiFetch } from '../../../../lib/api/server';
import type {
  DemandProfile,
  LoadForecast,
  PortCall,
  Site,
  Vessel,
} from '../../../../lib/api/types';
import { orderSites } from '../../../../lib/sites';
import {
  assignDemandProfile,
  createLoadForecast,
  createPortCall,
  updatePortCallTiming,
} from '../actions';

type EscalesPageProps = Readonly<{
  searchParams: Promise<{
    add?: string;
    call?: string;
    error?: string;
    saved?: string;
    site?: string;
  }>;
}>;

const statusLabels: Record<PortCall['status'], string> = {
  scheduled: 'Planifiée',
  delayed: 'En retard',
  advanced: 'En avance',
  arrived: 'Arrivée',
  departed: 'Partie',
  cancelled: 'Annulée',
};

function formatDate(value: string | null, timeZone: string): string {
  if (!value) return '—';

  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(value));
}

function toLocalInput(value: string | null, timeZone: string): string {
  if (!value) return '';

  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  })
    .format(new Date(value))
    .replace(' ', 'T');
}

function timingChanged(
  scheduled: string | null,
  estimated: string | null,
): boolean {
  return Boolean(
    scheduled &&
    estimated &&
    new Date(scheduled).getTime() !== new Date(estimated).getTime(),
  );
}

function TimingDisplay({
  estimated,
  scheduled,
  timeZone,
}: Readonly<{
  estimated: string | null;
  scheduled: string | null;
  timeZone: string;
}>) {
  const changed = timingChanged(scheduled, estimated);

  return (
    <span className="block whitespace-nowrap">
      {changed ? (
        <span className="block text-xs text-zinc-400 line-through">
          {formatDate(scheduled, timeZone)}
        </span>
      ) : null}
      <span className={changed ? 'font-semibold text-zinc-950' : undefined}>
        {formatDate(estimated ?? scheduled, timeZone)}
      </span>
    </span>
  );
}

function TimingReference({
  estimated,
  scheduled,
  timeZone,
}: Readonly<{
  estimated: string | null;
  scheduled: string | null;
  timeZone: string;
}>) {
  const changed = timingChanged(scheduled, estimated);

  return (
    <span className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
      {changed ? (
        <>
          <span className="line-through">
            Ancien : {formatDate(scheduled, timeZone)}
          </span>
          <span aria-hidden="true">→</span>
          <strong className="font-semibold text-zinc-800">
            Actuel : {formatDate(estimated, timeZone)}
          </strong>
        </>
      ) : (
        <span>Actuel : {formatDate(estimated ?? scheduled, timeZone)}</span>
      )}
    </span>
  );
}

export default async function EscalesPage({ searchParams }: EscalesPageProps) {
  const params = await searchParams;
  const sitesResult = await apiFetch<Site[]>('/sites');
  const sites = orderSites(sitesResult.data ?? []);
  const site = sites.find((item) => item.id === params.site) ?? sites.at(0);
  const [callsResult, profilesResult, vesselsResult] = site
    ? await Promise.all([
        apiFetch<PortCall[]>(
          `/port-calls?siteId=${encodeURIComponent(site.id)}`,
        ),
        apiFetch<DemandProfile[]>(
          `/demand-profiles?siteId=${encodeURIComponent(site.id)}`,
        ),
        apiFetch<Vessel[]>(
          `/vessels?organizationId=${encodeURIComponent(site.organization_id)}`,
        ),
      ])
    : [
        { data: [] as PortCall[], error: sitesResult.error },
        { data: [] as DemandProfile[], error: sitesResult.error },
        { data: [] as Vessel[], error: sitesResult.error },
      ];
  const calls = callsResult.data ?? [];
  const profiles = profilesResult.data ?? [];
  const vessels = vesselsResult.data ?? [];
  const vesselById = new Map(vessels.map((vessel) => [vessel.id, vessel]));
  const selected = params.call
    ? calls.find((call) => call.id === params.call)
    : undefined;
  const forecastsResult = selected
    ? await apiFetch<LoadForecast[]>(
        `/load-forecasts?portCallId=${encodeURIComponent(selected.id)}`,
      )
    : { data: [] as LoadForecast[], error: null };
  const forecasts = forecastsResult.data ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Escales</h1>
          <p className="mt-2 text-zinc-600">
            Ajoutez les arrivées et départs, puis signalez simplement les
            changements d’horaire.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="secondary-button"
            href={`/tools/planning/besoins?site=${site?.id ?? ''}`}
          >
            Règles de besoins
          </Link>
          <Link
            className="primary-button"
            href={`?site=${site?.id ?? ''}&add=call`}
          >
            Ajouter une escale
          </Link>
        </div>
      </header>

      {site ? (
        <SiteSwitcher
          path="/tools/planning/escales"
          selectedSiteId={site.id}
          sites={sites}
        />
      ) : null}

      {params.saved ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          La donnée opérationnelle a été enregistrée.
        </p>
      ) : null}
      {params.error ? (
        <p
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          L’opération a échoué. Vérifiez les valeurs et vos habilitations.
        </p>
      ) : null}

      {site && params.add === 'call' ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Nouvelle escale</h2>
          <form
            action={createPortCall}
            className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          >
            <input
              name="organizationId"
              type="hidden"
              value={site.organization_id}
            />
            <input name="siteId" type="hidden" value={site.id} />
            <input name="timeZone" type="hidden" value={site.timezone} />
            <Field label="Référence">
              <input className="field-input" name="externalReference" />
            </Field>
            <Field
              label={`Navire Corsica Linea (${vessels.length} disponibles)`}
            >
              <PlatformSelect name="vesselId" required>
                <option value="">Choisir un navire Corsica Linea</option>
                {vessels.map((vessel) => (
                  <option key={vessel.id} value={vessel.id}>
                    {vessel.name}
                  </option>
                ))}
              </PlatformSelect>
            </Field>
            <Field label="Arrivée prévue">
              <input
                className="field-input"
                name="scheduledArrivalAt"
                step="60"
                type="datetime-local"
              />
            </Field>
            <Field label="Départ prévu">
              <input
                className="field-input"
                name="scheduledDepartureAt"
                step="60"
                type="datetime-local"
              />
            </Field>
            <div className="flex gap-3 md:col-span-2 xl:col-span-4 xl:justify-end">
              <Link
                className="secondary-button"
                href={`/tools/planning/escales?site=${site.id}`}
              >
                Annuler
              </Link>
              <button className="primary-button" type="submit">
                Créer l’escale
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {callsResult.error || profilesResult.error || vesselsResult.error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Certains flux maritimes ne sont pas disponibles.
        </p>
      ) : null}

      <div
        className={
          selected
            ? 'grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]'
            : undefined
        }
      >
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {calls.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs text-zinc-500 uppercase">
                  <tr>
                    <th className="px-5 py-3">Référence</th>
                    <th className="px-5 py-3">Navire</th>
                    <th className="px-5 py-3">Arrivée</th>
                    <th className="px-5 py-3">Départ</th>
                    <th className="px-5 py-3">État</th>
                    <th className="px-5 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {calls.map((call) => (
                    <tr
                      className={
                        selected?.id === call.id ? 'bg-red-50/50' : undefined
                      }
                      key={call.id}
                    >
                      <td className="px-5 py-4 font-medium">
                        <Link
                          className="hover:text-red-700"
                          href={`?site=${site?.id ?? ''}&call=${call.id}`}
                        >
                          {call.external_reference ?? call.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-5 py-4 font-medium text-zinc-800">
                        {vesselById.get(call.vessel_id)?.name ??
                          'Navire indisponible'}
                      </td>
                      <td className="px-5 py-4 text-zinc-600">
                        <TimingDisplay
                          estimated={call.estimated_arrival_at}
                          scheduled={call.scheduled_arrival_at}
                          timeZone={site?.timezone ?? 'Europe/Paris'}
                        />
                      </td>
                      <td className="px-5 py-4 text-zinc-600">
                        <TimingDisplay
                          estimated={call.estimated_departure_at}
                          scheduled={call.scheduled_departure_at}
                          timeZone={site?.timezone ?? 'Europe/Paris'}
                        />
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium">
                          {statusLabels[call.status]}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          className="font-semibold text-red-700 hover:text-red-800"
                          href={`?site=${site?.id ?? ''}&call=${call.id}`}
                        >
                          Modifier les heures →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-12 text-center text-sm text-zinc-500">
              Aucune escale chargée.
            </p>
          )}
        </section>

        {site && selected ? (
          <aside>
            <section className="rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-zinc-500">Escale</p>
                  <h2 className="mt-1 text-lg font-semibold">
                    {selected.external_reference ?? selected.id.slice(0, 8)}
                  </h2>
                  <p className="mt-1 text-sm font-medium text-zinc-700">
                    {vesselById.get(selected.vessel_id)?.name ??
                      'Navire indisponible'}
                  </p>
                </div>
                <Link
                  className="text-sm font-medium text-zinc-500 hover:text-zinc-950"
                  href={`/tools/planning/escales?site=${site.id}`}
                >
                  Fermer
                </Link>
              </div>
              <form
                action={updatePortCallTiming}
                className="mt-5 space-y-4"
                key={selected.id}
              >
                <ScopeFields callId={selected.id} site={site} />
                <div className="border-b border-zinc-200 pb-3">
                  <h3 className="font-semibold">Modifier les heures</h3>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    Saisissez librement la date et l’heure, à la minute près.
                  </p>
                </div>
                <Field label="Nouvelle arrivée">
                  <input
                    className="field-input"
                    defaultValue={toLocalInput(
                      selected.estimated_arrival_at ??
                        selected.scheduled_arrival_at,
                      site.timezone,
                    )}
                    name="estimatedArrivalAt"
                    step="60"
                    type="datetime-local"
                  />
                  <TimingReference
                    estimated={selected.estimated_arrival_at}
                    scheduled={selected.scheduled_arrival_at}
                    timeZone={site.timezone}
                  />
                </Field>
                <Field label="Nouveau départ">
                  <input
                    className="field-input"
                    defaultValue={toLocalInput(
                      selected.estimated_departure_at ??
                        selected.scheduled_departure_at,
                      site.timezone,
                    )}
                    name="estimatedDepartureAt"
                    step="60"
                    type="datetime-local"
                  />
                  <TimingReference
                    estimated={selected.estimated_departure_at}
                    scheduled={selected.scheduled_departure_at}
                    timeZone={site.timezone}
                  />
                </Field>
                <Field label="État opérationnel">
                  <PlatformSelect
                    className="field-input"
                    defaultValue={selected.status}
                    name="status"
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </PlatformSelect>
                </Field>
                <p className="text-xs leading-5 text-zinc-500">
                  Le départ doit rester postérieur à l’arrivée. Toute
                  modification met automatiquement à jour les impacts sur le
                  planning.
                </p>
                <button
                  className="primary-button w-full justify-center"
                  type="submit"
                >
                  Enregistrer les nouvelles heures
                </button>
              </form>

              <details className="mt-6 border-t border-zinc-100 pt-4">
                <summary className="cursor-pointer text-sm font-semibold">
                  Besoins et charge
                </summary>
                <form action={assignDemandProfile} className="mt-4 space-y-3">
                  <ScopeFields callId={selected.id} site={site} />
                  <label className="field-label" htmlFor="demandProfileId">
                    Profil de besoin
                  </label>
                  <PlatformSelect
                    className="field-input"
                    defaultValue={selected.demand_profile_id ?? ''}
                    id="demandProfileId"
                    name="demandProfileId"
                  >
                    <option value="">Aucun profil</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name} · v{profile.version}
                      </option>
                    ))}
                  </PlatformSelect>
                  <button className="secondary-button w-full" type="submit">
                    Enregistrer le profil
                  </button>
                </form>

                <form
                  action={createLoadForecast}
                  className="mt-5 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-5"
                >
                  <ScopeFields callId={selected.id} site={site} />
                  <NumberField label="Passagers" name="passengerCount" />
                  <NumberField label="Dont piétons" name="passengerQuota" />
                  <NumberField label="Véhicules" name="vehicleCount" />
                  <NumberField label="Fret" name="freightUnitCount" />
                  <NumberField label="Autocars" name="coachCount" />
                  <button className="secondary-button col-span-2" type="submit">
                    Enregistrer la charge
                  </button>
                </form>

                {forecasts.length ? (
                  <p className="mt-4 text-xs text-zinc-500">
                    Dernière prévision : {forecasts[0].passenger_count}{' '}
                    passagers · {forecasts[0].passenger_quota ?? 0} piétons ·{' '}
                    {forecasts[0].vehicle_count} véhicules ·{' '}
                    {forecasts[0].freight_unit_count} unités fret ·{' '}
                    {forecasts[0].coach_count} autocars ·{' '}
                    {formatDate(forecasts[0].received_at, site.timezone)}
                  </p>
                ) : null}
                {forecastsResult.error ? (
                  <p className="mt-3 text-sm text-red-700">
                    Prévisions indisponibles.
                  </p>
                ) : null}
              </details>
            </section>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  children,
  label,
}: Readonly<{ children: ReactNode; label: string }>) {
  return (
    <label className="block space-y-2">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function NumberField({
  label,
  name,
}: Readonly<{ label: string; name: string }>) {
  return (
    <Field label={label}>
      <input
        className="field-input"
        defaultValue="0"
        min="0"
        name={name}
        required
        type="number"
      />
    </Field>
  );
}

function ScopeFields({
  callId,
  site,
}: Readonly<{ callId: string; site: Site }>) {
  return (
    <>
      <input name="organizationId" type="hidden" value={site.organization_id} />
      <input name="siteId" type="hidden" value={site.id} />
      <input name="portCallId" type="hidden" value={callId} />
      <input name="timeZone" type="hidden" value={site.timezone} />
    </>
  );
}

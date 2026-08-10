import Link from 'next/link';
import type { ReactNode } from 'react';

import { SiteSwitcher } from '../../../../components/site-switcher';
import { PlatformSelect } from '../../../../components/ui/platform-select';
import { apiFetch } from '../../../../lib/api/server';
import type {
  DemandProfile,
  DemandProfileLine,
  Position,
  Site,
} from '../../../../lib/api/types';
import { orderSites } from '../../../../lib/sites';
import { createDemandProfile, createDemandProfileLine } from '../actions';

type BesoinsPageProps = Readonly<{
  searchParams: Promise<{
    add?: string;
    error?: string;
    profile?: string;
    saved?: string;
    site?: string;
  }>;
}>;

function minutesLabel(value: number): string {
  if (value === 0) return 'à l’heure de référence';
  const direction = value < 0 ? 'avant' : 'après';
  const absolute = Math.abs(value);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  const duration = [hours ? `${hours} h` : '', minutes ? `${minutes} min` : '']
    .filter(Boolean)
    .join(' ');
  return `${duration} ${direction}`;
}

export default async function BesoinsPage({ searchParams }: BesoinsPageProps) {
  const params = await searchParams;
  const sitesResult = await apiFetch<Site[]>('/sites');
  const sites = orderSites(sitesResult.data ?? []);
  const site = sites.find((item) => item.id === params.site) ?? sites.at(0);
  const [profilesResult, positionsResult] = site
    ? await Promise.all([
        apiFetch<DemandProfile[]>(
          `/demand-profiles?siteId=${encodeURIComponent(site.id)}`,
        ),
        apiFetch<Position[]>(
          `/positions?organizationId=${encodeURIComponent(site.organization_id)}&siteId=${encodeURIComponent(site.id)}`,
        ),
      ])
    : [
        { data: [] as DemandProfile[], error: sitesResult.error },
        { data: [] as Position[], error: sitesResult.error },
      ];
  const profiles = profilesResult.data ?? [];
  const positions = positionsResult.data ?? [];
  const selected =
    profiles.find((profile) => profile.id === params.profile) ?? profiles.at(0);
  const linesResult = selected
    ? await apiFetch<DemandProfileLine[]>(
        `/demand-profiles/${encodeURIComponent(selected.id)}/lines`,
      )
    : { data: [] as DemandProfileLine[], error: null };
  const lines = linesResult.data ?? [];
  const positionsById = new Map(
    positions.map((position) => [position.id, position]),
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <Link
            aria-label="Retour aux réglages"
            className="secondary-button mb-4"
            href={`/tools/planning/referentiels?site=${site?.id ?? ''}`}
          >
            ← Retour aux réglages
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">
            Profils et besoins opérationnels
          </h1>
          <p className="mt-2 max-w-3xl text-zinc-600">
            Transformez une escale et sa charge prévisionnelle en postes à
            couvrir, relativement à l’arrivée ou au départ du navire.
          </p>
        </div>
        <Link
          className="primary-button"
          href={`?site=${site?.id ?? ''}&add=profile`}
        >
          Nouveau profil
        </Link>
      </header>

      {site ? (
        <SiteSwitcher
          path="/tools/planning/besoins"
          selectedSiteId={site.id}
          sites={sites}
        />
      ) : null}

      {params.saved ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Le modèle de besoin a été enregistré.
        </p>
      ) : null}
      {params.error ? (
        <p
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          Enregistrement impossible. Vérifiez la cohérence des seuils et vos
          habilitations.
        </p>
      ) : null}

      {site && params.add === 'profile' ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Créer un profil versionné</h2>
          <form
            action={createDemandProfile}
            className="mt-5 grid gap-4 md:grid-cols-3"
          >
            <input
              name="organizationId"
              type="hidden"
              value={site.organization_id}
            />
            <input name="siteId" type="hidden" value={site.id} />
            <Field label="Code">
              <input
                className="field-input"
                name="code"
                pattern="[A-Za-z0-9-]{2,32}"
                required
              />
            </Field>
            <Field label="Nom">
              <input className="field-input" name="name" required />
            </Field>
            <Field label="Version">
              <input
                className="field-input"
                defaultValue="1"
                min="1"
                name="version"
                required
                type="number"
              />
            </Field>
            <div className="flex gap-3 md:col-span-3 md:justify-end">
              <Link
                className="secondary-button"
                href={`/tools/planning/besoins?site=${site.id}`}
              >
                Annuler
              </Link>
              <button className="primary-button" type="submit">
                Créer
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {profilesResult.error || positionsResult.error || linesResult.error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Certaines données de dimensionnement ne sont pas disponibles.
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="px-2 text-sm font-semibold">Profils actifs</h2>
          {profiles.length ? (
            <nav aria-label="Profils de besoin" className="mt-3 space-y-1">
              {profiles.map((profile) => (
                <Link
                  className={`block rounded-xl px-3 py-3 text-sm transition ${
                    selected?.id === profile.id
                      ? 'bg-red-50 font-semibold text-red-800'
                      : 'text-zinc-600 hover:bg-zinc-50'
                  }`}
                  href={`?site=${site?.id ?? ''}&profile=${profile.id}`}
                  key={profile.id}
                >
                  <span className="block">{profile.name}</span>
                  <span className="mt-1 block font-mono text-xs text-zinc-400">
                    {profile.code} · v{profile.version}
                  </span>
                </Link>
              ))}
            </nav>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-zinc-300 p-5 text-center text-sm text-zinc-500">
              Aucun profil.
            </p>
          )}
        </aside>

        {site && selected ? (
          <div className="space-y-6">
            <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="eyebrow">
                {selected.code} · version {selected.version}
              </p>
              <h2 className="mt-2 text-xl font-semibold">
                Ajouter une règle de couverture
              </h2>
              <form
                action={createDemandProfileLine}
                className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
              >
                <input
                  name="organizationId"
                  type="hidden"
                  value={site.organization_id}
                />
                <input name="siteId" type="hidden" value={site.id} />
                <input name="profileId" type="hidden" value={selected.id} />
                <Field label="Poste">
                  <PlatformSelect name="positionId" required>
                    <option value="">Sélectionner</option>
                    {positions.map((position) => (
                      <option key={position.id} value={position.id}>
                        {position.name}
                      </option>
                    ))}
                  </PlatformSelect>
                </Field>
                <Field label="Référence temporelle">
                  <PlatformSelect name="anchor">
                    <option value="arrival">Arrivée</option>
                    <option value="departure">Départ</option>
                  </PlatformSelect>
                </Field>
                <NumberInput
                  defaultValue="-120"
                  label="Décalage (minutes)"
                  max="1440"
                  min="-1440"
                  name="startsOffsetMinutes"
                />
                <NumberInput
                  defaultValue="240"
                  label="Durée (minutes)"
                  max="1440"
                  min="15"
                  name="durationMinutes"
                />
                <NumberInput
                  defaultValue="1"
                  label="Socle d’agents"
                  max="100"
                  min="0"
                  name="baseAgents"
                />
                <NumberInput
                  defaultValue="1"
                  label="Minimum"
                  max="100"
                  min="0"
                  name="minimumAgents"
                />
                <NumberInput
                  label="Maximum (optionnel)"
                  max="100"
                  min="0"
                  name="maximumAgents"
                  required={false}
                />
                <NumberInput
                  label="Passagers / agent en plus"
                  min="1"
                  name="passengersPerExtraAgent"
                  required={false}
                />
                <NumberInput
                  label="Véhicules / agent en plus"
                  min="1"
                  name="vehiclesPerExtraAgent"
                  required={false}
                />
                <div className="flex items-end xl:col-span-3 xl:justify-end">
                  <button className="primary-button" type="submit">
                    Ajouter la règle
                  </button>
                </div>
              </form>
            </section>

            <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-6 py-5">
                <h2 className="font-semibold">Règles du profil</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {lines.length} règle{lines.length > 1 ? 's' : ''} de calcul
                </p>
              </div>
              {lines.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-50 text-xs text-zinc-500 uppercase">
                      <tr>
                        <th className="px-6 py-3">Poste</th>
                        <th className="px-6 py-3">Fenêtre</th>
                        <th className="px-6 py-3">Effectif</th>
                        <th className="px-6 py-3">Charge variable</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {lines.map((line) => (
                        <tr key={line.id}>
                          <td className="px-6 py-4 font-medium">
                            {positionsById.get(line.position_id)?.name ??
                              'Poste inconnu'}
                          </td>
                          <td className="px-6 py-4 text-zinc-600">
                            {minutesLabel(line.starts_offset_minutes)}{' '}
                            {line.anchor === 'arrival'
                              ? 'de l’arrivée'
                              : 'du départ'}{' '}
                            · {line.duration_minutes} min
                          </td>
                          <td className="px-6 py-4 text-zinc-600">
                            {line.base_agents} socle · min.{' '}
                            {line.minimum_agents} · max.{' '}
                            {line.maximum_agents ?? '—'}
                          </td>
                          <td className="px-6 py-4 text-zinc-600">
                            {line.passengers_per_extra_agent
                              ? `+1 / ${line.passengers_per_extra_agent} pax`
                              : '—'}
                            {line.vehicles_per_extra_agent
                              ? ` · +1 / ${line.vehicles_per_extra_agent} véhicules`
                              : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="p-10 text-center text-sm text-zinc-500">
                  Aucune règle définie pour ce profil.
                </p>
              )}
            </section>
          </div>
        ) : (
          <section className="grid min-h-64 place-items-center rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
            Créez un profil pour commencer à dimensionner les besoins.
          </section>
        )}
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

type NumberInputProps = Readonly<{
  defaultValue?: string;
  label: string;
  max?: string;
  min: string;
  name: string;
  required?: boolean;
}>;

function NumberInput({
  defaultValue,
  label,
  max,
  min,
  name,
  required = true,
}: NumberInputProps) {
  return (
    <Field label={label}>
      <input
        className="field-input"
        defaultValue={defaultValue}
        max={max}
        min={min}
        name={name}
        required={required}
        type="number"
      />
    </Field>
  );
}

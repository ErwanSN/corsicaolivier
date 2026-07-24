import Link from 'next/link';

import { SiteSwitcher } from '../../../../components/site-switcher';
import { PlatformSelect } from '../../../../components/ui/platform-select';
import { apiFetch } from '../../../../lib/api/server';
import type {
  Position,
  PositionSkillRequirement,
  Site,
  Skill,
  Vessel,
} from '../../../../lib/api/types';
import {
  createPosition,
  createSkill,
  createVessel,
  setPositionSkill,
} from '../actions';

type ReferentielsPageProps = Readonly<{
  searchParams: Promise<{
    add?: string;
    error?: string;
    position?: string;
    saved?: string;
    site?: string;
  }>;
}>;

export default async function ReferentielsPage({
  searchParams,
}: ReferentielsPageProps) {
  const params = await searchParams;
  const sitesResult = await apiFetch<Site[]>('/sites');
  const sites = sitesResult.data ?? [];
  const site = sites.find((item) => item.id === params.site) ?? sites.at(0);
  const [positionsResult, skillsResult, vesselsResult] = site
    ? await Promise.all([
        apiFetch<Position[]>(
          `/positions?organizationId=${encodeURIComponent(site.organization_id)}&siteId=${encodeURIComponent(site.id)}`,
        ),
        apiFetch<Skill[]>(
          `/skills?organizationId=${encodeURIComponent(site.organization_id)}`,
        ),
        apiFetch<Vessel[]>(
          `/vessels?organizationId=${encodeURIComponent(site.organization_id)}`,
        ),
      ])
    : [
        { data: [] as Position[], error: sitesResult.error },
        { data: [] as Skill[], error: sitesResult.error },
        { data: [] as Vessel[], error: sitesResult.error },
      ];
  const positions = positionsResult.data ?? [];
  const skills = skillsResult.data ?? [];
  const vessels = vesselsResult.data ?? [];
  const selectedPosition = positions.find(
    (position) => position.id === params.position,
  );
  const requirementsResult = selectedPosition
    ? await apiFetch<PositionSkillRequirement[]>(
        `/positions/${selectedPosition.id}/skills`,
      )
    : { data: [] as PositionSkillRequirement[], error: null };
  const requirements = requirementsResult.data ?? [];
  const skillById = new Map(skills.map((skill) => [skill.id, skill]));

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Postes et ressources
          </h1>
          <p className="mt-2 text-zinc-600">
            Configurez les postes, les compétences nécessaires et les navires.
          </p>
        </div>
        <details className="relative">
          <summary className="primary-button list-none">Ajouter</summary>
          <div className="absolute right-0 z-10 mt-2 w-56 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
            <Link
              className="block rounded-lg px-3 py-2 text-sm hover:bg-zinc-100"
              href={`?site=${site?.id ?? ''}&add=position`}
            >
              Un poste
            </Link>
            <Link
              className="block rounded-lg px-3 py-2 text-sm hover:bg-zinc-100"
              href={`?site=${site?.id ?? ''}&add=skill`}
            >
              Une compétence
            </Link>
            <Link
              className="block rounded-lg px-3 py-2 text-sm hover:bg-zinc-100"
              href={`?site=${site?.id ?? ''}&add=vessel`}
            >
              Un navire
            </Link>
          </div>
        </details>
      </header>

      {site ? (
        <SiteSwitcher
          path="/tools/planning/referentiels"
          selectedSiteId={site.id}
          sites={sites}
        />
      ) : null}

      {params.saved ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Le référentiel a été mis à jour.
        </p>
      ) : null}

      {site && params.add === 'position' ? (
        <ReferentialForm
          action={createPosition}
          organizationId={site.organization_id}
          siteId={site.id}
          title="Créer un poste"
          withDescription
        />
      ) : null}

      {site && params.add === 'skill' ? (
        <ReferentialForm
          action={createSkill}
          organizationId={site.organization_id}
          siteId={site.id}
          title="Ajouter une compétence"
          withDescription
        />
      ) : null}

      {site && params.add === 'vessel' ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Ajouter un navire</h2>
          <form
            action={createVessel}
            className="mt-6 grid gap-5 md:grid-cols-3"
          >
            <input
              name="organizationId"
              type="hidden"
              value={site.organization_id}
            />
            <input name="siteId" type="hidden" value={site.id} />
            <Field
              id="vesselCode"
              label="Code"
              name="code"
              pattern="[A-Za-z0-9-]+"
            />
            <Field id="vesselName" label="Nom" name="name" />
            <Field
              id="imoNumber"
              label="Numéro IMO (optionnel)"
              name="imoNumber"
              pattern="[0-9]{7}"
              required={false}
            />
            <FormFooter siteId={site.id} />
          </form>
        </section>
      ) : null}

      {site && selectedPosition ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <h2 className="text-xl font-semibold">{selectedPosition.name}</h2>
              <p className="mt-2 text-sm text-zinc-500">
                Une compétence obligatoire manquante ou expirée bloque
                l’affectation.
              </p>
            </div>
            <Link
              className="text-sm font-medium text-zinc-500 hover:text-zinc-900"
              href={`/tools/planning/referentiels?site=${site.id}`}
            >
              Fermer
            </Link>
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <ul className="space-y-2">
              {requirements.map((requirement) => (
                <li
                  className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 text-sm"
                  key={requirement.id}
                >
                  <div>
                    <p className="font-medium">
                      {skillById.get(requirement.skill_id)?.name ??
                        'Compétence archivée'}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Niveau minimum {requirement.minimum_level}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      requirement.mandatory
                        ? 'bg-red-50 text-red-700'
                        : 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    {requirement.mandatory ? 'Obligatoire' : 'Recommandée'}
                  </span>
                </li>
              ))}
              {!requirements.length ? (
                <li className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
                  Aucune exigence.
                </li>
              ) : null}
            </ul>
            <form
              action={setPositionSkill}
              className="grid gap-4 rounded-xl bg-zinc-50 p-5 sm:grid-cols-2"
            >
              <input
                name="organizationId"
                type="hidden"
                value={site.organization_id}
              />
              <input name="siteId" type="hidden" value={site.id} />
              <input
                name="positionId"
                type="hidden"
                value={selectedPosition.id}
              />
              <div className="space-y-2 sm:col-span-2">
                <label className="field-label" htmlFor="requiredSkill">
                  Compétence
                </label>
                <PlatformSelect
                  className="field-input"
                  id="requiredSkill"
                  name="skillId"
                  required
                >
                  <option value="">Sélectionner</option>
                  {skills.map((skill) => (
                    <option key={skill.id} value={skill.id}>
                      {skill.name}
                    </option>
                  ))}
                </PlatformSelect>
              </div>
              <div className="space-y-2">
                <label className="field-label" htmlFor="requiredLevel">
                  Niveau minimum
                </label>
                <input
                  className="field-input"
                  defaultValue="1"
                  id="requiredLevel"
                  max="5"
                  min="1"
                  name="minimumLevel"
                  required
                  type="number"
                />
              </div>
              <label className="flex h-11 items-center gap-3 self-end rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium">
                <input defaultChecked name="mandatory" type="checkbox" />
                Obligatoire
              </label>
              <div className="sm:col-span-2 sm:text-right">
                <button className="primary-button" type="submit">
                  Enregistrer l’exigence
                </button>
              </div>
            </form>
          </div>
        </section>
      ) : null}

      {params.error ? (
        <p
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          Le référentiel n’a pas pu être enregistré. Vérifiez les données et vos
          habilitations.
        </p>
      ) : null}

      {positionsResult.error ||
      skillsResult.error ||
      vesselsResult.error ||
      requirementsResult.error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Certains référentiels ne sont pas disponibles.
        </p>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-3">
        <ReferentialList
          description="Fonctions de travail affectables dans un shift."
          empty="Aucun poste défini."
          items={positions}
          linkPrefix={`?site=${site?.id ?? ''}&position=`}
          title="Postes opérationnels"
        />
        <ReferentialList
          description="Habilitations vérifiées avec niveau et date de validité."
          empty="Aucune compétence définie."
          items={skills}
          title="Compétences"
        />
        <ReferentialList
          description="Navires utilisables dans les programmes d’escales."
          empty="Aucun navire défini."
          items={vessels}
          title="Navires"
        />
      </section>
    </div>
  );
}

type FieldProps = Readonly<{
  id: string;
  label: string;
  name: string;
  pattern?: string;
  required?: boolean;
}>;

function Field({ id, label, name, pattern, required = true }: FieldProps) {
  return (
    <div className="space-y-2">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        className="field-input"
        id={id}
        name={name}
        pattern={pattern}
        required={required}
      />
    </div>
  );
}

function FormFooter({ siteId }: Readonly<{ siteId: string }>) {
  return (
    <div className="flex gap-3 md:col-span-full md:justify-end">
      <Link
        className="inline-flex h-11 items-center px-4 text-sm font-medium text-zinc-500"
        href={`/tools/planning/referentiels?site=${siteId}`}
      >
        Annuler
      </Link>
      <button className="primary-button" type="submit">
        Enregistrer
      </button>
    </div>
  );
}

type ReferentialFormProps = Readonly<{
  action: (formData: FormData) => Promise<void>;
  organizationId: string;
  siteId: string;
  title: string;
  withDescription?: boolean;
}>;

function ReferentialForm({
  action,
  organizationId,
  siteId,
  title,
  withDescription,
}: ReferentialFormProps) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">{title}</h2>
      <form action={action} className="mt-6 grid gap-5 md:grid-cols-2">
        <input name="organizationId" type="hidden" value={organizationId} />
        <input name="siteId" type="hidden" value={siteId} />
        <Field
          id={`${title}-code`}
          label="Code"
          name="code"
          pattern="[A-Za-z0-9-]+"
        />
        <Field id={`${title}-name`} label="Nom" name="name" />
        {withDescription ? (
          <div className="space-y-2 md:col-span-2">
            <label className="field-label" htmlFor={`${title}-description`}>
              Description
            </label>
            <input
              className="field-input"
              id={`${title}-description`}
              name="description"
            />
          </div>
        ) : null}
        <FormFooter siteId={siteId} />
      </form>
    </section>
  );
}

type ReferentialItem = Readonly<{
  id: string;
  code: string;
  name: string;
}>;

type ReferentialListProps = Readonly<{
  title: string;
  description: string;
  empty: string;
  items: readonly ReferentialItem[];
  linkPrefix?: string;
}>;

function ReferentialList({
  title,
  description,
  empty,
  items,
  linkPrefix,
}: ReferentialListProps) {
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-500">
          {items.length}
        </span>
      </div>
      <p className="mt-3 min-h-12 text-sm leading-6 text-zinc-500">
        {description}
      </p>
      {items.length ? (
        <ul className="mt-4 divide-y divide-zinc-100">
          {items.map((item) => (
            <li
              className="flex items-center justify-between py-3"
              key={item.id}
            >
              {linkPrefix ? (
                <Link
                  className="text-sm font-medium hover:text-red-700"
                  href={`${linkPrefix}${item.id}`}
                >
                  {item.name}
                </Link>
              ) : (
                <span className="text-sm font-medium">{item.name}</span>
              )}
              <span className="font-mono text-xs text-zinc-400">
                {item.code}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500">
          {empty}
        </div>
      )}
    </article>
  );
}

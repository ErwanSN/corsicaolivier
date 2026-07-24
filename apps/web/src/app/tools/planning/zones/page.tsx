import Link from 'next/link';

import { apiFetch } from '../../../../lib/api/server';
import type { Site } from '../../../../lib/api/types';
import { orderSites } from '../../../../lib/sites';
import { createZone } from '../actions';

type ZonesPageProps = Readonly<{
  searchParams: Promise<{
    add?: string;
    error?: string;
    saved?: string;
  }>;
}>;

export default async function ZonesPage({ searchParams }: ZonesPageProps) {
  const params = await searchParams;
  const sitesResult = await apiFetch<Site[]>('/sites');
  const sites = orderSites(sitesResult.data ?? []);
  const organizationId = sites.at(0)?.organization_id;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Zones de travail
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Une zone est un lieu de travail : Janet, Joliette, Toulon, etc.
          </p>
        </div>
        {organizationId && !params.add ? (
          <Link className="primary-button" href="/tools/planning/zones?add=1">
            Créer une zone de travail
          </Link>
        ) : null}
      </header>

      {params.saved ? (
        <p className="border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Zone créée.
        </p>
      ) : null}
      {params.error ? (
        <p
          className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          Impossible de créer la zone. Vérifiez son nom et vos habilitations.
        </p>
      ) : null}

      {params.add && organizationId ? (
        <section className="border border-zinc-400 bg-white p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Créer une zone</h2>
            <Link
              className="text-sm font-medium text-zinc-500 hover:text-zinc-950"
              href="/tools/planning/zones"
            >
              Annuler et revenir à la liste
            </Link>
          </div>
          <form
            action={createZone}
            className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <input name="organizationId" type="hidden" value={organizationId} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <label className="field-label" htmlFor="zoneName">
                Nom de la zone
              </label>
              <input
                autoFocus
                className="field-input"
                id="zoneName"
                maxLength={120}
                name="name"
                placeholder="Ex. Port de Toulon"
                required
              />
            </div>
            <button className="primary-button" type="submit">
              Créer la zone
            </button>
          </form>
        </section>
      ) : null}

      {sites.length ? (
        <section className="border border-zinc-300 bg-white">
          <div className="border-b border-zinc-300 bg-zinc-50 px-4 py-3">
            <h2 className="font-semibold">Zones existantes ({sites.length})</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Cliquez sur une zone pour voir les collaborateurs qui y
              travaillent.
            </p>
          </div>
          <div className="divide-y divide-zinc-200">
            {sites.map((site, index) => (
              <article
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center"
                key={site.id}
              >
                <span className="grid size-8 shrink-0 place-items-center border border-zinc-300 bg-zinc-50 text-sm font-bold text-zinc-600">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{site.name}</h3>
                  <p className="text-xs text-zinc-500">Zone active</p>
                </div>
                <Link
                  className="secondary-button"
                  href={`/tools/planning/agents?site=${site.id}`}
                >
                  Voir les collaborateurs de cette zone →
                </Link>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="grid min-h-64 place-items-center border border-dashed border-zinc-400 text-sm text-zinc-600">
          Aucune zone. Cliquez sur « Créer une zone de travail ».
        </section>
      )}
    </div>
  );
}

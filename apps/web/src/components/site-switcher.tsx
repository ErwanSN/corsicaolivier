import Link from 'next/link';

import type { Site } from '../lib/api/types';

type SiteSwitcherProps = Readonly<{
  path: string;
  selectedSiteId: string;
  sites: Site[];
}>;

export function SiteSwitcher({
  path,
  selectedSiteId,
  sites,
}: SiteSwitcherProps) {
  if (sites.length < 2) return null;

  return (
    <nav
      aria-label="Choisir la zone de travail"
      className="flex flex-wrap border border-zinc-400 bg-white"
    >
      {sites.map((site) => (
        <Link
          aria-current={site.id === selectedSiteId ? 'page' : undefined}
          className={`border-r border-zinc-300 px-4 py-2 text-sm font-semibold last:border-r-0 ${
            site.id === selectedSiteId
              ? 'bg-zinc-950 text-white'
              : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950'
          }`}
          href={`${path}?site=${encodeURIComponent(site.id)}`}
          key={site.id}
        >
          {site.name.replace('Marseille ', '')}
        </Link>
      ))}
    </nav>
  );
}

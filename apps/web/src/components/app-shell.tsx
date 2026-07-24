'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { logout } from '../app/login/actions';

type AppShellProps = Readonly<{
  children: ReactNode;
  userLabel: string;
}>;

const navigation = [
  { href: '/tools/planning', label: 'Planning', mobileLabel: 'Planning' },
  {
    href: '/tools/planning/agents',
    label: 'Collaborateurs',
    mobileLabel: 'Équipe',
  },
  { href: '/tools/planning/zones', label: 'Zones', mobileLabel: 'Zones' },
  {
    href: '/tools/planning/groupes',
    label: 'Groupes',
    mobileLabel: 'Groupes',
  },
  { href: '/tools/planning/escales', label: 'Escales', mobileLabel: 'Escales' },
] as const;

function isCurrentPath(pathname: string, href: string): boolean {
  if (href === '/tools/planning') return pathname === href;
  return pathname.startsWith(href);
}

export function AppShell({ children, userLabel }: AppShellProps) {
  const pathname = usePathname();
  const currentSection =
    navigation.find((item) => isCurrentPath(pathname, item.href))?.label ??
    'Tools Panel';

  return (
    <div className="min-h-svh bg-zinc-50 text-zinc-950">
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-zinc-200 bg-white lg:flex"
        data-app-shell-sidebar
      >
        <Link
          aria-label="Accueil du Tools Panel"
          className="flex h-16 items-center border-b border-zinc-100 px-5"
          href="/tools/planning"
        >
          <Image
            alt="Corsica Linea"
            className="h-10 w-auto object-contain"
            height={506}
            priority
            src="/brand/corsica-linea.webp"
            width={1800}
          />
        </Link>

        <nav aria-label="Navigation principale" className="flex-1 p-3">
          <p className="px-3 pb-2 pt-3 text-xs font-medium text-zinc-400">
            Espace de travail
          </p>
          <div className="space-y-1">
            {navigation.map((item) => {
              const current = isCurrentPath(pathname, item.href);

              return (
                <Link
                  aria-current={current ? 'page' : undefined}
                  className={`flex h-11 items-center border-l-4 px-3 text-sm font-medium transition ${
                    current
                      ? 'border-red-600 bg-red-50 text-red-700'
                      : 'border-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
                  }`}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-zinc-100 p-3">
          <Link
            className="flex h-10 items-center border-l-4 border-transparent px-3 text-sm text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
            href="/tools/planning/referentiels"
          >
            Réglages des postes
          </Link>
          <div className="mt-2 border border-zinc-200 bg-zinc-50 p-3">
            <p className="truncate text-sm font-medium">{userLabel}</p>
            <form action={logout} className="mt-2">
              <button
                className="text-xs font-medium text-zinc-500 hover:text-red-700"
                type="submit"
              >
                Se déconnecter
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="lg:pl-56" data-app-shell-content>
        <header
          className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-zinc-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8"
          data-app-shell-header
        >
          <div className="flex items-center gap-3">
            <Link
              aria-label="Accueil du Tools Panel"
              className="shrink-0 lg:hidden"
              href="/tools/planning"
            >
              <Image
                alt="Corsica Linea"
                className="h-7 w-auto object-contain"
                height={506}
                priority
                src="/brand/corsica-linea.webp"
                width={1800}
              />
            </Link>
            <div>
              <p className="text-sm font-semibold">{currentSection}</p>
            </div>
          </div>
          <p className="max-w-40 truncate text-sm text-zinc-500 lg:hidden">
            {userLabel}
          </p>
        </header>

        <main
          className="mx-auto max-w-7xl p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8"
          data-app-shell-main
        >
          {children}
        </main>
      </div>

      <nav
        aria-label="Navigation mobile"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-zinc-200 bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 lg:hidden"
        data-app-shell-mobile-nav
      >
        {navigation.map((item) => {
          const current = isCurrentPath(pathname, item.href);

          return (
            <Link
              aria-current={current ? 'page' : undefined}
              className={`flex min-h-11 items-center justify-center border-t-2 px-2 text-xs font-semibold ${
                current
                  ? 'border-red-600 bg-red-50 text-red-700'
                  : 'border-transparent text-zinc-500'
              }`}
              href={item.href}
              key={item.href}
            >
              {item.mobileLabel}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

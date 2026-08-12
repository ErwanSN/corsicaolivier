'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

import corsicaLogo from '../assets/brand/corsica-linea.webp';
import type { AgentNotification } from '../lib/api/types';
import { NotificationCenter } from './notification-center';

type AppShellProps = Readonly<{
  children: ReactNode;
  notificationHasMore: boolean;
  notificationLoadError: boolean;
  notificationTotal: number;
  notifications: ReadonlyArray<AgentNotification>;
  userLabel: string;
}>;

const navigation = [
  { href: '/tools/planning', label: 'Planning', mobileLabel: 'Planning' },
  {
    href: '/tools/planning/agents',
    label: 'Collaborateurs',
    mobileLabel: 'Équipe',
  },
  { href: '/tools/planning/escales', label: 'Escales', mobileLabel: 'Escales' },
  {
    href: '/tools/planning/referentiels',
    label: 'Réglages',
    mobileLabel: 'Réglages',
  },
] as const;

function isCurrentPath(pathname: string, href: string): boolean {
  if (href === '/tools/planning') return pathname === href;
  if (href === '/tools/planning/referentiels') {
    return [
      '/tools/planning/referentiels',
      '/tools/planning/zones',
      '/tools/planning/groupes',
      '/tools/planning/besoins',
    ].some((path) => pathname.startsWith(path));
  }
  return pathname.startsWith(href);
}

function navigationHref(href: string, siteId: string | null): string {
  if (!siteId) return href;
  const params = new URLSearchParams({ site: siteId });
  return `${href}?${params.toString()}`;
}

function LogoutButton({ compact = false }: Readonly<{ compact?: boolean }>) {
  const { pending } = useFormStatus();

  return (
    <button
      aria-label="Se déconnecter"
      className={
        compact
          ? 'h-9 border border-zinc-300 px-3 text-xs font-semibold text-zinc-700 transition hover:border-red-600 hover:text-red-700 disabled:cursor-wait disabled:opacity-60'
          : 'flex h-10 w-full items-center justify-center border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 transition hover:border-red-600 hover:text-red-700 disabled:cursor-wait disabled:opacity-60'
      }
      disabled={pending}
      type="submit"
    >
      {pending ? (
        'Déconnexion…'
      ) : compact ? (
        <>
          <span className="hidden min-[360px]:inline">Déconnexion</span>
          <span className="min-[360px]:hidden">Quitter</span>
        </>
      ) : (
        'Se déconnecter'
      )}
    </button>
  );
}

export function AppShell({
  children,
  notificationHasMore,
  notificationLoadError,
  notificationTotal,
  notifications,
  userLabel,
}: AppShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const siteId = searchParams.get('site');
  const planningHref = navigationHref('/tools/planning', siteId);
  const currentSection =
    navigation.find((item) => isCurrentPath(pathname, item.href))?.label ??
    'Planning';

  return (
    <div className="min-h-svh bg-zinc-50 text-zinc-950">
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-zinc-200 bg-white lg:flex"
        data-app-shell-sidebar
      >
        <Link
          aria-label="Accueil Corsica Linea"
          className="flex h-16 items-center border-b border-zinc-100 px-5"
          href={planningHref}
        >
          <Image
            alt="Corsica Linea"
            className="h-10 w-auto object-contain"
            height={40}
            loading="eager"
            sizes="144px"
            src={corsicaLogo}
            width={144}
          />
        </Link>

        <nav aria-label="Navigation principale" className="flex-1 p-3 pt-4">
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
                  href={navigationHref(item.href, siteId)}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-zinc-100 p-3">
          <NotificationCenter
            loadError={notificationLoadError}
            hasMore={notificationHasMore}
            notifications={notifications}
            total={notificationTotal}
            variant="desktop"
          />
          <div className="mt-2 border border-zinc-200 bg-zinc-50 p-3">
            <p className="truncate text-sm font-medium">{userLabel}</p>
            <form action="/logout" className="mt-2" method="post">
              <LogoutButton />
            </form>
          </div>
        </div>
      </aside>

      <div className="lg:pl-56" data-app-shell-content>
        <header
          className="sticky top-0 z-20 flex h-16 items-center justify-between gap-2 border-b border-zinc-200 bg-white/95 px-3 backdrop-blur sm:px-6 lg:hidden"
          data-app-shell-header
        >
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link
              aria-label="Accueil Corsica Linea"
              className="shrink-0 lg:hidden"
              href={planningHref}
            >
              <Image
                alt="Corsica Linea"
                className="h-7 w-auto max-w-24 object-contain"
                height={28}
                loading="eager"
                sizes="100px"
                src={corsicaLogo}
                width={100}
              />
            </Link>
            <p className="hidden truncate text-sm font-semibold min-[380px]:block">
              {currentSection}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="hidden max-w-40 truncate text-sm text-zinc-500 sm:block">
              {userLabel}
            </p>
            <NotificationCenter
              loadError={notificationLoadError}
              hasMore={notificationHasMore}
              notifications={notifications}
              total={notificationTotal}
              variant="mobile"
            />
            <form action="/logout" method="post">
              <LogoutButton compact />
            </form>
          </div>
        </header>

        <main
          className="mx-auto max-w-7xl p-3 pb-24 sm:p-6 sm:pb-24 lg:p-8"
          data-app-shell-main
        >
          {children}
        </main>
      </div>

      <nav
        aria-label="Navigation mobile"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-zinc-200 bg-white px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 lg:hidden"
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
              href={navigationHref(item.href, siteId)}
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

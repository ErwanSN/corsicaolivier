'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

import { logout } from '../app/login/actions';

type AppShellProps = Readonly<{
  children: ReactNode;
  userLabel: string;
}>;

const navigation = [
  { href: '/tools/planning', label: 'Planning' },
  { href: '/tools/planning/agents', label: 'Collaborateurs' },
  { href: '/tools/planning/escales', label: 'Escales' },
  { href: '/tools/planning/referentiels', label: 'Réglages' },
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

function LogoutButton() {
  const { pending } = useFormStatus();

  return (
    <button
      aria-label="Se déconnecter"
      className="flex h-10 w-full items-center justify-center border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 transition hover:border-red-600 hover:text-red-700 disabled:cursor-wait disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? 'Déconnexion…' : 'Se déconnecter'}
    </button>
  );
}

export function AppShell({ children, userLabel }: AppShellProps) {
  const pathname = usePathname();
  const currentSection =
    navigation.find((item) => isCurrentPath(pathname, item.href))?.label ??
    'Planning';

  return (
    <div className="min-h-svh bg-zinc-50 text-zinc-950">
      <header
        className="sticky top-0 z-[60] flex h-14 items-center border-b border-zinc-200 bg-white/95 px-4 backdrop-blur sm:px-5"
        data-app-shell-header
      >
        <Link
          aria-label="Accueil Corsica Linea"
          className="shrink-0"
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
        <span className="mx-3 h-5 w-px bg-zinc-200" aria-hidden="true" />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">
          {currentSection}
        </p>

        <details className="group relative">
          <summary className="flex h-9 cursor-pointer list-none items-center border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 hover:border-zinc-500 hover:text-zinc-950">
            Menu
          </summary>
          <div className="absolute right-0 top-11 w-64 border border-zinc-300 bg-white p-2">
            <nav aria-label="Navigation principale" className="grid gap-1">
              {navigation.map((item) => {
                const current = isCurrentPath(pathname, item.href);

                return (
                  <Link
                    aria-current={current ? 'page' : undefined}
                    className={`flex h-10 items-center border-l-2 px-3 text-sm font-medium transition ${
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
            </nav>
            <div className="mt-2 border-t border-zinc-200 p-2 pt-3">
              <p className="mb-2 truncate text-xs text-zinc-500">
                {userLabel}
              </p>
              <form action={logout}>
                <LogoutButton />
              </form>
            </div>
          </div>
        </details>
      </header>

      <main
        className="mx-auto max-w-[100rem] p-3 sm:p-4 lg:p-5"
        data-app-shell-main
      >
        {children}
      </main>
    </div>
  );
}

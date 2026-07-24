import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { AppShell } from '../../components/app-shell';
import { getPublicSupabaseConfig } from '../../lib/supabase/config';
import { createSupabaseServerClient } from '../../lib/supabase/server';

type ToolsLayoutProps = Readonly<{ children: ReactNode }>;

export default async function ToolsLayout({ children }: ToolsLayoutProps) {
  const config = getPublicSupabaseConfig();

  if (!config) {
    return (
      <main className="grid min-h-svh place-items-center bg-zinc-100 p-6">
        <section className="w-full max-w-xl rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="eyebrow">Configuration requise</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Le Tools Panel est prêt à être connecté.
          </h1>
          <p className="mt-4 leading-7 text-zinc-600">
            Ajoutez les variables Supabase publiques à l’environnement web, puis
            relancez l’application. Aucune clé privilégiée ne doit être exposée
            côté navigateur.
          </p>
        </section>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = (await supabase?.auth.getUser()) ?? {
    data: { user: null },
    error: null,
  };

  if (error || !data.user) {
    redirect('/login');
  }

  const label =
    data.user.user_metadata.full_name ??
    data.user.user_metadata.name ??
    data.user.email ??
    'Utilisateur';

  return <AppShell userLabel={String(label)}>{children}</AppShell>;
}

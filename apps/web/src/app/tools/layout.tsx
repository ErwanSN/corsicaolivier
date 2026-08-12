import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { AppShell } from '../../components/app-shell';
import { apiFetch } from '../../lib/api/server';
import type { AgentNotificationPage } from '../../lib/api/types';
import { getServerSupabaseConfig } from '../../lib/supabase/config';
import { createSupabaseServerClient } from '../../lib/supabase/server';

type ToolsLayoutProps = Readonly<{ children: ReactNode }>;

export default async function ToolsLayout({ children }: ToolsLayoutProps) {
  const config = getServerSupabaseConfig();

  if (!config) {
    return (
      <main className="grid min-h-svh place-items-center bg-zinc-100 p-6">
        <section className="w-full max-w-xl rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="eyebrow">Configuration requise</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            L’espace Corsica Linea est prêt à être connecté.
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
  let identity;
  let assurance;
  try {
    identity = (await supabase?.auth.getUser()) ?? {
      data: { user: null },
      error: null,
    };
    assurance = await supabase?.auth.mfa.getAuthenticatorAssuranceLevel();
  } catch {
    redirect('/mfa');
  }
  const { data, error } = identity;

  if (error || !data.user) {
    redirect('/login');
  }

  if (assurance?.error || assurance?.data.currentLevel !== 'aal2') {
    redirect('/mfa');
  }

  const label =
    data.user.user_metadata.full_name ??
    data.user.user_metadata.name ??
    data.user.email ??
    'Utilisateur';

  const notificationsResult = await apiFetch<AgentNotificationPage>(
    '/notifications?pageSize=30&unreadOnly=true',
  );

  return (
    <AppShell
      notificationLoadError={Boolean(notificationsResult.error)}
      notificationHasMore={notificationsResult.data?.hasMore ?? false}
      notifications={notificationsResult.data?.items ?? []}
      notificationTotal={notificationsResult.data?.total ?? 0}
      userLabel={String(label)}
    >
      {children}
    </AppShell>
  );
}

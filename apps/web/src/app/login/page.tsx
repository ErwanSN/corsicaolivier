import Image from 'next/image';
import { redirect } from 'next/navigation';

import { getPublicSupabaseConfig } from '../../lib/supabase/config';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  const config = getPublicSupabaseConfig();
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase?.auth.getClaims()) ?? { data: null };

  if (data?.claims) {
    redirect('/tools');
  }

  return (
    <main className="grid min-h-svh lg:grid-cols-[1.15fr_0.85fr]">
      <section className="relative hidden overflow-hidden bg-[#17191d] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-32 -top-32 size-96 rounded-full bg-red-600/20 blur-3xl" />
        <Image
          alt="Corsica Linea"
          className="relative h-12 w-auto object-contain"
          height={506}
          priority
          src="/brand/corsica-linea.webp"
          width={1800}
        />
        <div className="relative max-w-xl">
          <p className="mb-5 text-xs font-semibold tracking-[0.22em] text-red-400 uppercase">
            Opérations portuaires
          </p>
          <h1 className="text-5xl leading-[1.08] font-semibold tracking-tight">
            Tous vos outils métier, réunis au même endroit.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-zinc-400">
            Un espace sécurisé pour piloter les équipes, anticiper les escales
            et garder chaque opération sous contrôle.
          </p>
        </div>
        <div className="relative flex gap-8 text-sm text-zinc-500">
          <span>Accès sécurisé</span>
          <span>Traçabilité complète</span>
          <span>Temps réel</span>
        </div>
      </section>
      <section className="flex items-center justify-center bg-zinc-50 px-6 py-12">
        <div className="w-full max-w-md">
          <Image
            alt="Corsica Linea"
            className="mb-10 h-10 w-auto object-contain lg:hidden"
            height={506}
            priority
            src="/brand/corsica-linea.webp"
            width={1800}
          />
          <p className="eyebrow">Espace collaborateurs</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
            Heureux de vous revoir
          </h2>
          <p className="mt-3 leading-7 text-zinc-600">
            Connectez-vous avec votre compte professionnel Corsica Linea.
          </p>
          {config ? (
            <LoginForm />
          ) : (
            <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
              L’environnement Supabase n’est pas encore configuré. Renseignez
              les variables publiques indiquées dans <code>.env.example</code>.
            </div>
          )}
          <p className="mt-8 text-center text-xs leading-5 text-zinc-500">
            Accès réservé aux personnes habilitées. Toutes les actions sensibles
            sont journalisées.
          </p>
        </div>
      </section>
    </main>
  );
}

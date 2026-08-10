import Image from 'next/image';
import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '../../lib/supabase/server';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase?.auth.getClaims()) ?? { data: null };

  if (data?.claims) {
    redirect('/tools');
  }

  return (
    <main className="grid min-h-svh bg-white lg:grid-cols-[minmax(0,1.2fr)_minmax(28rem,0.8fr)]">
      <section className="relative min-h-52 overflow-hidden bg-zinc-900 sm:min-h-72 lg:min-h-full">
        <Image
          alt="Flotte Corsica Linea en mer"
          className="object-cover object-center"
          fill
          priority
          sizes="(min-width: 1024px) 60vw, 100vw"
          src="/brand/corsica-linea-background.webp"
        />
        <div
          className="absolute left-4 top-4 z-10 bg-white/95 px-4 py-3 shadow-sm sm:left-6 sm:top-6"
          data-login-logo
        >
          <Image
            alt="Corsica Linea"
            className="h-8 w-auto object-contain sm:h-10"
            height={506}
            priority
            src="/brand/corsica-linea.webp"
            width={1800}
          />
        </div>
      </section>

      <section className="flex px-6 py-10 sm:px-10 lg:px-16 lg:py-12">
        <div className="mx-auto flex w-full max-w-sm flex-col justify-center">
          <header className="text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
              Connexion
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Accédez à vos outils opérationnels.
            </p>
          </header>

          {supabase ? (
            <LoginForm />
          ) : (
            <div
              className="mt-8 border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"
              role="status"
            >
              Le service de connexion n’est pas configuré.
            </div>
          )}

          <p className="mt-10 border-t border-zinc-200 pt-5 text-xs leading-5 text-zinc-500">
            Accès réservé aux équipes habilitées de Corsica Linea.
          </p>
        </div>
      </section>
    </main>
  );
}

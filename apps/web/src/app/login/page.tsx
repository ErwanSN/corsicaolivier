import Image from 'next/image';
import { redirect } from 'next/navigation';

import loginBackground from '../../assets/brand/corsica-linea-background.webp';
import corsicaHead from '../../assets/brand/corsica-linea-head.webp';
import { createSupabaseServerClient } from '../../lib/supabase/server';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  let authUnavailable = false;
  let destination: '/tools' | '/mfa' | null = null;

  if (supabase) {
    try {
      const identity = await supabase.auth.getUser();
      authUnavailable = Boolean(identity.error);

      if (identity.data.user && !identity.error) {
        const assurance =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (assurance.error || !assurance.data?.currentLevel) {
          authUnavailable = true;
        } else {
          destination =
            assurance.data.currentLevel === 'aal2' ? '/tools' : '/mfa';
        }
      }
    } catch {
      authUnavailable = true;
    }
  }

  if (destination) redirect(destination);

  return (
    <main className="grid min-h-svh bg-white lg:grid-cols-[minmax(0,1.2fr)_minmax(28rem,0.8fr)]">
      <section className="relative min-h-52 overflow-hidden bg-zinc-900 sm:min-h-72 lg:min-h-full">
        <Image
          alt="Flotte Corsica Linea en mer"
          className="object-cover object-center"
          fill
          placeholder="blur"
          preload
          sizes="(min-width: 1024px) 60vw, 100vw"
          src={loginBackground}
        />
      </section>

      <section className="flex px-6 py-10 sm:px-10 lg:px-16 lg:py-12">
        <div className="mx-auto flex w-full max-w-sm flex-col justify-center">
          <Image
            alt="Tête corse Corsica Linea"
            className="h-20 w-20 self-center object-contain"
            height={80}
            loading="eager"
            sizes="80px"
            src={corsicaHead}
            width={80}
          />

          <header className="mt-6 text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
              Connexion
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Accédez à vos outils opérationnels.
            </p>
          </header>

          {supabase ? (
            <>
              {authUnavailable ? (
                <p
                  className="mt-8 border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"
                  role="alert"
                >
                  Le service de sécurité répond mal. Vous pouvez réessayer sans
                  quitter cette page.
                </p>
              ) : null}
              <LoginForm />
            </>
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

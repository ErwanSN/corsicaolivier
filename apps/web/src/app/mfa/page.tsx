import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '../../lib/supabase/server';
import { MfaForm } from './mfa-form';

export default async function MfaPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect('/login');

  let user;
  let assurance;
  let factors;
  try {
    user = await supabase.auth.getUser();
    assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    factors = await supabase.auth.mfa.listFactors();
  } catch {
    return (
      <main className="grid min-h-svh place-items-center bg-zinc-100 px-6 py-10">
        <section className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Vérification indisponible</h1>
          <p className="mt-4 text-sm leading-6 text-zinc-600" role="alert">
            Le service de sécurité ne répond pas. Réessayez dans quelques
            instants.
          </p>
          <form action="/logout" className="mt-6" method="post">
            <button className="secondary-button w-full" type="submit">
              Se déconnecter
            </button>
          </form>
        </section>
      </main>
    );
  }
  if (user.error || !user.data.user) redirect('/login');

  if (assurance.data?.currentLevel === 'aal2') redirect('/tools');

  const verifiedFactor = factors.data?.totp.find(
    (factor) => factor.status === 'verified',
  );

  return (
    <main className="grid min-h-svh place-items-center bg-zinc-100 px-6 py-10">
      <section className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="eyebrow">Sécurité</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">
          Vérification en deux étapes
        </h1>
        {assurance.error || factors.error ? (
          <p
            className="mt-6 border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            role="alert"
          >
            La vérification est momentanément indisponible. Reconnectez-vous ou
            réessayez dans quelques instants.
          </p>
        ) : (
          <MfaForm verifiedFactorId={verifiedFactor?.id} />
        )}
        <form action="/logout" className="mt-6 text-center" method="post">
          <button
            className="text-sm font-medium text-zinc-500 hover:text-zinc-900"
            type="submit"
          >
            Se déconnecter
          </button>
        </form>
      </section>
    </main>
  );
}

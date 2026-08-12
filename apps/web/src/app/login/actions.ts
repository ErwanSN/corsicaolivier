'use server';

import { redirect } from 'next/navigation';

import { createAuthRateLimitIdentity } from '../../lib/supabase/auth-rate-limit';
import { createSupabaseServerClient } from '../../lib/supabase/server';

export type LoginState = Readonly<{
  error?: string;
}>;

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const emailValue = formData.get('email');
  const password = formData.get('password');

  if (typeof emailValue !== 'string' || typeof password !== 'string') {
    return { error: 'Les identifiants sont incomplets.' };
  }

  const email = emailValue.trim().toLowerCase();
  if (!email || !password) {
    return { error: 'Les identifiants sont incomplets.' };
  }

  const supabase = await createSupabaseServerClient(
    createAuthRateLimitIdentity('login', email),
  );
  if (!supabase) {
    return { error: 'Le service de connexion n’est pas configuré.' };
  }

  let destination = '/mfa';
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: 'E-mail ou mot de passe incorrect.' };
    }

    const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error || !assurance.data.currentLevel) {
      await supabase.auth.signOut({ scope: 'local' });
      return {
        error: 'La vérification de sécurité est momentanément indisponible.',
      };
    }

    if (assurance.data.currentLevel === 'aal2') {
      destination = '/tools';
    }
  } catch {
    return { error: 'Le service de connexion est momentanément indisponible.' };
  }

  redirect(destination);
}

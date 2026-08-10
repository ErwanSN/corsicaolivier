'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

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

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { error: 'Le service de connexion n’est pas configuré.' };
  }

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: 'E-mail ou mot de passe incorrect.' };
    }
  } catch {
    return { error: 'Le service de connexion est momentanément indisponible.' };
  }

  redirect('/tools');
}

export async function logout(): Promise<void> {
  const supabase = await createSupabaseServerClient();

  if (supabase) {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'global' });

      if (error) {
        await supabase.auth.signOut({ scope: 'local' });
      }
    } catch {
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // La redirection vers la connexion reste prioritaire même si la
        // session distante est déjà expirée ou momentanément inaccessible.
      }
    }
  }

  revalidatePath('/', 'layout');
  redirect('/login');
}

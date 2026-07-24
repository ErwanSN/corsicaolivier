'use server';

import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '../../lib/supabase/server';

export type LoginState = Readonly<{
  error?: string;
}>;

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get('email');
  const password = formData.get('password');
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { error: 'Supabase n’est pas configuré pour cet environnement.' };
  }

  if (typeof email !== 'string' || typeof password !== 'string') {
    return { error: 'Les identifiants sont incomplets.' };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: 'Adresse e-mail ou mot de passe incorrect.' };
  }

  redirect('/tools');
}

export async function logout(): Promise<void> {
  const supabase = await createSupabaseServerClient();

  await supabase?.auth.signOut();
  redirect('/login');
}

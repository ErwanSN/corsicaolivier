import 'server-only';

import { createSupabaseServerClient } from '../supabase/server';

export type ApiResult<T> =
  Readonly<{ data: T; error: null }> | Readonly<{ data: null; error: string }>;

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase?.auth.getSession()) ?? {
    data: { session: null },
  };

  if (!data.session?.access_token) {
    return { data: null, error: 'Session indisponible.' };
  }

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001';

  try {
    const response = await fetch(new URL(`/api${path}`, apiUrl), {
      ...init,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${data.session.access_token}`,
        ...init?.headers,
      },
    });

    if (!response.ok) {
      let conflictMessage: string | null = null;

      if (response.status === 409) {
        try {
          const payload = (await response.json()) as { message?: unknown };
          conflictMessage =
            typeof payload.message === 'string' ? payload.message : null;
        } catch {
          conflictMessage = null;
        }
      }

      return {
        data: null,
        error:
          conflictMessage ??
          (response.status === 403
            ? 'Vous n’êtes pas autorisé à consulter ce périmètre.'
            : 'Le service métier est momentanément indisponible.'),
      };
    }

    return { data: (await response.json()) as T, error: null };
  } catch {
    return {
      data: null,
      error: 'Impossible de joindre le service métier.',
    };
  }
}

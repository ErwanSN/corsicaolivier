import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { getPublicSupabaseConfig } from './config';

export async function createSupabaseServerClient() {
  const config = getPublicSupabaseConfig();

  if (!config) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Les Server Components ne peuvent pas toujours écrire les cookies.
          // Le proxy renouvelle alors la session au prochain cycle de requête.
        }
      },
    },
  });
}

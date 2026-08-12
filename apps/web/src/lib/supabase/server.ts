import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import {
  type AuthRateLimitIdentity,
  createSessionRateLimitIdentity,
  createSupabaseFetchWithAuthRateLimit,
  getServerAuthRateLimitConfig,
} from './auth-rate-limit';
import {
  getServerSupabaseConfig,
  hardenedSupabaseCookieOptions,
  SUPABASE_AUTH_COOKIE_NAME,
  supabaseAuthCookieOptions,
  supabaseFetchWithTimeout,
} from './config';

export async function createSupabaseServerClient(
  rateLimitIdentity?: AuthRateLimitIdentity,
) {
  const config = getServerSupabaseConfig();

  if (!config) {
    return null;
  }

  const cookieStore = await cookies();
  const authRateLimitConfig = getServerAuthRateLimitConfig();
  const fallbackIdentity =
    rateLimitIdentity ??
    createSessionRateLimitIdentity(
      cookieStore.getAll(),
      SUPABASE_AUTH_COOKIE_NAME,
    );
  const serverFetch = authRateLimitConfig
    ? createSupabaseFetchWithAuthRateLimit(
        authRateLimitConfig,
        fallbackIdentity,
      )
    : supabaseFetchWithTimeout;

  return createServerClient(config.url, config.publishableKey, {
    cookieOptions: supabaseAuthCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(
              name,
              value,
              hardenedSupabaseCookieOptions(options),
            );
          }
        } catch {
          // Les Server Components ne peuvent pas toujours écrire les cookies.
          // Le proxy renouvelle alors la session au prochain cycle de requête.
        }
      },
    },
    global: { fetch: serverFetch },
  });
}

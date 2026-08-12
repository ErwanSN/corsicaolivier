import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

import {
  createSessionRateLimitIdentity,
  createSupabaseFetchWithAuthRateLimit,
  getServerAuthRateLimitConfig,
} from './lib/supabase/auth-rate-limit';
import {
  getServerSupabaseConfig,
  hardenedSupabaseCookieOptions,
  SUPABASE_AUTH_COOKIE_NAME,
  supabaseAuthCookieOptions,
  supabaseFetchWithTimeout,
} from './lib/supabase/config';

export async function proxy(request: NextRequest) {
  const config = getServerSupabaseConfig();

  if (!config) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const authRateLimitConfig = getServerAuthRateLimitConfig();
  const fallbackIdentity = createSessionRateLimitIdentity(
    request.cookies.getAll(),
    SUPABASE_AUTH_COOKIE_NAME,
  );
  const serverFetch = authRateLimitConfig
    ? createSupabaseFetchWithAuthRateLimit(
        authRateLimitConfig,
        fallbackIdentity,
      )
    : supabaseFetchWithTimeout;
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookieOptions: supabaseAuthCookieOptions(),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        response = NextResponse.next({ request });

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(
            name,
            value,
            hardenedSupabaseCookieOptions(options),
          );
        }
      },
    },
    global: { fetch: serverFetch },
  });

  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|health).*)'],
};

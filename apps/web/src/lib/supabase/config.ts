import type { CookieOptions, CookieOptionsWithName } from '@supabase/ssr';

import { assertSafePublishableKey } from './publishable-key';

export type PublicSupabaseConfig = Readonly<{
  url: string;
  publishableKey: string;
}>;

export const SUPABASE_AUTH_COOKIE_NAME = 'sb-corsica-auth-token';
export const SUPABASE_AUTH_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const SUPABASE_REQUEST_TIMEOUT_MS = 10_000;

export function supabaseAuthCookieOptions(): CookieOptionsWithName {
  return {
    httpOnly: true,
    maxAge: SUPABASE_AUTH_COOKIE_MAX_AGE_SECONDS,
    name: SUPABASE_AUTH_COOKIE_NAME,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  };
}

export function hardenedSupabaseCookieOptions(
  options: CookieOptions = {},
): CookieOptions {
  const requestedMaxAge = options.maxAge;
  const maxAge =
    requestedMaxAge === 0
      ? 0
      : Math.min(
          requestedMaxAge ?? SUPABASE_AUTH_COOKIE_MAX_AGE_SECONDS,
          SUPABASE_AUTH_COOKIE_MAX_AGE_SECONDS,
        );

  return {
    ...options,
    httpOnly: true,
    maxAge,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  };
}

export function getPublicSupabaseConfig(): PublicSupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    return null;
  }

  assertSafePublishableKey(publishableKey);

  return { url, publishableKey };
}

/** Uses the private service address from server runtimes when one is present. */
export function getServerSupabaseConfig(): PublicSupabaseConfig | null {
  const publicConfig = getPublicSupabaseConfig();
  const url = process.env.SUPABASE_SERVER_URL ?? publicConfig?.url;
  const publishableKey = publicConfig?.publishableKey;

  if (!url || !publishableKey) {
    return null;
  }

  return { url, publishableKey };
}

export function supabaseFetchWithTimeout(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): ReturnType<typeof fetch> {
  const timeout = AbortSignal.timeout(SUPABASE_REQUEST_TIMEOUT_MS);
  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeout])
    : timeout;

  return fetch(input, { ...init, signal });
}

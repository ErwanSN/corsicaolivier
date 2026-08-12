import { createHmac } from 'node:crypto';

export const GOTRUE_RATE_LIMIT_HEADER = 'x-forwarded-for';

const AUTH_PATH_PREFIX = '/auth/v1';
const SECRET_PATTERN = /^[A-Za-z0-9_-]{43,}$/;

export type AuthRateLimitIdentity = Readonly<{
  scope: 'login' | 'mfa-factor' | 'session' | 'user';
  subject: string;
}>;

export type ServerAuthRateLimitConfig = Readonly<{
  internalUrl: string;
  secret: string;
}>;

type CookieValue = Readonly<{ name: string; value: string }>;

/**
 * Reads the direct GoTrue backplane configuration. Both values are optional in
 * local development, but a partial configuration is always rejected. The
 * production Compose file makes both variables mandatory.
 */
export function getServerAuthRateLimitConfig(): ServerAuthRateLimitConfig | null {
  const internalUrl = process.env.SUPABASE_AUTH_INTERNAL_URL?.trim();
  const secret = process.env.SUPABASE_AUTH_RATE_LIMIT_SECRET?.trim();

  if (!internalUrl && !secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Le proxy Auth interne et sa clé de limitation sont obligatoires en production.',
      );
    }
    return null;
  }
  if (!internalUrl || !secret) {
    throw new Error(
      'SUPABASE_AUTH_INTERNAL_URL et SUPABASE_AUTH_RATE_LIMIT_SECRET doivent être configurés ensemble.',
    );
  }

  const parsedUrl = new URL(internalUrl);
  if (
    (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') ||
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw new Error(
      'SUPABASE_AUTH_INTERNAL_URL doit être une URL HTTP interne.',
    );
  }

  if (!SECRET_PATTERN.test(secret)) {
    throw new Error(
      'SUPABASE_AUTH_RATE_LIMIT_SECRET doit contenir au moins 32 octets aléatoires encodés en base64url sans padding.',
    );
  }

  const decodedSecret = Buffer.from(secret, 'base64url');
  if (decodedSecret.byteLength < 32) {
    throw new Error(
      'SUPABASE_AUTH_RATE_LIMIT_SECRET doit contenir au moins 32 octets aléatoires.',
    );
  }

  return {
    internalUrl: parsedUrl.toString().replace(/\/$/, ''),
    secret,
  };
}

export function createAuthRateLimitIdentity(
  scope: AuthRateLimitIdentity['scope'],
  subject: string,
): AuthRateLimitIdentity {
  const normalizedSubject =
    scope === 'login'
      ? subject.trim().normalize('NFKC').toLowerCase()
      : subject.trim();

  if (!normalizedSubject) {
    throw new Error('Une identité de limitation Auth non vide est requise.');
  }

  return { scope, subject: normalizedSubject };
}

export function createSessionRateLimitIdentity(
  cookies: readonly CookieValue[],
  authCookieName: string,
): AuthRateLimitIdentity {
  const matchingCookies = cookies.filter(
    ({ name }) =>
      name === authCookieName || name.startsWith(`${authCookieName}.`),
  );
  const sessionCookie = combinedSessionCookie(matchingCookies, authCookieName);
  const sessionIdentity = sessionIdentityFromCookie(sessionCookie);

  if (sessionIdentity) return sessionIdentity;

  return createAuthRateLimitIdentity(
    'session',
    matchingCookies.length ? 'unparseable-session' : 'anonymous-read-only',
  );
}

export function signAuthRateLimitIdentity(
  identity: AuthRateLimitIdentity,
  secret: string,
): string {
  const canonicalIdentity = createAuthRateLimitIdentity(
    identity.scope,
    identity.subject,
  );
  const digest = createHmac('sha256', Buffer.from(secret, 'base64url'))
    .update('corsica-auth-rate-limit\0v1\0')
    .update(canonicalIdentity.scope)
    .update('\0')
    .update(canonicalIdentity.subject)
    .digest('base64url');

  // The namespace can never collide with a public IP inserted by Traefik.
  return `corsica-v1.${digest}`;
}

export function createSupabaseFetchWithAuthRateLimit(
  authConfig: ServerAuthRateLimitConfig | null,
  fallbackIdentity: AuthRateLimitIdentity,
  fetcher: typeof fetch = fetch,
): typeof fetch {
  return async (input, init) => {
    const sourceUrl = requestUrl(input);

    if (!authConfig || !isSupabaseAuthPath(sourceUrl.pathname)) {
      return fetchWithTimeout(fetcher, input, init);
    }

    const request = new Request(input, init);
    const identity =
      (await identityFromAuthRequest(sourceUrl, request)) ?? fallbackIdentity;
    const targetUrl = directAuthUrl(sourceUrl, authConfig.internalUrl);
    const headers = new Headers(request.headers);

    // Never append to a caller-provided forwarding chain. GoTrue reads the
    // first comma-separated value, so replacement is a security boundary.
    headers.set(
      GOTRUE_RATE_LIMIT_HEADER,
      signAuthRateLimitIdentity(identity, authConfig.secret),
    );

    const hardenedRequest = await redirectedRequest(
      request,
      targetUrl,
      headers,
    );

    return fetchWithTimeout(fetcher, hardenedRequest);
  };
}

function requestUrl(input: Parameters<typeof fetch>[0]): URL {
  if (typeof input === 'string') return new URL(input);
  if (input instanceof URL) return new URL(input.href);
  return new URL(input.url);
}

function isSupabaseAuthPath(pathname: string): boolean {
  return (
    pathname === AUTH_PATH_PREFIX || pathname.startsWith(`${AUTH_PATH_PREFIX}/`)
  );
}

function directAuthUrl(sourceUrl: URL, internalUrl: string): URL {
  const directUrl = new URL(internalUrl);
  const suffix = sourceUrl.pathname.slice(AUTH_PATH_PREFIX.length);
  const basePath = directUrl.pathname.replace(/\/$/, '');

  directUrl.pathname = `${basePath}${suffix || '/'}`;
  directUrl.search = sourceUrl.search;
  directUrl.hash = '';

  return directUrl;
}

async function identityFromAuthRequest(
  url: URL,
  request: Request,
): Promise<AuthRateLimitIdentity | null> {
  const factorMatch = /\/factors\/([^/]+)\/(?:challenge|verify)\/?$/.exec(
    url.pathname,
  );
  if (factorMatch?.[1]) {
    return createAuthRateLimitIdentity(
      'mfa-factor',
      decodeURIComponent(factorMatch[1]).toLowerCase(),
    );
  }

  const body = await jsonBody(request);
  const grantType = url.searchParams.get('grant_type');

  if (url.pathname.endsWith('/token') && grantType === 'password') {
    const login =
      stringProperty(body, 'email') ?? stringProperty(body, 'phone');
    if (login) return createAuthRateLimitIdentity('login', login);
  }

  const jwtIdentity = identityFromJwt(request.headers.get('authorization'));
  if (jwtIdentity) return jwtIdentity;

  return null;
}

async function jsonBody(
  request: Request,
): Promise<Record<string, unknown> | null> {
  if (request.method === 'GET' || request.method === 'HEAD') return null;

  try {
    const body = await request.clone().text();
    if (body.length > 65_536) return null;
    const parsed: unknown = JSON.parse(body);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function redirectedRequest(
  request: Request,
  targetUrl: URL,
  headers: Headers,
): Promise<Request> {
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const body = hasBody ? await request.arrayBuffer() : undefined;

  return new Request(targetUrl, {
    body,
    cache: request.cache,
    credentials: request.credentials,
    headers,
    integrity: request.integrity,
    keepalive: request.keepalive,
    method: request.method,
    mode: request.mode,
    redirect: request.redirect,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
    signal: request.signal,
  });
}

function stringProperty(
  value: Record<string, unknown> | null,
  property: string,
): string | null {
  const propertyValue = value?.[property];
  return typeof propertyValue === 'string' && propertyValue
    ? propertyValue
    : null;
}

function identityFromJwt(
  authorization: string | null,
): AuthRateLimitIdentity | null {
  if (!authorization?.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length);
  const claims = jwtClaims(token);
  if (!claims) return null;

  const sessionId = stringProperty(claims, 'session_id');
  if (sessionId) return createAuthRateLimitIdentity('session', sessionId);

  const subject = stringProperty(claims, 'sub');
  return subject ? createAuthRateLimitIdentity('user', subject) : null;
}

function combinedSessionCookie(
  cookies: readonly CookieValue[],
  authCookieName: string,
): string | null {
  const unchunked = cookies.find(({ name }) => name === authCookieName)?.value;
  if (unchunked) return unchunked;

  const chunks = cookies
    .flatMap(({ name, value }) => {
      const suffix = name.slice(`${authCookieName}.`.length);
      return /^\d+$/.test(suffix) ? [{ index: Number(suffix), value }] : [];
    })
    .sort((left, right) => left.index - right.index);

  if (!chunks.length || chunks.some((chunk, index) => chunk.index !== index)) {
    return null;
  }

  return chunks.map(({ value }) => value).join('');
}

function sessionIdentityFromCookie(
  cookie: string | null,
): AuthRateLimitIdentity | null {
  if (!cookie) return null;

  try {
    const serializedSession = cookie.startsWith('base64-')
      ? Buffer.from(cookie.slice('base64-'.length), 'base64url').toString(
          'utf8',
        )
      : cookie;
    const session: unknown = JSON.parse(serializedSession);
    if (!session || typeof session !== 'object') return null;
    const accessToken = stringProperty(
      session as Record<string, unknown>,
      'access_token',
    );
    const claims = accessToken ? jwtClaims(accessToken) : null;
    const sessionId = claims ? stringProperty(claims, 'session_id') : null;
    if (sessionId) return createAuthRateLimitIdentity('session', sessionId);

    const subject = claims ? stringProperty(claims, 'sub') : null;
    if (subject) return createAuthRateLimitIdentity('user', subject);

    const user = (session as Record<string, unknown>).user;
    const userId =
      user && typeof user === 'object'
        ? stringProperty(user as Record<string, unknown>, 'id')
        : null;
    return userId ? createAuthRateLimitIdentity('user', userId) : null;
  } catch {
    return null;
  }
}

function jwtClaims(token: string): Record<string, unknown> | null {
  const payload = token.split('.')[1];
  if (!payload) return null;

  try {
    const claims: unknown = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    );
    if (!claims || typeof claims !== 'object') return null;
    return claims as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(
  fetcher: typeof fetch,
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
): Promise<Response> {
  const timeout = AbortSignal.timeout(10_000);
  const requestSignal =
    init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const signal = requestSignal
    ? AbortSignal.any([requestSignal, timeout])
    : timeout;

  return fetcher(input, { ...init, signal });
}

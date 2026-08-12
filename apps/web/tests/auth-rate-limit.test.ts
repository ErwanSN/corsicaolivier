import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createAuthRateLimitIdentity,
  createSessionRateLimitIdentity,
  createSupabaseFetchWithAuthRateLimit,
  getServerAuthRateLimitConfig,
  GOTRUE_RATE_LIMIT_HEADER,
  signAuthRateLimitIdentity,
  type ServerAuthRateLimitConfig,
} from '../src/lib/supabase/auth-rate-limit.ts';

const secret = 'dGVzdC1vbmx5LWF1dGgtcmF0ZS1saW1pdC1zZWNyZXQtMDAwMDA';
const authConfig: ServerAuthRateLimitConfig = {
  internalUrl: 'http://supabase-auth:9999',
  secret,
};

function recorder() {
  const requests: Request[] = [];
  const fetcher = (async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ) => {
    requests.push(new Request(input, init));
    return new Response('{}', {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  }) as typeof fetch;

  return { fetcher, requests };
}

function sessionCookie(
  sessionId: string | null,
  refreshToken: string,
  subject = 'test-user',
) {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const accessToken = [
    encode({ alg: 'HS256', typ: 'JWT' }),
    encode({ ...(sessionId ? { session_id: sessionId } : {}), sub: subject }),
    encode('test-signature'),
  ].join('.');

  return `base64-${Buffer.from(
    JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
  ).toString('base64url')}`;
}

test('normalise le login sans révéler le compte dans la clé HMAC', () => {
  const first = signAuthRateLimitIdentity(
    createAuthRateLimitIdentity('login', ' Operator@Example.COM '),
    secret,
  );
  const second = signAuthRateLimitIdentity(
    createAuthRateLimitIdentity('login', 'operator@example.com'),
    secret,
  );
  const other = signAuthRateLimitIdentity(
    createAuthRateLimitIdentity('login', 'other@example.com'),
    secret,
  );

  assert.equal(first, second);
  assert.notEqual(first, other);
  assert.match(first, /^corsica-v1\.[A-Za-z0-9_-]{43}$/);
  assert.doesNotMatch(first, /operator|example/iu);
});

test('refuse une production sans backplane Auth complet', () => {
  const previous = {
    internalUrl: process.env.SUPABASE_AUTH_INTERNAL_URL,
    nodeEnv: process.env.NODE_ENV,
    secret: process.env.SUPABASE_AUTH_RATE_LIMIT_SECRET,
  };

  try {
    Reflect.set(process.env, 'NODE_ENV', 'production');
    delete process.env.SUPABASE_AUTH_INTERNAL_URL;
    delete process.env.SUPABASE_AUTH_RATE_LIMIT_SECRET;
    assert.throws(() => getServerAuthRateLimitConfig(), /obligatoires/);

    process.env.SUPABASE_AUTH_INTERNAL_URL = 'http://supabase-auth:9999';
    assert.throws(() => getServerAuthRateLimitConfig(), /configurés ensemble/);
  } finally {
    if (previous.internalUrl === undefined) {
      delete process.env.SUPABASE_AUTH_INTERNAL_URL;
    } else {
      process.env.SUPABASE_AUTH_INTERNAL_URL = previous.internalUrl;
    }
    if (previous.secret === undefined) {
      delete process.env.SUPABASE_AUTH_RATE_LIMIT_SECRET;
    } else {
      process.env.SUPABASE_AUTH_RATE_LIMIT_SECRET = previous.secret;
    }
    if (previous.nodeEnv === undefined) {
      Reflect.deleteProperty(process.env, 'NODE_ENV');
    } else {
      Reflect.set(process.env, 'NODE_ENV', previous.nodeEnv);
    }
  }
});

test('réécrit Auth vers GoTrue et remplace tout X-Forwarded-For client', async () => {
  const { fetcher, requests } = recorder();
  const serverFetch = createSupabaseFetchWithAuthRateLimit(
    authConfig,
    createAuthRateLimitIdentity('session', 'fallback-session'),
    fetcher,
  );

  await serverFetch(
    'https://supabase.example.invalid/auth/v1/token?grant_type=password',
    {
      body: JSON.stringify({
        email: 'Operator@Example.COM',
        password: 'never-in-the-header',
      }),
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': '203.0.113.9, attacker-controlled',
      },
      method: 'POST',
    },
  );

  assert.equal(requests.length, 1);
  assert.equal(
    requests[0].url,
    'http://supabase-auth:9999/token?grant_type=password',
  );
  const key = requests[0].headers.get(GOTRUE_RATE_LIMIT_HEADER);
  assert.equal(
    key,
    signAuthRateLimitIdentity(
      createAuthRateLimitIdentity('login', 'operator@example.com'),
      secret,
    ),
  );
  assert.doesNotMatch(key ?? '', /203\.0\.113\.9|never-in-the-header/);
  assert.deepEqual(await requests[0].json(), {
    email: 'Operator@Example.COM',
    password: 'never-in-the-header',
  });
});

test('isole MFA par facteur et garde le bucket stable après rotation refresh', async () => {
  const { fetcher, requests } = recorder();
  const firstSession = createSessionRateLimitIdentity(
    [
      {
        name: 'sb-corsica-auth-token',
        value: sessionCookie('stable-session-id', 'refresh-token-a'),
      },
    ],
    'sb-corsica-auth-token',
  );
  const secondSession = createSessionRateLimitIdentity(
    [
      {
        name: 'sb-corsica-auth-token',
        value: sessionCookie('stable-session-id', 'refresh-token-b'),
      },
    ],
    'sb-corsica-auth-token',
  );
  assert.deepEqual(firstSession, secondSession);

  const legacyFirstSession = createSessionRateLimitIdentity(
    [
      {
        name: 'sb-corsica-auth-token',
        value: sessionCookie(null, 'legacy-refresh-token-a'),
      },
    ],
    'sb-corsica-auth-token',
  );
  const legacySecondSession = createSessionRateLimitIdentity(
    [
      {
        name: 'sb-corsica-auth-token',
        value: sessionCookie(null, 'legacy-refresh-token-b'),
      },
    ],
    'sb-corsica-auth-token',
  );
  assert.deepEqual(legacyFirstSession, legacySecondSession);
  assert.deepEqual(legacyFirstSession, {
    scope: 'user',
    subject: 'test-user',
  });

  const firstServerFetch = createSupabaseFetchWithAuthRateLimit(
    authConfig,
    firstSession,
    fetcher,
  );

  await firstServerFetch(
    'https://supabase.example.invalid/auth/v1/factors/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/challenge',
    { method: 'POST' },
  );
  await firstServerFetch(
    'https://supabase.example.invalid/auth/v1/factors/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/verify',
    { method: 'POST' },
  );
  await firstServerFetch(
    'https://supabase.example.invalid/auth/v1/token?grant_type=refresh_token',
    {
      body: JSON.stringify({ refresh_token: 'refresh-token-a' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );
  const secondServerFetch = createSupabaseFetchWithAuthRateLimit(
    authConfig,
    secondSession,
    fetcher,
  );
  await secondServerFetch(
    'https://supabase.example.invalid/auth/v1/token?grant_type=refresh_token',
    {
      body: JSON.stringify({ refresh_token: 'refresh-token-b' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );

  const keys = requests.map((request) =>
    request.headers.get(GOTRUE_RATE_LIMIT_HEADER),
  );
  assert.notEqual(keys[0], keys[1]);
  assert.equal(keys[2], keys[3]);
  assert.equal(new Set(keys).size, 3);
  assert.ok(
    keys.every((key) => /^corsica-v1\.[A-Za-z0-9_-]{43}$/.test(key ?? '')),
  );
});

test('la session chunkée est stable et PostgREST ne reçoit aucune clé HMAC', async () => {
  const encodedSession = sessionCookie('chunked-session-id', 'refresh-token');
  const splitAt = Math.floor(encodedSession.length / 2);
  const firstSession = createSessionRateLimitIdentity(
    [
      {
        name: 'sb-corsica-auth-token.1',
        value: encodedSession.slice(splitAt),
      },
      { name: 'unrelated', value: 'ignored' },
      {
        name: 'sb-corsica-auth-token.0',
        value: encodedSession.slice(0, splitAt),
      },
    ],
    'sb-corsica-auth-token',
  );
  const secondSession = createSessionRateLimitIdentity(
    [
      {
        name: 'sb-corsica-auth-token.0',
        value: encodedSession.slice(0, splitAt),
      },
      {
        name: 'sb-corsica-auth-token.1',
        value: encodedSession.slice(splitAt),
      },
    ],
    'sb-corsica-auth-token',
  );
  assert.deepEqual(firstSession, secondSession);
  assert.deepEqual(firstSession, {
    scope: 'session',
    subject: 'chunked-session-id',
  });

  const { fetcher, requests } = recorder();
  const serverFetch = createSupabaseFetchWithAuthRateLimit(
    authConfig,
    firstSession,
    fetcher,
  );
  await serverFetch(
    'https://supabase.example.invalid/rest/v1/agents?select=id',
    { headers: { apikey: 'publishable-test-only' } },
  );

  assert.equal(
    requests[0].url,
    'https://supabase.example.invalid/rest/v1/agents?select=id',
  );
  assert.equal(requests[0].headers.get(GOTRUE_RATE_LIMIT_HEADER), null);
});

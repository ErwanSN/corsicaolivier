import { createServer } from 'node:http';

const host = '127.0.0.1';
const port = Number(process.env.E2E_MOCK_SERVICES_PORT ?? 3101);

if (!Number.isInteger(port) || port < 1024 || port > 65_535) {
  throw new Error(
    'E2E_MOCK_SERVICES_PORT doit être un port non privilégié valide.',
  );
}
const mockEmail = 'e2e.operator@example.invalid';
const mockPassword = 'playwright-only-not-a-secret';
const mfaChallengeEmail = 'e2e.mfa.challenge@example.invalid';
const mfaEnrollEmail = 'e2e.mfa.enroll@example.invalid';
const mfaPassword = 'playwright-mfa-only';
const mfaCode = '123456';
const challengeFactorId = '55555555-5555-4555-8555-555555555555';
const enrollFactorId = '66666666-6666-4666-8666-666666666666';
const challengeId = '77777777-7777-4777-8777-777777777777';
const mockUserId = '11111111-1111-4111-8111-111111111111';
const mockOrganizationId = '22222222-2222-4222-8222-222222222222';
const mockSiteId = '33333333-3333-4333-8333-333333333333';
const issuedAt = Math.floor(Date.now() / 1_000);

function encodeJwtPart(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function accessToken({ aal, email, sessionId, userId }) {
  return [
    encodeJwtPart({ alg: 'HS256', typ: 'JWT' }),
    encodeJwtPart({
      aud: 'authenticated',
      aal,
      amr:
        aal === 'aal2'
          ? [
              { method: 'password', timestamp: issuedAt },
              { method: 'totp', timestamp: issuedAt },
            ]
          : [{ method: 'password', timestamp: issuedAt }],
      email,
      exp: issuedAt + 3_600,
      iat: issuedAt,
      role: 'authenticated',
      session_id: sessionId,
      sub: userId,
    }),
    Buffer.from('e2e-signature-without-any-secret').toString('base64url'),
  ].join('.');
}

const mockAccessToken = accessToken({
  aal: 'aal2',
  email: mockEmail,
  sessionId: '44444444-4444-4444-8444-444444444444',
  userId: mockUserId,
});

const timestamp = new Date(issuedAt * 1_000).toISOString();
function user({ email, factors = [], id, name }) {
  return {
    id,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    email_confirmed_at: timestamp,
    phone: '',
    confirmed_at: timestamp,
    last_sign_in_at: timestamp,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { full_name: name },
    identities: [],
    created_at: timestamp,
    updated_at: timestamp,
    is_anonymous: false,
    factors,
  };
}

const mockUser = user({
  email: mockEmail,
  id: mockUserId,
  name: 'Opérateur E2E',
});
const challengeUserId = '88888888-8888-4888-8888-888888888888';
const enrollUserId = '99999999-9999-4999-8999-999999999999';
const verifiedFactor = {
  id: challengeFactorId,
  factor_type: 'totp',
  status: 'verified',
  created_at: timestamp,
  updated_at: timestamp,
};
const challengeUser = user({
  email: mfaChallengeEmail,
  factors: [verifiedFactor],
  id: challengeUserId,
  name: 'MFA Challenge',
});
const enrollUser = user({
  email: mfaEnrollEmail,
  id: enrollUserId,
  name: 'MFA Enrollment',
});
const challengeAal1Token = accessToken({
  aal: 'aal1',
  email: mfaChallengeEmail,
  sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  userId: challengeUserId,
});
const challengeAal2Token = accessToken({
  aal: 'aal2',
  email: mfaChallengeEmail,
  sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  userId: challengeUserId,
});
const enrollAal1Token = accessToken({
  aal: 'aal1',
  email: mfaEnrollEmail,
  sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  userId: enrollUserId,
});
const enrollAal2Token = accessToken({
  aal: 'aal2',
  email: mfaEnrollEmail,
  sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  userId: enrollUserId,
});

function json(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];

  for await (const chunk of request) chunks.push(chunk);

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

function bearerToken(request) {
  const authorization = request.headers.authorization;
  return typeof authorization === 'string' &&
    authorization.startsWith('Bearer ')
    ? authorization.slice(7)
    : null;
}

function userForToken(token) {
  if (token === mockAccessToken) return mockUser;
  if (token === challengeAal1Token || token === challengeAal2Token) {
    return challengeUser;
  }
  if (token === enrollAal1Token) return enrollUser;
  if (token === enrollAal2Token) {
    return {
      ...enrollUser,
      factors: [{ ...verifiedFactor, id: enrollFactorId }],
    };
  }
  return null;
}

async function handleRequest(request, response) {
  const url = new URL(request.url ?? '/', `http://${host}:${port}`);

  response.setHeader(
    'Access-Control-Allow-Headers',
    'authorization, apikey, content-type',
  );
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Cache-Control', 'no-store');

  if (request.method === 'OPTIONS') {
    response.writeHead(204).end();
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/health') {
    json(response, 200, { status: 'ok' });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/auth/v1/health') {
    json(response, 200, { version: 'e2e' });
    return;
  }

  if (
    url.pathname.startsWith('/auth/v1/') &&
    !/^corsica-v1\.[A-Za-z0-9_-]{43}$/.test(
      String(request.headers['x-forwarded-for'] ?? ''),
    )
  ) {
    json(response, 500, { message: 'Missing trusted Auth rate-limit key' });
    return;
  }

  if (url.pathname === '/auth/v1/user') {
    const authenticatedUser = userForToken(bearerToken(request));
    if (authenticatedUser) {
      json(response, 200, authenticatedUser);
      return;
    }

    json(response, 401, { message: 'Invalid JWT' });
    return;
  }

  if (
    request.method === 'POST' &&
    url.pathname === '/auth/v1/token' &&
    url.searchParams.get('grant_type') === 'password'
  ) {
    const credentials = await readJson(request);

    if (
      credentials?.email === mockEmail &&
      credentials?.password === mockPassword
    ) {
      json(response, 200, {
        access_token: mockAccessToken,
        expires_at: issuedAt + 3_600,
        expires_in: 3_600,
        refresh_token: 'e2e-refresh-token-without-any-secret',
        token_type: 'bearer',
        user: mockUser,
      });
      return;
    }

    const mfaAccount =
      credentials?.email === mfaChallengeEmail &&
      credentials?.password === mfaPassword
        ? {
            accessToken: challengeAal1Token,
            refreshToken: 'e2e-mfa-challenge-refresh',
            user: challengeUser,
          }
        : credentials?.email === mfaEnrollEmail &&
            credentials?.password === mfaPassword
          ? {
              accessToken: enrollAal1Token,
              refreshToken: 'e2e-mfa-enroll-refresh',
              user: enrollUser,
            }
          : null;

    if (mfaAccount) {
      json(response, 200, {
        access_token: mfaAccount.accessToken,
        expires_at: issuedAt + 3_600,
        expires_in: 3_600,
        refresh_token: mfaAccount.refreshToken,
        token_type: 'bearer',
        user: mfaAccount.user,
      });
      return;
    }

    json(response, 400, {
      error: 'invalid_grant',
      error_description: 'Invalid login credentials',
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/auth/v1/logout') {
    response.writeHead(userForToken(bearerToken(request)) ? 204 : 401).end();
    return;
  }

  if (
    request.method === 'POST' &&
    url.pathname === '/auth/v1/factors' &&
    bearerToken(request) === enrollAal1Token
  ) {
    json(response, 200, {
      id: enrollFactorId,
      type: 'totp',
      friendly_name: 'Corsica Linea',
      totp: {
        qr_code:
          '<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192"><rect width="192" height="192" fill="white"/><rect x="24" y="24" width="144" height="144" fill="black"/></svg>',
        secret: 'E2EONLYTOTPSECRET',
        uri: 'otpauth://totp/Corsica:E2E?secret=E2EONLYTOTPSECRET',
      },
    });
    return;
  }

  const challengeMatch = /^\/auth\/v1\/factors\/([^/]+)\/challenge$/.exec(
    url.pathname,
  );
  if (request.method === 'POST' && challengeMatch) {
    const factorId = challengeMatch[1];
    const token = bearerToken(request);
    if (
      (factorId === challengeFactorId && token === challengeAal1Token) ||
      (factorId === enrollFactorId && token === enrollAal1Token)
    ) {
      json(response, 200, {
        id: challengeId,
        type: 'totp',
        expires_at: issuedAt + 300,
      });
      return;
    }
  }

  const verifyMatch = /^\/auth\/v1\/factors\/([^/]+)\/verify$/.exec(
    url.pathname,
  );
  if (request.method === 'POST' && verifyMatch) {
    const payload = await readJson(request);
    const factorId = verifyMatch[1];
    const token = bearerToken(request);
    const challengeAccount =
      factorId === challengeFactorId && token === challengeAal1Token;
    const enrollmentAccount =
      factorId === enrollFactorId && token === enrollAal1Token;

    if ((challengeAccount || enrollmentAccount) && payload?.code === mfaCode) {
      const authenticatedUser = challengeAccount
        ? challengeUser
        : {
            ...enrollUser,
            factors: [{ ...verifiedFactor, id: enrollFactorId }],
          };
      json(response, 200, {
        access_token: challengeAccount ? challengeAal2Token : enrollAal2Token,
        expires_at: issuedAt + 3_600,
        expires_in: 3_600,
        refresh_token: challengeAccount
          ? 'e2e-mfa-challenge-refresh-aal2'
          : 'e2e-mfa-enroll-refresh-aal2',
        token_type: 'bearer',
        user: authenticatedUser,
      });
      return;
    }

    json(response, 422, {
      error: 'mfa_verification_failed',
      error_description: 'Invalid TOTP code',
    });
    return;
  }

  if (url.pathname === '/api/notifications') {
    json(response, 200, { hasMore: false, items: [], total: 0 });
    return;
  }

  if (url.pathname === '/api/sites') {
    json(response, 200, [
      {
        active: true,
        code: 'E2E',
        id: mockSiteId,
        name: 'Marseille Test E2E',
        organization_id: mockOrganizationId,
        timezone: 'Europe/Paris',
      },
    ]);
    return;
  }

  if (
    url.pathname === '/api/port-calls' ||
    url.pathname === '/api/planning-workforce-conflicts' ||
    url.pathname === '/api/planning-periods' ||
    url.pathname === '/api/vessels'
  ) {
    json(response, 200, []);
    return;
  }

  if (url.pathname === '/api/positions') {
    json(response, 200, {
      hasMore: false,
      items: [],
      page: 1,
      pageSize: 200,
      total: 0,
      totalPages: 0,
    });
    return;
  }

  if (url.pathname === '/api/agents/search') {
    json(response, 200, {
      counts: { active: 0, all: 0, inactive: 0 },
      hasMore: false,
      included: [],
      items: [],
      page: 1,
      pageSize: 50,
      total: 0,
      totalPages: 0,
    });
    return;
  }

  json(response, 404, { message: 'Not found' });
}

const server = createServer((request, response) => {
  void handleRequest(request, response).catch(() => {
    if (!response.headersSent) json(response, 500, { message: 'Mock failure' });
    else response.end();
  });
});

server.listen(port, host);

function closeServer() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', closeServer);
process.on('SIGTERM', closeServer);

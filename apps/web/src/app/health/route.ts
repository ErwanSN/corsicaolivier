import { NextResponse } from 'next/server';

import { getServerAuthRateLimitConfig } from '../../lib/supabase/auth-rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const apiUrl = process.env.API_URL;
  let authConfig;

  try {
    authConfig = getServerAuthRateLimitConfig();
  } catch {
    authConfig = null;
  }

  if (!apiUrl || !authConfig) {
    return NextResponse.json(
      { status: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const authHealthUrl = `${authConfig.internalUrl}/health`;
    const [apiResponse, authResponse] = await Promise.all([
      fetch(`${apiUrl}/api/health`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(4_000),
      }),
      fetch(authHealthUrl, {
        cache: 'no-store',
        signal: AbortSignal.timeout(4_000),
      }),
    ]);
    const healthy = apiResponse.ok && authResponse.ok;

    return NextResponse.json(
      { status: healthy ? 'ok' : 'unavailable' },
      {
        status: healthy ? 200 : 503,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch {
    return NextResponse.json(
      { status: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

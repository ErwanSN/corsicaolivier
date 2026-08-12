import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Environment } from '../config/environment';
import type { Database } from './database.types';

@Injectable()
export class SupabaseService {
  private static readonly REQUEST_TIMEOUT_MS = 15_000;
  private readonly authClient: SupabaseClient<Database>;
  private readonly publishableKey: string;
  private readonly url: string;

  constructor(configService: ConfigService<Environment, true>) {
    this.url = configService.get('supabase.url', { infer: true });
    this.publishableKey = configService.get('supabase.publishableKey', {
      infer: true,
    });

    this.authClient = this.createStatelessClient(this.publishableKey);
  }

  forUser(accessToken: string): SupabaseClient<Database> {
    return createClient<Database>(this.url, this.publishableKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: {
        fetch: SupabaseService.fetchWithTimeout,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });
  }

  async verifyAccessToken(accessToken: string) {
    return this.authClient.auth.getClaims(accessToken);
  }

  async checkHealth(): Promise<
    Readonly<{ auth: boolean; database: boolean; schema: boolean }>
  > {
    const request = (
      pathname: string,
      method: 'GET' | 'HEAD' | 'POST',
      body?: string,
    ) =>
      fetch(new URL(pathname, this.url), {
        body,
        method,
        headers: {
          Accept: 'application/json',
          apikey: this.publishableKey,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        signal: AbortSignal.timeout(3_000),
      });

    try {
      const [auth, database, offboardingTable, offboardingReadModel] =
        await Promise.all([
          request('/auth/v1/health', 'GET'),
          request('/rest/v1/', 'HEAD'),
          request('/rest/v1/agent_offboarding_plans?select=id&limit=0', 'GET'),
          request(
            '/rest/v1/rpc/get_agent_offboarding_plan',
            'POST',
            JSON.stringify({
              target_agent_id: '00000000-0000-0000-0000-000000000000',
              target_organization_id: '00000000-0000-0000-0000-000000000000',
            }),
          ),
        ]);

      const schema = await Promise.all([
        SupabaseService.isExpectedAnonymousDenial(offboardingTable),
        SupabaseService.isExpectedAnonymousDenial(offboardingReadModel),
      ]);

      return {
        auth: auth.ok,
        database: database.ok,
        schema: schema.every(Boolean),
      };
    } catch {
      return { auth: false, database: false, schema: false };
    }
  }

  private static async isExpectedAnonymousDenial(
    response: Response,
  ): Promise<boolean> {
    if (response.status !== 401) {
      return false;
    }

    const body: unknown = await response.json();

    return (
      typeof body === 'object' &&
      body !== null &&
      'code' in body &&
      body.code === '42501'
    );
  }

  private createStatelessClient(key: string): SupabaseClient<Database> {
    return createClient<Database>(this.url, key, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: {
        fetch: SupabaseService.fetchWithTimeout,
      },
    });
  }

  private static readonly fetchWithTimeout = (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): ReturnType<typeof fetch> => {
    const timeout = AbortSignal.timeout(SupabaseService.REQUEST_TIMEOUT_MS);
    const signal = init?.signal
      ? AbortSignal.any([init.signal, timeout])
      : timeout;

    return fetch(input, { ...init, signal });
  };
}

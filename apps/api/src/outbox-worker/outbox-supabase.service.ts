import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../database/database.types';
import { OUTBOX_RPC_TIMEOUT_MS } from './outbox-worker.constants';

@Injectable()
export class OutboxSupabaseService {
  private readonly serviceClient: SupabaseClient<Database>;

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('SUPABASE_URL');
    const serviceRoleKey = config.getOrThrow<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    this.serviceClient = createClient<Database>(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: {
        fetch: (input, init) => {
          const timeout = AbortSignal.timeout(OUTBOX_RPC_TIMEOUT_MS);
          const signal = init?.signal
            ? AbortSignal.any([init.signal, timeout])
            : timeout;

          return fetch(input, { ...init, signal });
        },
      },
    });
  }

  client(): SupabaseClient<Database> {
    return this.serviceClient;
  }
}

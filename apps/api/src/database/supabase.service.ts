import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Environment } from '../config/environment';
import type { Database } from './database.types';

@Injectable()
export class SupabaseService {
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
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });
  }

  async verifyAccessToken(accessToken: string) {
    return this.authClient.auth.getClaims(accessToken);
  }

  private createStatelessClient(key: string): SupabaseClient<Database> {
    return createClient<Database>(this.url, key, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }
}

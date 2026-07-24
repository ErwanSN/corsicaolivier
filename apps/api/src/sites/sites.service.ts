import { randomUUID } from 'node:crypto';

import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { throwForSupabaseError } from '../common/supabase-error';
import type { Database } from '../database/database.types';
import { SupabaseService } from '../database/supabase.service';
import type { CreateSiteDto } from './site.dto';

type Site = Database['public']['Tables']['sites']['Row'];

@Injectable()
export class SitesService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(accessToken: string): Promise<Site[]> {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .from('sites')
      .select('*')
      .eq('active', true)
      .order('name');

    throwForSupabaseError(error, 'chargement des sites');

    return data ?? [];
  }

  async create(accessToken: string, input: CreateSiteDto): Promise<Site> {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .from('sites')
      .insert({
        organization_id: input.organizationId,
        code:
          input.code ??
          `ZONE-${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`,
        name: input.name,
        timezone: input.timezone ?? 'Europe/Paris',
      })
      .select()
      .single();

    throwForSupabaseError(error, 'création de la zone');

    if (!data) {
      throw new ServiceUnavailableException('Zone créée sans réponse.');
    }
    return data;
  }
}

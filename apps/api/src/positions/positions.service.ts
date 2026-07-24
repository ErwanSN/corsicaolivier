import { Injectable } from '@nestjs/common';

import { throwForSupabaseError } from '../common/supabase-error';
import type { Database } from '../database/database.types';
import { SupabaseService } from '../database/supabase.service';
import type { CreatePositionDto } from './position.dto';

type Position = Database['public']['Tables']['positions']['Row'];

@Injectable()
export class PositionsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(
    accessToken: string,
    organizationId: string,
    siteId?: string,
  ): Promise<Position[]> {
    let query = this.supabase
      .forUser(accessToken)
      .from('positions')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('active', true);

    if (siteId) {
      query = query.or(`site_id.is.null,site_id.eq.${siteId}`);
    }

    const { data, error } = await query.order('name').limit(200);

    throwForSupabaseError(error, 'chargement des postes');

    return data ?? [];
  }

  async create(
    accessToken: string,
    input: CreatePositionDto,
  ): Promise<Position> {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .from('positions')
      .insert({
        organization_id: input.organizationId,
        site_id: input.siteId,
        code: input.code,
        name: input.name,
        description: input.description,
        color_token: input.colorToken,
      })
      .select()
      .single();

    throwForSupabaseError(error, 'création du poste');

    if (!data) {
      throw new Error('Supabase returned no position after insertion.');
    }

    return data;
  }
}

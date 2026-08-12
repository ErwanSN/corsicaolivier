import { Injectable } from '@nestjs/common';

import { throwForSupabaseError } from '../common/supabase-error';
import type { Database } from '../database/database.types';
import { SupabaseService } from '../database/supabase.service';
import type { CreatePositionDto } from './position.dto';

type Position = Database['public']['Tables']['positions']['Row'];
export type PositionSearchPage = Readonly<{
  items: Position[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}>;

function escapePostgrestLikeTerm(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('%', '\\%')
    .replaceAll('_', '\\_')
    .replaceAll('*', '\\*');
}

@Injectable()
export class PositionsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(
    accessToken: string,
    organizationId: string,
    siteId?: string,
    requestedPage = 1,
    pageSize = 50,
    search?: string,
  ): Promise<PositionSearchPage> {
    const client = this.supabase.forUser(accessToken);
    const normalizedSearch = search?.trim();
    const pageQuery = (page: number) => {
      let query = client
        .from('positions')
        .select('*', { count: 'exact' })
        .eq('organization_id', organizationId)
        .eq('active', true)
        .order('name')
        .order('id')
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (normalizedSearch) {
        const term = `%${escapePostgrestLikeTerm(normalizedSearch)}%`;
        query = siteId
          ? query.or(
              [
                `and(site_id.is.null,name.ilike."${term}")`,
                `and(site_id.is.null,code.ilike."${term}")`,
                `and(site_id.eq.${siteId},name.ilike."${term}")`,
                `and(site_id.eq.${siteId},code.ilike."${term}")`,
              ].join(','),
            )
          : query.or(`name.ilike."${term}",code.ilike."${term}"`);
      } else if (siteId) {
        query = query.or(`site_id.is.null,site_id.eq.${siteId}`);
      }

      return query;
    };

    const initialPage = await pageQuery(requestedPage);

    throwForSupabaseError(initialPage.error, 'chargement des postes');
    const total = initialPage.count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, totalPages);
    let items = initialPage.data ?? [];

    if (page !== requestedPage) {
      const resolvedPage = await pageQuery(page);
      throwForSupabaseError(resolvedPage.error, 'chargement des postes');
      items = resolvedPage.data ?? [];
    }

    return {
      items,
      page,
      pageSize,
      total,
      totalPages,
      hasMore: page < totalPages,
    };
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

import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import { throwForSupabaseError } from '../common/supabase-error';
import { nullableRpcArgs } from '../database/database.aliases';
import type { Database, Json } from '../database/database.types';
import { SupabaseService } from '../database/supabase.service';
import type {
  CreatePortCallDto,
  ListPortCallsQuery,
  PortCallFiltersQuery,
  SearchPortCallsQuery,
  SetDemandProfileDto,
  UpdatePortCallTimingDto,
} from './port-call.dto';

type PortCall = Database['public']['Tables']['port_calls']['Row'];
export type PortCallSearchPage = Readonly<{
  items: PortCall[];
  included: PortCall[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}>;

const DEFAULT_LIST_LIMIT = 250;
const MAX_FILTER_WINDOW_MS = 366 * 24 * 60 * 60 * 1_000;

function escapePostgrestLikeTerm(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('%', '\\%')
    .replaceAll('_', '\\_')
    .replaceAll('*', '\\*');
}

function portCallSearchPattern(value: string): string {
  return `%${escapePostgrestLikeTerm(value)}%`;
}

function columnWindowFilter(
  column: string,
  from: string | undefined,
  to: string | undefined,
): string {
  const filters: string[] = [];
  if (from) filters.push(`${column}.gte.${from}`);
  if (to) filters.push(`${column}.lt.${to}`);
  return filters.join(',');
}

function portCallWindowFilter(
  from: string | undefined,
  to: string | undefined,
): string | null {
  if (!from && !to) return null;

  const arrival = columnWindowFilter('estimated_arrival_at', from, to);
  const scheduledArrival = columnWindowFilter('scheduled_arrival_at', from, to);
  const departure = columnWindowFilter('estimated_departure_at', from, to);
  const scheduledDeparture = columnWindowFilter(
    'scheduled_departure_at',
    from,
    to,
  );

  return [
    `and(${arrival})`,
    `and(estimated_arrival_at.is.null,${scheduledArrival})`,
    `and(${departure})`,
    `and(estimated_departure_at.is.null,${scheduledDeparture})`,
  ].join(',');
}

function normalizedWindow(input: PortCallFiltersQuery): Readonly<{
  from?: string;
  to?: string;
}> {
  const fromTime = input.from ? new Date(input.from).getTime() : undefined;
  const toTime = input.to ? new Date(input.to).getTime() : undefined;
  if (
    (fromTime !== undefined && !Number.isFinite(fromTime)) ||
    (toTime !== undefined && !Number.isFinite(toTime))
  ) {
    throw new BadRequestException('La période des escales est invalide.');
  }
  if (fromTime !== undefined && toTime !== undefined && fromTime >= toTime) {
    throw new BadRequestException(
      'La fin de la période des escales doit suivre son début.',
    );
  }
  if (
    fromTime !== undefined &&
    toTime !== undefined &&
    toTime - fromTime > MAX_FILTER_WINDOW_MS
  ) {
    throw new BadRequestException(
      'La période de recherche des escales est limitée à 366 jours.',
    );
  }

  return {
    from: fromTime === undefined ? undefined : new Date(fromTime).toISOString(),
    to: toTime === undefined ? undefined : new Date(toTime).toISOString(),
  };
}

function assertValidOverrideWindow(validUntil: string): void {
  const duration = new Date(validUntil).getTime() - Date.now();
  if (
    !Number.isFinite(duration) ||
    duration < 5 * 60 * 1_000 ||
    duration > 24 * 60 * 60 * 1_000
  ) {
    throw new BadRequestException(
      'La correction doit expirer entre 5 minutes et 24 heures.',
    );
  }
}

@Injectable()
export class PortCallsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(
    accessToken: string,
    input: ListPortCallsQuery,
  ): Promise<PortCall[]> {
    const window = normalizedWindow(input);
    let query = this.supabase
      .forUser(accessToken)
      .from('port_calls')
      .select('*')
      .eq('site_id', input.siteId)
      .order('scheduled_arrival_at', { ascending: false, nullsFirst: false })
      .order('scheduled_departure_at', {
        ascending: false,
        nullsFirst: false,
      })
      .order('id')
      .limit(input.limit ?? DEFAULT_LIST_LIMIT);

    if (input.status?.length) query = query.in('status', input.status);
    if (input.q) {
      query = query.ilike('external_reference', portCallSearchPattern(input.q));
    }
    const windowFilter = portCallWindowFilter(window.from, window.to);
    if (windowFilter) query = query.or(windowFilter);

    const { data, error } = await query;

    throwForSupabaseError(error, 'chargement des escales');

    return data ?? [];
  }

  async search(
    accessToken: string,
    input: SearchPortCallsQuery,
  ): Promise<PortCallSearchPage> {
    const window = normalizedWindow(input);
    const client = this.supabase.forUser(accessToken);
    const requestedPage = input.page ?? 1;
    const pageSize = input.pageSize ?? 25;
    const windowFilter = portCallWindowFilter(window.from, window.to);

    const pageQuery = (page: number) => {
      let query = client
        .from('port_calls')
        .select('*', { count: 'exact' })
        .eq('site_id', input.siteId)
        .order('scheduled_arrival_at', {
          ascending: false,
          nullsFirst: false,
        })
        .order('scheduled_departure_at', {
          ascending: false,
          nullsFirst: false,
        })
        .order('id')
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (input.status?.length) query = query.in('status', input.status);
      if (input.q) {
        query = query.ilike(
          'external_reference',
          portCallSearchPattern(input.q),
        );
      }
      if (windowFilter) query = query.or(windowFilter);
      return query;
    };

    const includedQuery = input.includeId
      ? client
          .from('port_calls')
          .select('*')
          .eq('site_id', input.siteId)
          .eq('id', input.includeId)
          .limit(1)
      : null;
    const [initialPage, includedResult] = await Promise.all([
      pageQuery(requestedPage),
      includedQuery ?? Promise.resolve({ data: [] as PortCall[], error: null }),
    ]);

    throwForSupabaseError(initialPage.error, 'recherche des escales');
    throwForSupabaseError(
      includedResult.error,
      'chargement de l’escale sélectionnée',
    );

    const total = initialPage.count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, totalPages);
    let items = initialPage.data ?? [];

    if (page !== requestedPage) {
      const resolvedPage = await pageQuery(page);
      throwForSupabaseError(resolvedPage.error, 'recherche des escales');
      items = resolvedPage.data ?? [];
    }

    const itemIds = new Set(items.map((call) => call.id));
    const included = (includedResult.data ?? []).filter(
      (call) => !itemIds.has(call.id),
    );

    return {
      items,
      included,
      page,
      pageSize,
      total,
      totalPages,
    };
  }

  async create(
    accessToken: string,
    input: CreatePortCallDto,
  ): Promise<PortCall> {
    const { data, error } = await this.supabase.forUser(accessToken).rpc(
      'create_manual_port_call',
      nullableRpcArgs<
        'create_manual_port_call',
        | 'target_route_id'
        | 'new_external_reference'
        | 'new_scheduled_arrival_at'
        | 'new_scheduled_departure_at'
      >({
        target_organization_id: input.organizationId,
        target_site_id: input.siteId,
        target_vessel_id: input.vesselId,
        target_route_id: input.routeId ?? null,
        new_external_reference: input.externalReference ?? null,
        new_scheduled_arrival_at: input.scheduledArrivalAt ?? null,
        new_scheduled_departure_at: input.scheduledDepartureAt ?? null,
      }),
    );

    throwForSupabaseError(error, 'création de l’escale');

    if (!data) {
      throw new ServiceUnavailableException('Escale créée sans réponse.');
    }

    return data;
  }

  async updateTiming(
    accessToken: string,
    portCallId: string,
    input: UpdatePortCallTimingDto,
  ): Promise<Json> {
    assertValidOverrideWindow(input.validUntil);
    const client = this.supabase.forUser(accessToken);
    const { data, error } = await client.rpc(
      'override_port_call_timing',
      nullableRpcArgs<
        'override_port_call_timing',
        | 'new_estimated_arrival_at'
        | 'new_estimated_departure_at'
        | 'expected_current_source_revision'
        | 'override_source_revision'
      >({
        target_port_call_id: portCallId,
        new_estimated_arrival_at: input.estimatedArrivalAt ?? null,
        new_estimated_departure_at: input.estimatedDepartureAt ?? null,
        new_status: input.status,
        override_source: 'tools-panel',
        override_source_revision: null,
        expected_current_source_revision:
          input.expectedCurrentSourceRevision ?? null,
        expected_timing_lock_version: input.expectedTimingLockVersion,
        override_reason: input.reason.trim(),
        override_valid_until: input.validUntil,
      }),
    );

    throwForSupabaseError(error, 'analyse de la perturbation');

    if (data === null) {
      throw new ServiceUnavailableException('Analyse sans résultat.');
    }

    return data;
  }

  async setDemandProfile(
    accessToken: string,
    portCallId: string,
    input: SetDemandProfileDto,
  ): Promise<PortCall> {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .from('port_calls')
      .update({ demand_profile_id: input.demandProfileId ?? null })
      .eq('id', portCallId)
      .select()
      .single();

    throwForSupabaseError(error, 'affectation du profil de demande');

    if (!data) {
      throw new ServiceUnavailableException('Escale mise à jour sans réponse.');
    }

    return data;
  }
}

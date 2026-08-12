import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { throwForSupabaseError } from '../common/supabase-error';
import type { Database } from '../database/database.types';
import { SupabaseService } from '../database/supabase.service';
import type {
  CreateAgentDto,
  SearchAgentsQuery,
  UpdateAgentDto,
} from './agent.dto';

type Agent = Database['public']['Tables']['agents']['Row'];
export type AgentSearchPage = Readonly<{
  items: Agent[];
  included: Agent[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
  counts: Readonly<{
    all: number;
    active: number;
    inactive: number;
  }>;
}>;

export type AgentOffboardingPlan = Readonly<{
  status: 'scheduled' | 'completed' | 'cancelled' | 'failed';
  effectiveAt: string;
  retryCount: number;
  failureCode: string | null;
  failedAt: string | null;
}>;

const LEGACY_BATCH_SIZE = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseAgentRpcResult(value: unknown, operation: string): Agent {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.organization_id !== 'string' ||
    typeof value.primary_site_id !== 'string' ||
    typeof value.employee_number !== 'string' ||
    typeof value.display_name !== 'string' ||
    typeof value.active !== 'boolean'
  ) {
    throw new ServiceUnavailableException(`${operation} sans réponse valide.`);
  }

  return value as Agent;
}

function parseOffboardingPlanRpcResult(value: unknown): AgentOffboardingPlan {
  if (
    !isRecord(value) ||
    !['scheduled', 'completed', 'cancelled', 'failed'].includes(
      String(value.status),
    ) ||
    typeof value.effectiveAt !== 'string' ||
    typeof value.retryCount !== 'number' ||
    (value.failureCode !== null && typeof value.failureCode !== 'string') ||
    (value.failedAt !== null && typeof value.failedAt !== 'string')
  ) {
    throw new ServiceUnavailableException(
      'Suivi de départ chargé sans réponse valide.',
    );
  }

  return value as unknown as AgentOffboardingPlan;
}

function escapePostgrestLikeTerm(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('%', '\\%')
    .replaceAll('_', '\\_')
    .replaceAll('*', '\\*');
}

function quotePostgrestFilterValue(value: string): string {
  // PostgREST treats commas and parentheses as grammar only outside quotes.
  // Quotes/backslashes are escaped above before the user value reaches `.or()`.
  return `"${value}"`;
}

function agentSearchFilter(value: string): string {
  const pattern = quotePostgrestFilterValue(
    `%${escapePostgrestLikeTerm(value)}%`,
  );
  return `display_name.ilike.${pattern},employee_number.ilike.${pattern}`;
}

@Injectable()
export class AgentsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(
    accessToken: string,
    siteId?: string,
    organizationId?: string,
  ): Promise<Agent[]> {
    const agents: Agent[] = [];

    for (let from = 0; ; from += LEGACY_BATCH_SIZE) {
      let query = this.supabase
        .forUser(accessToken)
        .from('agents')
        .select('*')
        .order('display_name')
        .order('id')
        .range(from, from + LEGACY_BATCH_SIZE - 1);

      if (siteId) query = query.eq('primary_site_id', siteId);
      if (organizationId) query = query.eq('organization_id', organizationId);

      const { data, error } = await query;

      throwForSupabaseError(error, 'chargement des agents');
      const batch = data ?? [];
      agents.push(...batch);
      if (batch.length < LEGACY_BATCH_SIZE) break;
    }

    return agents;
  }

  async search(
    accessToken: string,
    input: SearchAgentsQuery,
  ): Promise<AgentSearchPage> {
    const client = this.supabase.forUser(accessToken);
    const requestedPage = input.page ?? 1;
    const pageSize = input.pageSize ?? 25;
    const status = input.status ?? 'active';
    const search = input.q?.trim();

    const pageQuery = (page: number) => {
      let query = client
        .from('agents')
        .select('*', { count: 'exact' })
        .order('display_name')
        .order('employee_number')
        .order('id')
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (input.siteId) query = query.eq('primary_site_id', input.siteId);
      if (input.organizationId) {
        query = query.eq('organization_id', input.organizationId);
      }
      if (status !== 'all') {
        query = query.eq('active', status === 'active');
      }
      if (search) query = query.or(agentSearchFilter(search));

      return query;
    };

    let activeCountQuery = client
      .from('agents')
      .select('id', { count: 'exact', head: true })
      .eq('active', true);
    let inactiveCountQuery = client
      .from('agents')
      .select('id', { count: 'exact', head: true })
      .eq('active', false);

    if (input.siteId) {
      activeCountQuery = activeCountQuery.eq('primary_site_id', input.siteId);
      inactiveCountQuery = inactiveCountQuery.eq(
        'primary_site_id',
        input.siteId,
      );
    }
    if (input.organizationId) {
      activeCountQuery = activeCountQuery.eq(
        'organization_id',
        input.organizationId,
      );
      inactiveCountQuery = inactiveCountQuery.eq(
        'organization_id',
        input.organizationId,
      );
    }

    const includeIds = [...new Set(input.includeIds ?? [])];
    let includedQuery = includeIds.length
      ? client
          .from('agents')
          .select('*')
          .in('id', includeIds)
          .order('display_name')
          .order('id')
      : null;

    if (includedQuery && input.siteId) {
      includedQuery = includedQuery.eq('primary_site_id', input.siteId);
    }
    if (includedQuery && input.organizationId) {
      includedQuery = includedQuery.eq('organization_id', input.organizationId);
    }

    const [initialPage, activeCount, inactiveCount, includedResult] =
      await Promise.all([
        pageQuery(requestedPage),
        activeCountQuery,
        inactiveCountQuery,
        includedQuery ?? Promise.resolve({ data: [] as Agent[], error: null }),
      ]);

    throwForSupabaseError(initialPage.error, 'recherche des agents');
    throwForSupabaseError(activeCount.error, 'comptage des agents actifs');
    throwForSupabaseError(inactiveCount.error, 'comptage des agents inactifs');
    throwForSupabaseError(
      includedResult.error,
      'chargement des agents déjà affectés',
    );

    const total = initialPage.count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, totalPages);
    let items = initialPage.data ?? [];

    if (page !== requestedPage) {
      const resolvedPage = await pageQuery(page);
      throwForSupabaseError(resolvedPage.error, 'recherche des agents');
      items = resolvedPage.data ?? [];
    }

    const itemIds = new Set(items.map((agent) => agent.id));
    const included = (includedResult.data ?? []).filter(
      (agent) => !itemIds.has(agent.id),
    );
    const active = activeCount.count ?? 0;
    const inactive = inactiveCount.count ?? 0;

    return {
      items,
      included,
      page,
      pageSize,
      total,
      totalPages,
      hasMore: page < totalPages,
      counts: { all: active + inactive, active, inactive },
    };
  }

  async get(accessToken: string, agentId: string): Promise<Agent> {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();

    throwForSupabaseError(error, 'chargement de l’agent');

    if (!data) {
      throw new ServiceUnavailableException('Agent chargé sans réponse.');
    }

    return data;
  }

  async create(accessToken: string, input: CreateAgentDto): Promise<Agent> {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .rpc('create_agent_record', {
        target_organization_id: input.organizationId,
        target_primary_site_id: input.primarySiteId,
        new_user_id: input.userId,
        new_employee_number: input.employeeNumber,
        new_display_name: input.displayName,
        new_active: input.active,
        new_hired_on: input.hiredOn,
      });

    throwForSupabaseError(error, 'création de l’agent');

    if (!data) {
      throw new ServiceUnavailableException('Agent créé sans réponse.');
    }

    return parseAgentRpcResult(data, 'Agent créé');
  }

  async update(
    accessToken: string,
    agentId: string,
    input: UpdateAgentDto,
  ): Promise<Agent> {
    const changes: Record<string, string | boolean | null> = {};

    if (input.primarySiteId !== undefined) {
      changes.primarySiteId = input.primarySiteId;
    }
    if (input.employeeNumber !== undefined) {
      changes.employeeNumber = input.employeeNumber;
    }
    if (input.displayName !== undefined) {
      changes.displayName = input.displayName;
    }
    if (input.active !== undefined) changes.active = input.active;
    if (input.hiredOn !== undefined) changes.hiredOn = input.hiredOn;
    if (input.leftOn !== undefined) changes.leftOn = input.leftOn;
    if (input.offboardingReason !== undefined) {
      changes.offboardingReason = input.offboardingReason;
    }

    const { data, error } = await this.supabase
      .forUser(accessToken)
      .rpc('update_agent_record', {
        target_agent_id: agentId,
        target_organization_id: input.organizationId,
        changes,
      });

    throwForSupabaseError(error, 'modification de l’agent');

    if (!data) {
      throw new ServiceUnavailableException('Agent modifié sans réponse.');
    }

    return parseAgentRpcResult(data, 'Agent modifié');
  }

  async reactivate(
    accessToken: string,
    agentId: string,
    organizationId: string,
    reason: string,
  ): Promise<Agent> {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .rpc('reactivate_agent_record', {
        target_agent_id: agentId,
        target_organization_id: organizationId,
        reactivation_reason: reason,
      });

    throwForSupabaseError(error, 'réactivation de l’agent');

    if (!data) {
      throw new ServiceUnavailableException('Agent réactivé sans réponse.');
    }

    return parseAgentRpcResult(data, 'Agent réactivé');
  }

  async getOffboardingPlan(
    accessToken: string,
    agentId: string,
    organizationId: string,
  ): Promise<AgentOffboardingPlan | null> {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .rpc('get_agent_offboarding_plan', {
        target_agent_id: agentId,
        target_organization_id: organizationId,
      });

    throwForSupabaseError(error, 'chargement du suivi de départ');
    return data === null ? null : parseOffboardingPlanRpcResult(data);
  }

  async retryOffboarding(
    accessToken: string,
    agentId: string,
    organizationId: string,
    reason: string,
  ): Promise<AgentOffboardingPlan> {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .rpc('retry_failed_agent_offboarding', {
        target_agent_id: agentId,
        target_organization_id: organizationId,
        retry_reason: reason,
      });

    throwForSupabaseError(error, 'relance du départ');

    if (!data) {
      throw new ServiceUnavailableException('Départ relancé sans réponse.');
    }

    return parseOffboardingPlanRpcResult(data);
  }
}

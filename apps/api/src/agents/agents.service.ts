import { randomUUID } from 'node:crypto';

import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { throwForSupabaseError } from '../common/supabase-error';
import type { Database } from '../database/database.types';
import { SupabaseService } from '../database/supabase.service';
import type { CreateAgentDto, UpdateAgentDto } from './agent.dto';

type Agent = Database['public']['Tables']['agents']['Row'];

@Injectable()
export class AgentsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(
    accessToken: string,
    siteId?: string,
    organizationId?: string,
  ): Promise<Agent[]> {
    let query = this.supabase
      .forUser(accessToken)
      .from('agents')
      .select('*')
      .order('display_name')
      .limit(500);

    if (siteId) query = query.eq('primary_site_id', siteId);
    if (organizationId) query = query.eq('organization_id', organizationId);

    const { data, error } = await query;

    throwForSupabaseError(error, 'chargement des agents');

    return data ?? [];
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
      .from('agents')
      .insert({
        organization_id: input.organizationId,
        primary_site_id: input.primarySiteId,
        user_id: input.userId,
        employee_number:
          input.employeeNumber ??
          `AG-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`,
        display_name: input.displayName,
        active: input.active,
        hired_on: input.hiredOn,
      })
      .select()
      .single();

    throwForSupabaseError(error, 'création de l’agent');

    if (!data) {
      throw new ServiceUnavailableException('Agent créé sans réponse.');
    }

    return data;
  }

  async update(
    accessToken: string,
    agentId: string,
    input: UpdateAgentDto,
  ): Promise<Agent> {
    const changes: Database['public']['Tables']['agents']['Update'] = {};

    if (input.primarySiteId !== undefined) {
      changes.primary_site_id = input.primarySiteId;
    }
    if (input.employeeNumber !== undefined) {
      changes.employee_number = input.employeeNumber;
    }
    if (input.displayName !== undefined) {
      changes.display_name = input.displayName;
    }
    if (input.active !== undefined) changes.active = input.active;
    if (input.hiredOn !== undefined) changes.hired_on = input.hiredOn;
    if (input.leftOn !== undefined) changes.left_on = input.leftOn;

    const { data, error } = await this.supabase
      .forUser(accessToken)
      .from('agents')
      .update(changes)
      .eq('id', agentId)
      .eq('organization_id', input.organizationId)
      .select()
      .single();

    throwForSupabaseError(error, 'modification de lâ€™agent');

    if (!data) {
      throw new ServiceUnavailableException('Agent modifié sans réponse.');
    }

    return data;
  }
}

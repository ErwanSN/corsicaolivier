import { randomUUID } from 'node:crypto';

import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import type { AuthIdentity } from '../auth/auth-context';
import { throwForSupabaseError } from '../common/supabase-error';
import { nullableRpcArgs } from '../database/database.aliases';
import type { Database } from '../database/database.types';
import { SupabaseService } from '../database/supabase.service';
import type {
  AddGroupMemberDto,
  CreateAgentUnavailabilityDto,
  CreateGroupDto,
  EndAgentUnavailabilityDto,
  EndGroupMembershipDto,
  ListAgentUnavailabilityQuery,
  SetAgentContractDto,
  SetAgentSkillDto,
  SetGroupHourTargetsDto,
  SetHourTargetDto,
  SetPositionPreferenceDto,
  SetPositionRestrictionDto,
  SetPositionSkillRequirementDto,
} from './workforce.dto';

type AgentGroup = Database['public']['Tables']['agent_groups']['Row'];
type HourTarget = Database['public']['Tables']['hour_target_overrides']['Row'];
type AgentUnavailability =
  Database['public']['Tables']['agent_unavailability']['Row'];
type AgentUnavailabilityPage = Readonly<{
  items: AgentUnavailability[];
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
export class WorkforceService {
  constructor(private readonly supabase: SupabaseService) {}

  async listGroups(
    accessToken: string,
    siteId?: string,
  ): Promise<AgentGroup[]> {
    let query = this.supabase
      .forUser(accessToken)
      .from('agent_groups')
      .select('*')
      .eq('active', true)
      .order('name');

    if (siteId) query = query.eq('site_id', siteId);

    const { data, error } = await query;

    throwForSupabaseError(error, 'chargement des groupes');
    return data ?? [];
  }

  async listGroupMembers(accessToken: string, groupId: string) {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .from('agent_group_memberships')
      .select('*')
      .eq('group_id', groupId)
      .order('effective_from', { ascending: false });

    throwForSupabaseError(error, 'chargement des membres du groupe');
    return data ?? [];
  }

  async listHourTargets(
    accessToken: string,
    siteId: string | undefined,
    weekStart: string,
  ) {
    let query = this.supabase
      .forUser(accessToken)
      .from('hour_target_overrides')
      .select('*')
      .eq('week_start', weekStart)
      .order('created_at', { ascending: false });

    if (siteId) query = query.eq('site_id', siteId);

    const { data, error } = await query;

    throwForSupabaseError(error, 'chargement des objectifs horaires');
    return data ?? [];
  }

  async listAgentRules(accessToken: string, agentId: string) {
    const client = this.supabase.forUser(accessToken);
    const [preferences, restrictions, contracts] = await Promise.all([
      client
        .from('agent_position_preferences')
        .select('*')
        .eq('agent_id', agentId)
        .order('valid_from', { ascending: false }),
      client
        .from('agent_position_restrictions')
        .select('*')
        .eq('agent_id', agentId)
        .order('valid_from', { ascending: false }),
      client
        .from('agent_contract_versions')
        .select('*')
        .eq('agent_id', agentId)
        .order('effective_from', { ascending: false }),
    ]);

    throwForSupabaseError(preferences.error, 'chargement des préférences');
    throwForSupabaseError(restrictions.error, 'chargement des restrictions');
    throwForSupabaseError(contracts.error, 'chargement des contrats');

    return {
      preferences: preferences.data ?? [],
      restrictions: restrictions.data ?? [],
      contracts: contracts.data ?? [],
    };
  }

  async setAgentContract(
    accessToken: string,
    agentId: string,
    input: SetAgentContractDto,
  ) {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .rpc('replace_agent_contract', {
        target_agent_id: agentId,
        target_organization_id: input.organizationId,
        new_effective_from: input.effectiveFrom,
        new_effective_until: input.effectiveUntil,
        new_weekly_target_minutes: input.weeklyTargetMinutes,
        new_monthly_target_minutes: input.monthlyTargetMinutes,
        new_label: input.label,
      });

    throwForSupabaseError(error, 'création de la version contractuelle');
    return this.requireData(data, 'Contrat créé sans réponse.');
  }

  async createGroup(
    accessToken: string,
    input: CreateGroupDto,
  ): Promise<AgentGroup> {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .from('agent_groups')
      .insert({
        organization_id: input.organizationId,
        site_id: input.siteId,
        code:
          input.code ??
          `GRP-${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`,
        name: input.name,
        description: input.description,
      })
      .select()
      .single();

    throwForSupabaseError(error, 'création du groupe');
    return this.requireData(data, 'Groupe créé sans réponse.');
  }

  async addMember(
    accessToken: string,
    groupId: string,
    input: AddGroupMemberDto,
  ) {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .rpc('replace_agent_group_membership', {
        target_group_id: groupId,
        target_agent_id: input.agentId,
        target_organization_id: input.organizationId,
        new_effective_from: input.effectiveFrom,
        new_effective_until: input.effectiveUntil,
        new_is_primary: input.isPrimary,
      });

    throwForSupabaseError(error, 'rattachement au groupe');
    return this.requireData(data, 'Rattachement créé sans réponse.');
  }

  async setGroupHourTargets(
    accessToken: string,
    groupId: string,
    input: SetGroupHourTargetsDto,
  ): Promise<AgentGroup> {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .from('agent_groups')
      .update({
        weekly_target_minutes: input.weeklyTargetMinutes ?? null,
        monthly_target_minutes: input.monthlyTargetMinutes ?? null,
      })
      .eq('id', groupId)
      .eq('organization_id', input.organizationId)
      .select()
      .single();

    throwForSupabaseError(error, 'mise à jour des objectifs du groupe');
    return this.requireData(data, 'Objectifs du groupe modifiés sans réponse.');
  }

  async endMembership(
    accessToken: string,
    groupId: string,
    membershipId: string,
    input: EndGroupMembershipDto,
  ) {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .rpc('end_agent_group_membership', {
        target_group_id: groupId,
        target_membership_id: membershipId,
        target_organization_id: input.organizationId,
        new_effective_until: input.effectiveUntil,
      });

    throwForSupabaseError(error, 'retrait du collaborateur');
    return this.requireData(data, 'Rattachement modifié sans réponse.');
  }

  async setHourTarget(
    auth: AuthIdentity,
    input: SetHourTargetDto,
  ): Promise<HourTarget> {
    const { data, error } = await this.supabase.forUser(auth.accessToken).rpc(
      'set_hour_target_override',
      nullableRpcArgs<
        'set_hour_target_override',
        'target_site_id' | 'target_agent_id' | 'target_group_id'
      >({
        target_organization_id: input.organizationId,
        target_site_id: input.siteId ?? null,
        target_agent_id: input.agentId ?? null,
        target_group_id: input.groupId ?? null,
        target_week_start: input.weekStart,
        new_target_minutes: input.targetMinutes,
        new_reason: input.reason,
      }),
    );

    throwForSupabaseError(error, 'mise à jour de l’objectif horaire');
    return this.requireData(
      data,
      'Objectif créé sans réponse.',
    ) as unknown as HourTarget;
  }

  async getHourBalance(
    accessToken: string,
    agentId: string,
    weekStart: string,
    scheduleVersionId?: string,
  ) {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .rpc('get_agent_hour_balance', {
        target_agent_id: agentId,
        target_week_start: weekStart,
        target_schedule_version_id: scheduleVersionId,
      });

    throwForSupabaseError(error, 'calcul du compteur horaire');
    return this.requireData(data, 'Compteur calculé sans réponse.');
  }

  async setPreference(
    auth: AuthIdentity,
    agentId: string,
    input: SetPositionPreferenceDto,
  ) {
    const { data, error } = await this.supabase
      .forUser(auth.accessToken)
      .rpc('replace_agent_position_preference', {
        target_agent_id: agentId,
        target_organization_id: input.organizationId,
        target_position_id: input.positionId,
        new_level: input.level,
        new_priority: input.priority,
        new_note: input.note,
        new_valid_from: input.validFrom,
        new_valid_until: input.validUntil,
      });

    throwForSupabaseError(error, 'enregistrement de la préférence');
    return this.requireData(data, 'Préférence créée sans réponse.');
  }

  async setRestriction(
    auth: AuthIdentity,
    agentId: string,
    input: SetPositionRestrictionDto,
  ) {
    const { data, error } = await this.supabase
      .forUser(auth.accessToken)
      .rpc('replace_agent_position_restriction', {
        target_agent_id: agentId,
        target_organization_id: input.organizationId,
        target_position_id: input.positionId,
        new_reason: input.reason,
        new_valid_from: input.validFrom,
        new_valid_until: input.validUntil,
      });

    throwForSupabaseError(error, 'enregistrement de la restriction');
    return this.requireData(data, 'Restriction créée sans réponse.');
  }

  async listAgentSkills(accessToken: string, agentId: string) {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .from('agent_skills')
      .select('*')
      .eq('agent_id', agentId)
      .order('valid_from', { ascending: false });

    throwForSupabaseError(error, 'chargement des compétences de l’agent');
    return data ?? [];
  }

  async setAgentSkill(
    auth: AuthIdentity,
    agentId: string,
    input: SetAgentSkillDto,
  ) {
    const { data, error } = await this.supabase
      .forUser(auth.accessToken)
      .rpc('replace_agent_skill', {
        target_agent_id: agentId,
        target_organization_id: input.organizationId,
        target_skill_id: input.skillId,
        new_level: input.level,
        new_valid_from: input.validFrom,
        new_valid_until: input.validUntil,
      });

    throwForSupabaseError(error, 'attribution de la compétence');
    return this.requireData(data, 'Compétence attribuée sans réponse.');
  }

  async listPositionSkills(accessToken: string, positionId: string) {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .from('position_skill_requirements')
      .select('*')
      .eq('position_id', positionId)
      .order('minimum_level', { ascending: false });

    throwForSupabaseError(error, 'chargement des exigences du poste');
    return data ?? [];
  }

  async setPositionSkill(
    accessToken: string,
    positionId: string,
    input: SetPositionSkillRequirementDto,
  ) {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .from('position_skill_requirements')
      .upsert(
        {
          organization_id: input.organizationId,
          position_id: positionId,
          skill_id: input.skillId,
          minimum_level: input.minimumLevel,
          mandatory: input.mandatory,
        },
        { onConflict: 'position_id,skill_id' },
      )
      .select()
      .single();

    throwForSupabaseError(error, 'configuration des exigences du poste');
    return this.requireData(data, 'Exigence enregistrée sans réponse.');
  }

  async listAgentUnavailability(
    accessToken: string,
    agentId: string,
    input: ListAgentUnavailabilityQuery,
  ): Promise<AgentUnavailabilityPage> {
    const client = this.supabase.forUser(accessToken);
    const requestedPage = input.page ?? 1;
    const pageSize = input.pageSize ?? 20;
    const scope = input.scope ?? 'all';
    const search = input.q?.trim();
    const now = new Date().toISOString();
    const pageQuery = (page: number) => {
      let query = client
        .from('agent_unavailability')
        .select('*', { count: 'exact' })
        .eq('agent_id', agentId)
        .order('starts_at', { ascending: scope === 'upcoming' })
        .order('id')
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (scope === 'upcoming') query = query.gt('ends_at', now);
      if (scope === 'past') query = query.lte('ends_at', now);
      if (search) {
        const term = `%${escapePostgrestLikeTerm(search)}%`;
        query = query.ilike('note', term);
      }

      return query;
    };

    const initialPage = await pageQuery(requestedPage);
    throwForSupabaseError(initialPage.error, 'chargement des indisponibilités');
    const total = initialPage.count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, totalPages);
    let items = initialPage.data ?? [];

    if (page !== requestedPage) {
      const resolvedPage = await pageQuery(page);
      throwForSupabaseError(
        resolvedPage.error,
        'chargement des indisponibilités',
      );
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

  async createAgentUnavailability(
    auth: AuthIdentity,
    agentId: string,
    input: CreateAgentUnavailabilityDto,
  ) {
    const { data, error } = await this.supabase
      .forUser(auth.accessToken)
      .rpc('create_agent_unavailability', {
        target_agent_id: agentId,
        target_organization_id: input.organizationId,
        target_site_id: input.siteId,
        new_kind: input.kind,
        new_starts_at: input.startsAt,
        new_ends_at: input.endsAt,
        new_note: input.note,
      });

    throwForSupabaseError(error, 'création de l’indisponibilité');
    return this.requireData(data, 'Indisponibilité créée sans réponse.');
  }

  async endAgentUnavailability(
    accessToken: string,
    agentId: string,
    unavailabilityId: string,
    input: EndAgentUnavailabilityDto,
  ) {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .rpc('end_agent_unavailability', {
        target_unavailability_id: unavailabilityId,
        target_agent_id: agentId,
        new_ends_at: input.endsAt,
      });

    throwForSupabaseError(error, 'fin de l’indisponibilité');
    return this.requireData(data, 'Indisponibilité terminée sans réponse.');
  }

  private requireData<T>(data: T | null, message: string): T {
    if (!data) {
      throw new ServiceUnavailableException(message);
    }

    return data;
  }
}

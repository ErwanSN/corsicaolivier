import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { throwForSupabaseError } from '../common/supabase-error';
import type { Database } from '../database/database.types';
import { SupabaseService } from '../database/supabase.service';
import type {
  CreateDemandProfileDto,
  CreateDemandProfileLineDto,
  CreateLoadForecastDto,
  CreateSkillDto,
  CreateVesselDto,
} from './operations.dto';

type Skill = Database['public']['Tables']['skills']['Row'];
type Vessel = Database['public']['Tables']['vessels']['Row'];

@Injectable()
export class OperationsService {
  constructor(private readonly supabase: SupabaseService) {}

  async listSkills(accessToken: string, organizationId: string) {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .from('skills')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('active', true)
      .order('name');

    throwForSupabaseError(error, 'chargement des compétences');
    return data ?? [];
  }

  async createSkill(
    accessToken: string,
    input: CreateSkillDto,
  ): Promise<Skill> {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .from('skills')
      .insert({
        organization_id: input.organizationId,
        code: input.code,
        name: input.name,
        description: input.description,
      })
      .select()
      .single();

    throwForSupabaseError(error, 'création de la compétence');
    return this.requireData(data, 'Compétence créée sans réponse.');
  }

  async listVessels(accessToken: string, organizationId: string) {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .from('vessels')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('active', true)
      .order('name');

    throwForSupabaseError(error, 'chargement des navires');
    return data ?? [];
  }

  async createVessel(
    accessToken: string,
    input: CreateVesselDto,
  ): Promise<Vessel> {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .from('vessels')
      .insert({
        organization_id: input.organizationId,
        code: input.code,
        name: input.name,
        imo_number: input.imoNumber,
      })
      .select()
      .single();

    throwForSupabaseError(error, 'création du navire');
    return this.requireData(data, 'Navire créé sans réponse.');
  }

  async listLoadForecasts(accessToken: string, portCallId: string) {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .from('call_load_forecasts')
      .select('*')
      .eq('port_call_id', portCallId)
      .order('received_at', { ascending: false })
      .limit(50);

    throwForSupabaseError(error, 'chargement des prévisions');
    return data ?? [];
  }

  async createLoadForecast(accessToken: string, input: CreateLoadForecastDto) {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .from('call_load_forecasts')
      .insert({
        organization_id: input.organizationId,
        site_id: input.siteId,
        port_call_id: input.portCallId,
        passenger_count: input.passengerCount,
        passenger_quota: input.passengerQuota,
        vehicle_count: input.vehicleCount,
        freight_unit_count: input.freightUnitCount,
        coach_count: input.coachCount,
        source: input.source,
        source_revision: input.sourceRevision,
      })
      .select()
      .single();

    throwForSupabaseError(error, 'création de la prévision');
    return this.requireData(data, 'Prévision créée sans réponse.');
  }

  async listDemandProfiles(accessToken: string, siteId: string) {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .from('demand_profiles')
      .select('*')
      .eq('site_id', siteId)
      .order('code')
      .order('version', { ascending: false });

    throwForSupabaseError(error, 'chargement des profils de demande');
    return data ?? [];
  }

  async createDemandProfile(
    accessToken: string,
    input: CreateDemandProfileDto,
  ) {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .from('demand_profiles')
      .insert({
        organization_id: input.organizationId,
        site_id: input.siteId,
        code: input.code,
        name: input.name,
        version: input.version,
      })
      .select()
      .single();

    throwForSupabaseError(error, 'création du profil de demande');
    return this.requireData(data, 'Profil créé sans réponse.');
  }

  async listDemandProfileLines(accessToken: string, profileId: string) {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .from('demand_profile_lines')
      .select('*')
      .eq('demand_profile_id', profileId)
      .order('starts_offset_minutes');

    throwForSupabaseError(error, 'chargement des règles de demande');
    return data ?? [];
  }

  async addDemandProfileLine(
    accessToken: string,
    profileId: string,
    input: CreateDemandProfileLineDto,
  ) {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .from('demand_profile_lines')
      .insert({
        organization_id: input.organizationId,
        site_id: input.siteId,
        demand_profile_id: profileId,
        position_id: input.positionId,
        anchor: input.anchor,
        starts_offset_minutes: input.startsOffsetMinutes,
        duration_minutes: input.durationMinutes,
        base_agents: input.baseAgents,
        passengers_per_extra_agent: input.passengersPerExtraAgent,
        vehicles_per_extra_agent: input.vehiclesPerExtraAgent,
        minimum_agents: input.minimumAgents,
        maximum_agents: input.maximumAgents,
      })
      .select()
      .single();

    throwForSupabaseError(error, 'création de la règle de demande');
    return this.requireData(data, 'Règle créée sans réponse.');
  }

  async listRequirements(accessToken: string, planningPeriodId: string) {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .from('staffing_requirements')
      .select('*')
      .eq('planning_period_id', planningPeriodId)
      .order('starts_at');

    throwForSupabaseError(error, 'chargement des besoins');
    return data ?? [];
  }

  private requireData<T>(data: T | null, message: string): T {
    if (!data) {
      throw new ServiceUnavailableException(message);
    }

    return data;
  }
}

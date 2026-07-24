import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { throwForSupabaseError } from '../common/supabase-error';
import type { Database, Json } from '../database/database.types';
import { SupabaseService } from '../database/supabase.service';
import type {
  CreatePortCallDto,
  SetDemandProfileDto,
  UpdatePortCallTimingDto,
} from './port-call.dto';

type PortCall = Database['public']['Tables']['port_calls']['Row'];

@Injectable()
export class PortCallsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(accessToken: string, siteId: string): Promise<PortCall[]> {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .from('port_calls')
      .select('*')
      .eq('site_id', siteId)
      .order('scheduled_arrival_at', { ascending: false, nullsFirst: false })
      .limit(250);

    throwForSupabaseError(error, 'chargement des escales');

    return data ?? [];
  }

  async create(
    accessToken: string,
    input: CreatePortCallDto,
  ): Promise<PortCall> {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .from('port_calls')
      .insert({
        organization_id: input.organizationId,
        site_id: input.siteId,
        vessel_id: input.vesselId,
        route_id: input.routeId,
        external_reference: input.externalReference,
        scheduled_arrival_at: input.scheduledArrivalAt,
        scheduled_departure_at: input.scheduledDepartureAt,
        source: input.source,
      })
      .select()
      .single();

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
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .rpc('update_port_call_timing', {
        target_port_call_id: portCallId,
        new_estimated_arrival_at: input.estimatedArrivalAt ?? null,
        new_estimated_departure_at: input.estimatedDepartureAt ?? null,
        new_status: input.status,
        update_source: input.source,
        update_source_revision: input.sourceRevision ?? null,
      });

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

import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import type { AuthIdentity } from '../auth/auth-context';
import { throwForSupabaseError } from '../common/supabase-error';
import type { Database, Json } from '../database/database.types';
import { SupabaseService } from '../database/supabase.service';
import type {
  CreatePlanningShiftDto,
  ApproveReplanningScenarioDto,
  MovePlanningAssignmentDto,
  PublishScheduleDto,
  UpdatePlanningAssignmentDto,
} from './planning.dto';
import {
  buildPlanningWorkbook,
  type PlanningExportFile,
} from './planning-export';

type PlanningPeriod = Database['public']['Tables']['planning_periods']['Row'];
type ScheduleVersion = Database['public']['Tables']['schedule_versions']['Row'];

@Injectable()
export class PlanningService {
  constructor(private readonly supabase: SupabaseService) {}

  async listPeriods(
    accessToken: string,
    siteId: string,
  ): Promise<PlanningPeriod[]> {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .from('planning_periods')
      .select('*')
      .eq('site_id', siteId)
      .order('starts_on', { ascending: false })
      .limit(100);

    throwForSupabaseError(error, 'chargement des périodes');
    return data ?? [];
  }

  async listVersions(
    accessToken: string,
    planningPeriodId: string,
  ): Promise<ScheduleVersion[]> {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .from('schedule_versions')
      .select('*')
      .eq('planning_period_id', planningPeriodId)
      .order('version_number', { ascending: false });

    throwForSupabaseError(error, 'chargement des versions');
    return data ?? [];
  }

  async getSchedule(accessToken: string, scheduleVersionId: string) {
    const client = this.supabase.forUser(accessToken);
    const scheduleResult = await client
      .from('schedule_versions')
      .select('*')
      .eq('id', scheduleVersionId)
      .single();

    throwForSupabaseError(scheduleResult.error, 'chargement de la version');
    const version = this.requireData(
      scheduleResult.data,
      'Version chargée sans réponse.',
    );
    const periodResult = await client
      .from('planning_periods')
      .select('*')
      .eq('id', version.planning_period_id)
      .single();

    throwForSupabaseError(periodResult.error, 'chargement de la période');
    const period = this.requireData(
      periodResult.data,
      'Période chargée sans réponse.',
    );
    const shiftsResult = await client
      .from('planning_shifts')
      .select('*')
      .eq('schedule_version_id', scheduleVersionId)
      .order('starts_at');

    throwForSupabaseError(shiftsResult.error, 'chargement des shifts');

    const shifts = shiftsResult.data ?? [];

    if (shifts.length === 0) {
      return { version, period, shifts, assignments: [] };
    }

    const assignmentsResult = await client
      .from('shift_assignments')
      .select('*')
      .in(
        'planning_shift_id',
        shifts.map((shift) => shift.id),
      )
      .order('starts_at');

    throwForSupabaseError(
      assignmentsResult.error,
      'chargement des affectations',
    );

    return {
      version,
      period,
      shifts,
      assignments: assignmentsResult.data ?? [],
    };
  }

  async exportSchedule(
    accessToken: string,
    scheduleVersionId: string,
  ): Promise<PlanningExportFile> {
    const content = await this.getSchedule(accessToken, scheduleVersionId);
    const client = this.supabase.forUser(accessToken);
    const [agents, positions, portCalls, vessels, requirements, site] =
      await Promise.all([
        client
          .from('agents')
          .select('*')
          .eq('organization_id', content.version.organization_id)
          .eq('primary_site_id', content.version.site_id)
          .order('display_name')
          .limit(500),
        client
          .from('positions')
          .select('*')
          .eq('organization_id', content.version.organization_id)
          .or(`site_id.is.null,site_id.eq.${content.version.site_id}`)
          .order('code')
          .limit(250),
        client
          .from('port_calls')
          .select('*')
          .eq('site_id', content.version.site_id)
          .order('scheduled_arrival_at', {
            ascending: false,
            nullsFirst: false,
          })
          .limit(500),
        client
          .from('vessels')
          .select('*')
          .eq('organization_id', content.version.organization_id)
          .order('name'),
        client
          .from('staffing_requirements')
          .select('*')
          .eq('planning_period_id', content.period.id)
          .order('starts_at'),
        client
          .from('sites')
          .select('*')
          .eq('id', content.version.site_id)
          .single(),
      ]);

    throwForSupabaseError(agents.error, 'chargement des agents pour export');
    throwForSupabaseError(positions.error, 'chargement des postes pour export');
    throwForSupabaseError(
      portCalls.error,
      'chargement des escales pour export',
    );
    throwForSupabaseError(vessels.error, 'chargement des navires pour export');
    throwForSupabaseError(
      requirements.error,
      'chargement des besoins pour export',
    );
    throwForSupabaseError(site.error, 'chargement du site pour export');

    const callIds = (portCalls.data ?? []).map((call) => call.id);
    const forecasts = callIds.length
      ? await client
          .from('call_load_forecasts')
          .select('*')
          .in('port_call_id', callIds)
          .order('received_at', { ascending: false })
          .limit(1000)
      : { data: [], error: null };

    throwForSupabaseError(
      forecasts.error,
      'chargement des prévisions pour export',
    );

    return buildPlanningWorkbook({
      agents: agents.data ?? [],
      assignments: content.assignments,
      forecasts: forecasts.data ?? [],
      period: content.period,
      portCalls: portCalls.data ?? [],
      positions: positions.data ?? [],
      requirements: requirements.data ?? [],
      shifts: content.shifts,
      siteName: site.data?.name ?? 'Corsica Linea',
      vessels: vessels.data ?? [],
      version: content.version,
    });
  }

  async createShift(
    accessToken: string,
    scheduleVersionId: string,
    input: CreatePlanningShiftDto,
  ): Promise<Json> {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .rpc('create_planning_shift', {
        target_schedule_version_id: scheduleVersionId,
        target_agent_id: input.agentId,
        target_position_id: input.positionId,
        target_port_call_id: input.portCallId,
        shift_starts_at: input.startsAt,
        shift_ends_at: input.endsAt,
        shift_break_minutes: input.breakMinutes,
        shift_note: input.note,
      });

    throwForSupabaseError(error, 'création du shift');
    return this.requireData(data, 'Shift créé sans réponse.');
  }

  async moveAssignment(
    accessToken: string,
    scheduleVersionId: string,
    assignmentId: string,
    input: MovePlanningAssignmentDto,
  ): Promise<Json> {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .rpc('move_planning_assignment', {
        target_schedule_version_id: scheduleVersionId,
        target_assignment_id: assignmentId,
        target_work_date: input.workDate,
        target_position_id: input.positionId,
      });

    throwForSupabaseError(error, 'déplacement de l’affectation');
    return this.requireData(data, 'Affectation déplacée sans réponse.');
  }

  async updateAssignment(
    accessToken: string,
    scheduleVersionId: string,
    assignmentId: string,
    input: UpdatePlanningAssignmentDto,
  ): Promise<Json> {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .rpc('update_planning_assignment', {
        target_schedule_version_id: scheduleVersionId,
        target_assignment_id: assignmentId,
        target_agent_id: input.agentId,
        target_position_id: input.positionId,
        target_port_call_id: input.portCallId ?? null,
        shift_starts_at: input.startsAt,
        shift_ends_at: input.endsAt,
        shift_break_minutes: input.breakMinutes,
        shift_note: input.note ?? null,
      });

    throwForSupabaseError(error, 'modification de l’affectation');
    return this.requireData(data, 'Affectation modifiée sans réponse.');
  }

  async deleteAssignment(
    accessToken: string,
    scheduleVersionId: string,
    assignmentId: string,
  ): Promise<Json> {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .rpc('delete_planning_assignment', {
        target_schedule_version_id: scheduleVersionId,
        target_assignment_id: assignmentId,
      });

    throwForSupabaseError(error, 'suppression de l’affectation');
    return this.requireData(data, 'Affectation supprimée sans réponse.');
  }

  async publish(
    auth: AuthIdentity,
    scheduleVersionId: string,
    input: PublishScheduleDto,
  ): Promise<Json> {
    const { data, error } = await this.supabase
      .forUser(auth.accessToken)
      .rpc('publish_schedule_version', {
        target_schedule_version_id: scheduleVersionId,
        publication_reason: input.reason,
      });

    throwForSupabaseError(error, 'publication du planning');
    return this.requireData(data, 'Publication sans réponse.');
  }

  async listReplanningScenarios(accessToken: string, siteId: string) {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .from('replanning_scenarios')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(100);

    throwForSupabaseError(error, 'chargement des scénarios');
    return data ?? [];
  }

  async getReplanningScenario(accessToken: string, scenarioId: string) {
    const client = this.supabase.forUser(accessToken);
    const [scenario, impacts] = await Promise.all([
      client
        .from('replanning_scenarios')
        .select('*')
        .eq('id', scenarioId)
        .single(),
      client
        .from('replanning_impacts')
        .select('*')
        .eq('scenario_id', scenarioId)
        .order('severity', { ascending: false }),
    ]);

    throwForSupabaseError(scenario.error, 'chargement du scénario');
    throwForSupabaseError(impacts.error, 'chargement des impacts');

    return {
      scenario: this.requireData(scenario.data, 'Scénario sans réponse.'),
      impacts: impacts.data ?? [],
    };
  }

  async approveReplanningScenario(
    accessToken: string,
    scenarioId: string,
    input: ApproveReplanningScenarioDto,
  ): Promise<Json> {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .rpc('approve_replanning_scenario', {
        target_scenario_id: scenarioId,
        approval_reason: input.reason,
      });

    throwForSupabaseError(error, 'approbation de la replanification');
    return this.requireData(data, 'Approbation sans réponse.');
  }

  private requireData<T>(data: T | null, message: string): T {
    if (!data) {
      throw new ServiceUnavailableException(message);
    }

    return data;
  }
}

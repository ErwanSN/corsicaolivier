import {
  ConflictException,
  Injectable,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';

import type { AuthIdentity } from '../auth/auth-context';
import { throwForSupabaseError } from '../common/supabase-error';
import { nullableRpcArgs } from '../database/database.aliases';
import type { Database, Json } from '../database/database.types';
import { SupabaseService } from '../database/supabase.service';
import type {
  CreatePlanningShiftDto,
  ApproveReplanningScenarioDto,
  DeletePlanningAssignmentDto,
  ListPlanningWorkforceConflictsQuery,
  ListReplanningScenariosQuery,
  MovePlanningAssignmentDto,
  PublishScheduleDto,
  RejectReplanningScenarioDto,
  ResolvePlanningWorkforceConflictDto,
  SavePlanningShiftServiceDto,
  UpdatePlanningAssignmentDto,
} from './planning.dto';
import {
  buildPlanningWorkbook,
  type PlanningExportData,
  type PlanningExportFile,
} from './planning-export';

type PlanningPeriod = Database['public']['Tables']['planning_periods']['Row'];
type ReplanningScenario =
  Database['public']['Tables']['replanning_scenarios']['Row'];
type ReplanningScenarioPage = Readonly<{
  items: ReplanningScenario[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}>;
type ScheduleVersion = Database['public']['Tables']['schedule_versions']['Row'];
type Agent = Database['public']['Tables']['agents']['Row'];
type Position = Database['public']['Tables']['positions']['Row'];
type PortCall = Database['public']['Tables']['port_calls']['Row'];
type CallLoadForecast =
  Database['public']['Tables']['call_load_forecasts']['Row'];
type PlanningShift = Database['public']['Tables']['planning_shifts']['Row'];
type PlanningShiftBreak =
  Database['public']['Tables']['planning_shift_breaks']['Row'];
type ShiftAssignment = Database['public']['Tables']['shift_assignments']['Row'];
type ScheduleRequirement =
  Database['public']['Functions']['get_schedule_requirements']['Returns'][number];
type ScheduleContent = Readonly<{
  assignments: ShiftAssignment[];
  breaks: PlanningShiftBreak[];
  period: PlanningPeriod;
  shifts: PlanningShift[];
  version: ScheduleVersion;
}>;

const EMPTY_EXPORT_ID = '00000000-0000-4000-8000-000000000000';
const EXPORT_LIMITS = {
  agents: 5_000,
  assignments: 10_000,
  breaks: 10_000,
  portCalls: 2_000,
  positions: 500,
  requirements: 10_000,
  shifts: 5_000,
  vessels: 500,
} as const;

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

@Injectable()
export class PlanningService {
  constructor(private readonly supabase: SupabaseService) {}

  async listPeriods(
    accessToken: string,
    siteId: string,
    startsOn?: string,
    endsOn?: string,
  ): Promise<PlanningPeriod[]> {
    let query = this.supabase
      .forUser(accessToken)
      .from('planning_periods')
      .select('*')
      .eq('site_id', siteId)
      .order('starts_on', { ascending: false });

    if (startsOn) query = query.gte('ends_on', startsOn);
    if (endsOn) query = query.lte('starts_on', endsOn);

    const { data, error } = await query.limit(100);

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
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .rpc('get_schedule_content', {
        target_schedule_version_id: scheduleVersionId,
      });

    throwForSupabaseError(error, 'chargement du planning');
    return this.requireScheduleContent(data);
  }

  async getScheduleRequirements(
    accessToken: string,
    scheduleVersionId: string,
  ): Promise<ScheduleRequirement[]> {
    return this.listScheduleRequirements(accessToken, scheduleVersionId);
  }

  async exportSchedule(
    accessToken: string,
    scheduleVersionId: string,
  ): Promise<PlanningExportFile> {
    const content = await this.getSchedule(accessToken, scheduleVersionId);
    this.assertExportLimit(
      'services',
      content.shifts.length,
      EXPORT_LIMITS.shifts,
    );
    this.assertExportLimit(
      'affectations',
      content.assignments.length,
      EXPORT_LIMITS.assignments,
    );
    this.assertExportLimit(
      'pauses',
      content.breaks.length,
      EXPORT_LIMITS.breaks,
    );

    return this.buildExport(accessToken, {
      assignments: content.assignments,
      breaks: content.breaks,
      organizationId: content.version.organization_id,
      period: content.period,
      shifts: content.shifts,
      siteId: content.version.site_id,
      scheduleVersionId: content.version.id,
      version: content.version,
    });
  }

  async exportWeek(
    accessToken: string,
    siteId: string,
    weekStart: string,
  ): Promise<PlanningExportFile> {
    const client = this.supabase.forUser(accessToken);
    const weekEnd = addDays(weekStart, 6);
    const [siteResult, periodsResult] = await Promise.all([
      client.from('sites').select('*').eq('id', siteId).single(),
      client
        .from('planning_periods')
        .select('*')
        .eq('site_id', siteId)
        .lte('starts_on', weekEnd)
        .gte('ends_on', weekStart)
        .order('starts_on', { ascending: false })
        .limit(1),
    ]);

    throwForSupabaseError(siteResult.error, 'chargement du site pour export');
    throwForSupabaseError(
      periodsResult.error,
      'chargement de la période pour export',
    );

    const site = this.requireData(
      siteResult.data,
      'Site chargé sans réponse pour export.',
    );
    const period = periodsResult.data?.at(0);

    if (period) {
      const versionsResult = await client
        .from('schedule_versions')
        .select('*')
        .eq('planning_period_id', period.id)
        .order('version_number', { ascending: false });

      throwForSupabaseError(
        versionsResult.error,
        'chargement des versions pour export',
      );
      const versions = versionsResult.data ?? [];
      const version =
        versions.find((item) => item.status === 'published') ??
        versions.find((item) => item.status === 'draft') ??
        versions.at(0);

      if (version) return this.exportSchedule(accessToken, version.id);
    }

    const exportPeriod: PlanningExportData['period'] = period ?? {
      ends_on: weekEnd,
      id: EMPTY_EXPORT_ID,
      name: `Semaine du ${weekStart}`,
      starts_on: weekStart,
      timezone: site.timezone,
    };

    return this.buildExport(accessToken, {
      assignments: [],
      breaks: [],
      organizationId: site.organization_id,
      period: exportPeriod,
      shifts: [],
      siteId,
      version: { label: 'Tableau affiché' },
    });
  }

  private async buildExport(
    accessToken: string,
    context: Pick<
      PlanningExportData,
      'assignments' | 'breaks' | 'period' | 'shifts' | 'version'
    > &
      Readonly<{
        organizationId: string;
        scheduleVersionId?: string;
        siteId: string;
      }>,
  ): Promise<PlanningExportFile> {
    const client = this.supabase.forUser(accessToken);
    const [agents, positions, vessels, scheduleRequirements, site] =
      await Promise.all([
        this.listExportAgents(
          accessToken,
          context.organizationId,
          context.siteId,
        ),
        this.listExportPositions(
          accessToken,
          context.organizationId,
          context.siteId,
        ),
        client
          .from('vessels')
          .select('*')
          .eq('organization_id', context.organizationId)
          .order('name'),
        context.scheduleVersionId
          ? this.listScheduleRequirements(
              accessToken,
              context.scheduleVersionId,
            )
          : Promise.resolve([] as ScheduleRequirement[]),
        client.from('sites').select('*').eq('id', context.siteId).single(),
      ]);

    throwForSupabaseError(vessels.error, 'chargement des navires pour export');
    throwForSupabaseError(site.error, 'chargement du site pour export');

    this.assertExportLimit(
      'navires',
      vessels.data?.length ?? 0,
      EXPORT_LIMITS.vessels,
    );
    const referencedCallIds = [
      ...context.assignments.map((assignment) => assignment.port_call_id),
      ...scheduleRequirements.map((requirement) => requirement.port_call_id),
    ].filter((id): id is string => Boolean(id));
    const portCalls = await this.listExportPortCalls(
      accessToken,
      context.organizationId,
      context.siteId,
      context.period,
      referencedCallIds,
    );
    const callIds = portCalls.map((call) => call.id);
    const forecasts = await this.listLatestForecasts(accessToken, callIds);

    return buildPlanningWorkbook({
      agents,
      assignments: context.assignments,
      breaks: context.breaks,
      forecasts,
      period: context.period,
      portCalls,
      positions,
      requirements: scheduleRequirements,
      shifts: context.shifts,
      siteName: site.data?.name ?? 'Corsica Linea',
      vessels: vessels.data ?? [],
      version: context.version,
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
        expected_lock_version: input.lockVersion,
      });

    throwForSupabaseError(error, 'création du shift');
    return this.requireData(data, 'Shift créé sans réponse.');
  }

  async createShiftService(
    accessToken: string,
    scheduleVersionId: string,
    input: SavePlanningShiftServiceDto,
  ): Promise<Json> {
    const { data, error } = await this.supabase.forUser(accessToken).rpc(
      'create_planning_shift_service',
      nullableRpcArgs<'create_planning_shift_service', 'shift_note'>({
        target_schedule_version_id: scheduleVersionId,
        target_agent_id: input.agentId,
        shift_starts_at: input.startsAt,
        shift_ends_at: input.endsAt,
        shift_segments: input.segments.map((segment) => ({
          positionId: segment.positionId,
          portCallId: segment.portCallId ?? null,
          staffingRequirementId: segment.staffingRequirementId ?? null,
          startsAt: segment.startsAt,
          endsAt: segment.endsAt,
        })),
        shift_breaks: input.breaks.map((shiftBreak) => ({
          startsAt: shiftBreak.startsAt,
          endsAt: shiftBreak.endsAt,
          label: shiftBreak.label ?? null,
        })),
        shift_note: input.note ?? null,
        expected_lock_version: input.lockVersion,
      }),
    );

    throwForSupabaseError(error, 'création du service');
    return this.requireData(data, 'Service créé sans réponse.');
  }

  async updateShiftService(
    accessToken: string,
    scheduleVersionId: string,
    shiftId: string,
    input: SavePlanningShiftServiceDto,
  ): Promise<Json> {
    const { data, error } = await this.supabase.forUser(accessToken).rpc(
      'update_planning_shift_service',
      nullableRpcArgs<'update_planning_shift_service', 'shift_note'>({
        target_schedule_version_id: scheduleVersionId,
        target_shift_id: shiftId,
        target_agent_id: input.agentId,
        shift_starts_at: input.startsAt,
        shift_ends_at: input.endsAt,
        shift_segments: input.segments.map((segment) => ({
          positionId: segment.positionId,
          portCallId: segment.portCallId ?? null,
          staffingRequirementId: segment.staffingRequirementId ?? null,
          startsAt: segment.startsAt,
          endsAt: segment.endsAt,
        })),
        shift_breaks: input.breaks.map((shiftBreak) => ({
          startsAt: shiftBreak.startsAt,
          endsAt: shiftBreak.endsAt,
          label: shiftBreak.label ?? null,
        })),
        shift_note: input.note ?? null,
        expected_lock_version: input.lockVersion,
      }),
    );

    throwForSupabaseError(error, 'modification du service');
    return this.requireData(data, 'Service modifié sans réponse.');
  }

  async deleteShiftService(
    accessToken: string,
    scheduleVersionId: string,
    shiftId: string,
    input: DeletePlanningAssignmentDto,
  ): Promise<Json> {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .rpc('delete_planning_shift_service', {
        target_schedule_version_id: scheduleVersionId,
        target_shift_id: shiftId,
        expected_lock_version: input.lockVersion,
      });

    throwForSupabaseError(error, 'suppression du service');
    return this.requireData(data, 'Service supprimé sans réponse.');
  }

  async moveAssignment(
    accessToken: string,
    scheduleVersionId: string,
    assignmentId: string,
    input: MovePlanningAssignmentDto,
  ): Promise<Json> {
    await this.assertLegacySingleSegmentAssignment(accessToken, assignmentId);
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .rpc('move_planning_assignment', {
        target_schedule_version_id: scheduleVersionId,
        target_assignment_id: assignmentId,
        target_work_date: input.workDate,
        target_position_id: input.positionId,
        expected_lock_version: input.lockVersion,
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
    await this.assertLegacySingleSegmentAssignment(accessToken, assignmentId);
    const { data, error } = await this.supabase.forUser(accessToken).rpc(
      'update_planning_assignment',
      nullableRpcArgs<
        'update_planning_assignment',
        'target_port_call_id' | 'shift_note'
      >({
        target_schedule_version_id: scheduleVersionId,
        target_assignment_id: assignmentId,
        target_agent_id: input.agentId,
        target_position_id: input.positionId,
        target_port_call_id: input.portCallId ?? null,
        shift_starts_at: input.startsAt,
        shift_ends_at: input.endsAt,
        shift_break_minutes: input.breakMinutes,
        shift_note: input.note ?? null,
        expected_lock_version: input.lockVersion,
      }),
    );

    throwForSupabaseError(error, 'modification de l’affectation');
    return this.requireData(data, 'Affectation modifiée sans réponse.');
  }

  async deleteAssignment(
    accessToken: string,
    scheduleVersionId: string,
    assignmentId: string,
    input: DeletePlanningAssignmentDto,
  ): Promise<Json> {
    await this.assertLegacySingleSegmentAssignment(accessToken, assignmentId);
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .rpc('delete_planning_assignment', {
        target_schedule_version_id: scheduleVersionId,
        target_assignment_id: assignmentId,
        expected_lock_version: input.lockVersion,
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
        expected_lock_version: input.lockVersion,
      });

    throwForSupabaseError(error, 'publication du planning');
    return this.requireData(data, 'Publication sans réponse.');
  }

  async listPlanningWorkforceConflicts(
    accessToken: string,
    input: ListPlanningWorkforceConflictsQuery,
  ) {
    const { data, error } = await this.supabase.forUser(accessToken).rpc(
      'get_planning_workforce_conflict_page',
      nullableRpcArgs<
        'get_planning_workforce_conflict_page',
        'range_starts_on' | 'range_ends_on'
      >({
        target_site_id: input.siteId,
        range_starts_on: input.startsOn ?? null,
        range_ends_on: input.endsOn ?? null,
        include_resolved: input.includeResolved ?? false,
        result_limit: input.limit ?? 50,
        result_offset: 0,
      }),
    );

    throwForSupabaseError(error, 'chargement des conflits RH du planning');
    return data ?? [];
  }

  async preparePlanningWorkforceConflictDraft(
    accessToken: string,
    conflictId: string,
  ): Promise<Json> {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .rpc('prepare_workforce_conflict_draft', {
        target_conflict_id: conflictId,
      });

    throwForSupabaseError(error, 'préparation du brouillon de correction');
    return this.requireData(data, 'Brouillon préparé sans réponse.');
  }

  async resolvePlanningWorkforceConflict(
    accessToken: string,
    conflictId: string,
    input: ResolvePlanningWorkforceConflictDto,
  ): Promise<Json> {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .rpc('resolve_planning_workforce_conflict', {
        target_conflict_id: conflictId,
        resolution_reason: input.reason,
      });

    throwForSupabaseError(error, 'résolution du conflit RH du planning');
    return this.requireData(data, 'Conflit résolu sans réponse.');
  }

  async listReplanningScenarios(
    accessToken: string,
    input: ListReplanningScenariosQuery,
  ): Promise<ReplanningScenarioPage> {
    const client = this.supabase.forUser(accessToken);
    const requestedPage = input.page ?? 1;
    const pageSize = input.pageSize ?? 20;
    const search = input.q?.trim();
    const pageQuery = (page: number) => {
      let query = client
        .from('replanning_scenarios')
        .select('*', { count: 'exact' })
        .eq('site_id', input.siteId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (input.status) query = query.eq('status', input.status);
      if (input.baseScheduleVersionIds?.length) {
        query = query.in(
          'base_schedule_version_id',
          input.baseScheduleVersionIds,
        );
      }
      if (search) {
        const term = `%${search
          .replaceAll('\\', '\\\\')
          .replaceAll('"', '\\"')
          .replaceAll('%', '\\%')
          .replaceAll('_', '\\_')
          .replaceAll('*', '\\*')}%`;
        query = query.or(`title.ilike."${term}",summary.ilike."${term}"`);
      }

      return query;
    };

    const initialPage = await pageQuery(requestedPage);
    throwForSupabaseError(initialPage.error, 'chargement des scénarios');
    const total = initialPage.count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, totalPages);
    let items = initialPage.data ?? [];

    if (page !== requestedPage) {
      const resolvedPage = await pageQuery(page);
      throwForSupabaseError(resolvedPage.error, 'chargement des scénarios');
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

  async rejectReplanningScenario(
    accessToken: string,
    scenarioId: string,
    input: RejectReplanningScenarioDto,
  ): Promise<Json> {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .rpc('reject_replanning_scenario', {
        target_scenario_id: scenarioId,
        rejection_reason: input.reason,
      });

    throwForSupabaseError(error, 'rejet de la replanification');
    return this.requireData(data, 'Rejet sans réponse.');
  }

  private requireData<T>(data: T | null, message: string): T {
    if (!data) {
      throw new ServiceUnavailableException(message);
    }

    return data;
  }

  private async listExportAgents(
    accessToken: string,
    organizationId: string,
    siteId: string,
  ): Promise<Agent[]> {
    const pageSize = 500;
    const agents: Agent[] = [];

    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await this.supabase
        .forUser(accessToken)
        .from('agents')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('primary_site_id', siteId)
        .order('display_name')
        .order('id')
        .range(offset, offset + pageSize - 1);

      throwForSupabaseError(error, 'chargement des agents pour export');
      agents.push(...(data ?? []));
      this.assertExportLimit('agents', agents.length, EXPORT_LIMITS.agents);
      if ((data?.length ?? 0) < pageSize) return agents;
    }
  }

  private async listScheduleRequirements(
    accessToken: string,
    scheduleVersionId: string,
  ): Promise<ScheduleRequirement[]> {
    const pageSize = 500;
    const requirements: ScheduleRequirement[] = [];
    const client = this.supabase.forUser(accessToken);

    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await client
        .rpc('get_schedule_requirements', {
          target_schedule_version_id: scheduleVersionId,
        })
        .order('starts_at')
        .order('id')
        .range(offset, offset + pageSize - 1);

      throwForSupabaseError(error, 'chargement des besoins du planning');
      requirements.push(...(data ?? []));
      this.assertExportLimit(
        'besoins',
        requirements.length,
        EXPORT_LIMITS.requirements,
      );
      if ((data?.length ?? 0) < pageSize) return requirements;
    }
  }

  private async listExportPositions(
    accessToken: string,
    organizationId: string,
    siteId: string,
  ): Promise<Position[]> {
    const pageSize = 500;
    const positions: Position[] = [];

    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await this.supabase
        .forUser(accessToken)
        .from('positions')
        .select('*')
        .eq('organization_id', organizationId)
        .or(`site_id.is.null,site_id.eq.${siteId}`)
        .order('code')
        .order('id')
        .range(offset, offset + pageSize - 1);

      throwForSupabaseError(error, 'chargement des postes pour export');
      positions.push(...(data ?? []));
      this.assertExportLimit(
        'postes',
        positions.length,
        EXPORT_LIMITS.positions,
      );
      if ((data?.length ?? 0) < pageSize) return positions;
    }
  }

  private async listExportPortCalls(
    accessToken: string,
    organizationId: string,
    siteId: string,
    period: Pick<PlanningPeriod, 'starts_on' | 'ends_on'>,
    referencedCallIds: string[],
  ): Promise<PortCall[]> {
    const pageSize = 500;
    const calls = new Map<string, PortCall>();
    const rangeStart = `${addDays(period.starts_on, -1)}T00:00:00.000Z`;
    const rangeEnd = `${addDays(period.ends_on, 2)}T23:59:59.999Z`;
    const overlapsPeriod = [
      `and(scheduled_arrival_at.lte.${rangeEnd},scheduled_departure_at.gte.${rangeStart})`,
      `and(scheduled_arrival_at.gte.${rangeStart},scheduled_arrival_at.lte.${rangeEnd})`,
      `and(scheduled_departure_at.gte.${rangeStart},scheduled_departure_at.lte.${rangeEnd})`,
    ].join(',');

    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await this.supabase
        .forUser(accessToken)
        .from('port_calls')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('site_id', siteId)
        .or(overlapsPeriod)
        .order('scheduled_arrival_at', { nullsFirst: false })
        .order('id')
        .range(offset, offset + pageSize - 1);

      throwForSupabaseError(error, 'chargement des escales pour export');
      for (const call of data ?? []) calls.set(call.id, call);
      this.assertExportLimit('escales', calls.size, EXPORT_LIMITS.portCalls);
      if ((data?.length ?? 0) < pageSize) break;
    }

    const missingIds = [...new Set(referencedCallIds)].filter(
      (id) => !calls.has(id),
    );
    for (let offset = 0; offset < missingIds.length; offset += 100) {
      const { data, error } = await this.supabase
        .forUser(accessToken)
        .from('port_calls')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('site_id', siteId)
        .in('id', missingIds.slice(offset, offset + 100));

      throwForSupabaseError(error, 'chargement des escales liées pour export');
      for (const call of data ?? []) calls.set(call.id, call);
      this.assertExportLimit('escales', calls.size, EXPORT_LIMITS.portCalls);
    }

    return [...calls.values()].sort((left, right) =>
      (left.scheduled_arrival_at ?? '').localeCompare(
        right.scheduled_arrival_at ?? '',
      ),
    );
  }

  private async listLatestForecasts(
    accessToken: string,
    callIds: string[],
  ): Promise<CallLoadForecast[]> {
    const forecasts: CallLoadForecast[] = [];
    const uniqueIds = [...new Set(callIds)];

    for (let offset = 0; offset < uniqueIds.length; offset += 500) {
      const { data, error } = await this.supabase
        .forUser(accessToken)
        .rpc('get_latest_call_load_forecasts', {
          target_port_call_ids: uniqueIds.slice(offset, offset + 500),
        });

      throwForSupabaseError(error, 'chargement des prévisions pour export');
      forecasts.push(...(data ?? []));
    }

    return forecasts;
  }

  private requireScheduleContent(data: Json | null): ScheduleContent {
    if (!data || Array.isArray(data) || typeof data !== 'object') {
      throw new ServiceUnavailableException('Planning chargé sans réponse.');
    }

    const content = data as Record<string, Json | undefined>;
    if (
      !content.version ||
      !content.period ||
      !Array.isArray(content.shifts) ||
      !Array.isArray(content.assignments) ||
      !Array.isArray(content.breaks)
    ) {
      throw new ServiceUnavailableException('Réponse de planning incomplète.');
    }

    return data as unknown as ScheduleContent;
  }

  private assertExportLimit(label: string, count: number, limit: number): void {
    if (count > limit) {
      throw new PayloadTooLargeException(
        `L’export contient trop de ${label} (${count}, maximum ${limit}). Réduisez la période ou le périmètre.`,
      );
    }
  }

  private async assertLegacySingleSegmentAssignment(
    accessToken: string,
    assignmentId: string,
  ): Promise<void> {
    const client = this.supabase.forUser(accessToken);
    const assignment = await client
      .from('shift_assignments')
      .select('planning_shift_id')
      .eq('id', assignmentId)
      .single();

    throwForSupabaseError(
      assignment.error,
      'vérification de l’affectation à modifier',
    );
    const planningShiftId = assignment.data?.planning_shift_id;
    if (!planningShiftId) return;

    const segments = await client
      .from('shift_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('planning_shift_id', planningShiftId);

    throwForSupabaseError(
      segments.error,
      'vérification des segments du service',
    );
    if ((segments.count ?? 0) > 1) {
      throw new ConflictException(
        'Ce service contient plusieurs postes. Modifiez ou supprimez le service complet depuis l’éditeur.',
      );
    }
  }
}

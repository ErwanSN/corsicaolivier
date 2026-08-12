import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Throttle } from '@nestjs/throttler';

import type { AuthIdentity } from '../auth/auth-context';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { RequireRoles } from '../auth/require-roles.decorator';
import { requireAuth } from '../common/require-auth';
import {
  ApproveReplanningScenarioDto,
  CreatePlanningShiftDto,
  DeletePlanningAssignmentDto,
  ExportPlanningWeekQuery,
  ListPlanningPeriodsQuery,
  ListPlanningWorkforceConflictsQuery,
  ListReplanningScenariosQuery,
  ListScheduleVersionsQuery,
  MovePlanningAssignmentDto,
  PublishScheduleDto,
  RejectReplanningScenarioDto,
  ResolvePlanningWorkforceConflictDto,
  SavePlanningShiftServiceDto,
  UpdatePlanningAssignmentDto,
} from './planning.dto';
import { PlanningService } from './planning.service';

@Controller()
export class PlanningController {
  constructor(private readonly planning: PlanningService) {}

  @Get('planning-periods')
  listPeriods(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Query() query: ListPlanningPeriodsQuery,
  ) {
    return this.planning.listPeriods(
      requireAuth(auth).accessToken,
      query.siteId,
      query.startsOn,
      query.endsOn,
    );
  }

  @Get('schedule-versions')
  listVersions(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Query() query: ListScheduleVersionsQuery,
  ) {
    return this.planning.listVersions(
      requireAuth(auth).accessToken,
      query.planningPeriodId,
    );
  }

  @Get('schedule-versions/:id')
  getSchedule(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) scheduleVersionId: string,
  ) {
    return this.planning.getSchedule(
      requireAuth(auth).accessToken,
      scheduleVersionId,
    );
  }

  @Get('schedule-versions/:id/requirements')
  getScheduleRequirements(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) scheduleVersionId: string,
  ) {
    return this.planning.getScheduleRequirements(
      requireAuth(auth).accessToken,
      scheduleVersionId,
    );
  }

  @Get('schedule-versions/:id/export.xlsx')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  async exportSchedule(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) scheduleVersionId: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const file = await this.planning.exportSchedule(
      requireAuth(auth).accessToken,
      scheduleVersionId,
    );

    void reply
      .header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      .header('Content-Disposition', `attachment; filename="${file.fileName}"`)
      .header('Cache-Control', 'private, no-store')
      .send(file.buffer);
  }

  @Get('planning/export.xlsx')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  async exportWeek(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Query() query: ExportPlanningWeekQuery,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const file = await this.planning.exportWeek(
      requireAuth(auth).accessToken,
      query.siteId,
      query.weekStart,
    );

    void reply
      .header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      .header('Content-Disposition', `attachment; filename="${file.fileName}"`)
      .header('Cache-Control', 'private, no-store')
      .send(file.buffer);
  }

  @Post('schedule-versions/:id/shifts')
  @RequireRoles('platform_admin', 'planning_admin', 'planner')
  createShift(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) scheduleVersionId: string,
    @Body() input: CreatePlanningShiftDto,
  ) {
    return this.planning.createShift(
      requireAuth(auth).accessToken,
      scheduleVersionId,
      input,
    );
  }

  @Post('schedule-versions/:id/services')
  @RequireRoles('platform_admin', 'planning_admin', 'planner')
  createShiftService(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) scheduleVersionId: string,
    @Body() input: SavePlanningShiftServiceDto,
  ) {
    return this.planning.createShiftService(
      requireAuth(auth).accessToken,
      scheduleVersionId,
      input,
    );
  }

  @Patch('schedule-versions/:id/shifts/:shiftId')
  @RequireRoles('platform_admin', 'planning_admin', 'planner')
  updateShiftService(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) scheduleVersionId: string,
    @Param('shiftId', ParseUUIDPipe) shiftId: string,
    @Body() input: SavePlanningShiftServiceDto,
  ) {
    return this.planning.updateShiftService(
      requireAuth(auth).accessToken,
      scheduleVersionId,
      shiftId,
      input,
    );
  }

  @Delete('schedule-versions/:id/shifts/:shiftId')
  @RequireRoles('platform_admin', 'planning_admin', 'planner')
  deleteShiftService(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) scheduleVersionId: string,
    @Param('shiftId', ParseUUIDPipe) shiftId: string,
    @Body() input: DeletePlanningAssignmentDto,
  ) {
    return this.planning.deleteShiftService(
      requireAuth(auth).accessToken,
      scheduleVersionId,
      shiftId,
      input,
    );
  }

  @Patch('schedule-versions/:id/assignments/:assignmentId')
  @RequireRoles('platform_admin', 'planning_admin', 'planner')
  moveAssignment(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) scheduleVersionId: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() input: MovePlanningAssignmentDto,
  ) {
    return this.planning.moveAssignment(
      requireAuth(auth).accessToken,
      scheduleVersionId,
      assignmentId,
      input,
    );
  }

  @Patch('schedule-versions/:id/assignments/:assignmentId/details')
  @RequireRoles('platform_admin', 'planning_admin', 'planner')
  updateAssignment(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) scheduleVersionId: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() input: UpdatePlanningAssignmentDto,
  ) {
    return this.planning.updateAssignment(
      requireAuth(auth).accessToken,
      scheduleVersionId,
      assignmentId,
      input,
    );
  }

  @Delete('schedule-versions/:id/assignments/:assignmentId')
  @RequireRoles('platform_admin', 'planning_admin', 'planner')
  deleteAssignment(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) scheduleVersionId: string,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() input: DeletePlanningAssignmentDto,
  ) {
    return this.planning.deleteAssignment(
      requireAuth(auth).accessToken,
      scheduleVersionId,
      assignmentId,
      input,
    );
  }

  @Post('schedule-versions/:id/publish')
  @RequireRoles('platform_admin', 'planning_admin', 'approver')
  publish(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) scheduleVersionId: string,
    @Body() input: PublishScheduleDto,
  ) {
    return this.planning.publish(requireAuth(auth), scheduleVersionId, input);
  }

  @Get('planning-workforce-conflicts')
  listPlanningWorkforceConflicts(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Query() query: ListPlanningWorkforceConflictsQuery,
  ) {
    return this.planning.listPlanningWorkforceConflicts(
      requireAuth(auth).accessToken,
      query,
    );
  }

  @Post('planning-workforce-conflicts/:id/draft')
  @RequireRoles('platform_admin', 'planning_admin', 'planner')
  preparePlanningWorkforceConflictDraft(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) conflictId: string,
  ) {
    return this.planning.preparePlanningWorkforceConflictDraft(
      requireAuth(auth).accessToken,
      conflictId,
    );
  }

  @Post('planning-workforce-conflicts/:id/resolve')
  @RequireRoles('platform_admin', 'planning_admin', 'planner', 'approver', 'hr')
  resolvePlanningWorkforceConflict(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) conflictId: string,
    @Body() input: ResolvePlanningWorkforceConflictDto,
  ) {
    return this.planning.resolvePlanningWorkforceConflict(
      requireAuth(auth).accessToken,
      conflictId,
      input,
    );
  }

  @Get('replanning-scenarios')
  listReplanningScenarios(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Query() query: ListReplanningScenariosQuery,
  ) {
    return this.planning.listReplanningScenarios(
      requireAuth(auth).accessToken,
      query,
    );
  }

  @Get('replanning-scenarios/:id')
  getReplanningScenario(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) scenarioId: string,
  ) {
    return this.planning.getReplanningScenario(
      requireAuth(auth).accessToken,
      scenarioId,
    );
  }

  @Post('replanning-scenarios/:id/approve')
  @RequireRoles('platform_admin', 'planning_admin', 'approver')
  approveReplanningScenario(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) scenarioId: string,
    @Body() input: ApproveReplanningScenarioDto,
  ) {
    return this.planning.approveReplanningScenario(
      requireAuth(auth).accessToken,
      scenarioId,
      input,
    );
  }

  @Post('replanning-scenarios/:id/reject')
  @RequireRoles('platform_admin', 'planning_admin', 'approver')
  rejectReplanningScenario(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) scenarioId: string,
    @Body() input: RejectReplanningScenarioDto,
  ) {
    return this.planning.rejectReplanningScenario(
      requireAuth(auth).accessToken,
      scenarioId,
      input,
    );
  }
}

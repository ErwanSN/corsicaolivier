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

import type { AuthIdentity } from '../auth/auth-context';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { RequireRoles } from '../auth/require-roles.decorator';
import { requireAuth } from '../common/require-auth';
import {
  ApproveReplanningScenarioDto,
  CreatePlanningShiftDto,
  ListPlanningPeriodsQuery,
  ListReplanningScenariosQuery,
  ListScheduleVersionsQuery,
  MovePlanningAssignmentDto,
  PublishScheduleDto,
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

  @Get('schedule-versions/:id/export.xlsx')
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
  ) {
    return this.planning.deleteAssignment(
      requireAuth(auth).accessToken,
      scheduleVersionId,
      assignmentId,
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

  @Get('replanning-scenarios')
  listReplanningScenarios(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Query() query: ListReplanningScenariosQuery,
  ) {
    return this.planning.listReplanningScenarios(
      requireAuth(auth).accessToken,
      query.siteId,
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
}

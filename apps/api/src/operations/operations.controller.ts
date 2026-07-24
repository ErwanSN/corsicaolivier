import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';

import type { AuthIdentity } from '../auth/auth-context';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { RequireRoles } from '../auth/require-roles.decorator';
import { requireAuth } from '../common/require-auth';
import {
  CreateDemandProfileDto,
  CreateDemandProfileLineDto,
  CreateLoadForecastDto,
  CreateSkillDto,
  CreateVesselDto,
  OrganizationQuery,
  PlanningPeriodQuery,
  PortCallQuery,
  SiteQuery,
} from './operations.dto';
import { OperationsService } from './operations.service';

@Controller()
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get('skills')
  listSkills(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Query() query: OrganizationQuery,
  ) {
    return this.operations.listSkills(
      requireAuth(auth).accessToken,
      query.organizationId,
    );
  }

  @Post('skills')
  @RequireRoles('platform_admin', 'planning_admin', 'hr')
  createSkill(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Body() input: CreateSkillDto,
  ) {
    return this.operations.createSkill(requireAuth(auth).accessToken, input);
  }

  @Get('vessels')
  listVessels(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Query() query: OrganizationQuery,
  ) {
    return this.operations.listVessels(
      requireAuth(auth).accessToken,
      query.organizationId,
    );
  }

  @Post('vessels')
  @RequireRoles('platform_admin', 'planning_admin')
  createVessel(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Body() input: CreateVesselDto,
  ) {
    return this.operations.createVessel(requireAuth(auth).accessToken, input);
  }

  @Get('load-forecasts')
  listLoadForecasts(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Query() query: PortCallQuery,
  ) {
    return this.operations.listLoadForecasts(
      requireAuth(auth).accessToken,
      query.portCallId,
    );
  }

  @Post('load-forecasts')
  @RequireRoles('platform_admin', 'planning_admin', 'planner')
  createLoadForecast(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Body() input: CreateLoadForecastDto,
  ) {
    return this.operations.createLoadForecast(
      requireAuth(auth).accessToken,
      input,
    );
  }

  @Get('demand-profiles')
  listDemandProfiles(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Query() query: SiteQuery,
  ) {
    return this.operations.listDemandProfiles(
      requireAuth(auth).accessToken,
      query.siteId,
    );
  }

  @Post('demand-profiles')
  @RequireRoles('platform_admin', 'planning_admin', 'planner')
  createDemandProfile(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Body() input: CreateDemandProfileDto,
  ) {
    return this.operations.createDemandProfile(
      requireAuth(auth).accessToken,
      input,
    );
  }

  @Post('demand-profiles/:id/lines')
  @RequireRoles('platform_admin', 'planning_admin', 'planner')
  addDemandProfileLine(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) profileId: string,
    @Body() input: CreateDemandProfileLineDto,
  ) {
    return this.operations.addDemandProfileLine(
      requireAuth(auth).accessToken,
      profileId,
      input,
    );
  }

  @Get('demand-profiles/:id/lines')
  listDemandProfileLines(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) profileId: string,
  ) {
    return this.operations.listDemandProfileLines(
      requireAuth(auth).accessToken,
      profileId,
    );
  }

  @Get('staffing-requirements')
  listRequirements(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Query() query: PlanningPeriodQuery,
  ) {
    return this.operations.listRequirements(
      requireAuth(auth).accessToken,
      query.planningPeriodId,
    );
  }
}

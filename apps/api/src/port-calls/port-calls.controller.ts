import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import type { AuthIdentity } from '../auth/auth-context';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { RequireRoles } from '../auth/require-roles.decorator';
import { requireAuth } from '../common/require-auth';
import {
  CreatePortCallDto,
  ListPortCallsQuery,
  SearchPortCallsQuery,
  SetDemandProfileDto,
  UpdatePortCallTimingDto,
} from './port-call.dto';
import { PortCallsService } from './port-calls.service';

@Controller('port-calls')
export class PortCallsController {
  constructor(private readonly portCalls: PortCallsService) {}

  @Get()
  list(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Query() query: ListPortCallsQuery,
  ) {
    return this.portCalls.list(requireAuth(auth).accessToken, query);
  }

  @Get('search')
  search(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Query() query: SearchPortCallsQuery,
  ) {
    return this.portCalls.search(requireAuth(auth).accessToken, query);
  }

  @Post()
  @RequireRoles('platform_admin', 'planning_admin', 'planner')
  create(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Body() input: CreatePortCallDto,
  ) {
    return this.portCalls.create(requireAuth(auth).accessToken, input);
  }

  @Patch(':id/timing')
  @RequireRoles('platform_admin', 'planning_admin', 'approver')
  updateTiming(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdatePortCallTimingDto,
  ) {
    return this.portCalls.updateTiming(
      requireAuth(auth).accessToken,
      id,
      input,
    );
  }

  @Patch(':id/demand-profile')
  @RequireRoles('platform_admin', 'planning_admin', 'planner')
  setDemandProfile(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SetDemandProfileDto,
  ) {
    return this.portCalls.setDemandProfile(
      requireAuth(auth).accessToken,
      id,
      input,
    );
  }
}

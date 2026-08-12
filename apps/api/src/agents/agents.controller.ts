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
  CreateAgentDto,
  ListAgentsQuery,
  ReactivateAgentDto,
  RetryAgentOffboardingDto,
  SearchAgentsQuery,
  UpdateAgentDto,
} from './agent.dto';
import { AgentsService } from './agents.service';

@Controller('agents')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get()
  list(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Query() query: ListAgentsQuery,
  ) {
    return this.agents.list(
      requireAuth(auth).accessToken,
      query.siteId,
      query.organizationId,
    );
  }

  @Get('search')
  search(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Query() query: SearchAgentsQuery,
  ) {
    return this.agents.search(requireAuth(auth).accessToken, query);
  }

  @Get(':id')
  get(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) agentId: string,
  ) {
    return this.agents.get(requireAuth(auth).accessToken, agentId);
  }

  @Post()
  @RequireRoles('platform_admin', 'planning_admin', 'hr')
  create(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Body() input: CreateAgentDto,
  ) {
    return this.agents.create(requireAuth(auth).accessToken, input);
  }

  @Patch(':id')
  @RequireRoles('platform_admin', 'planning_admin', 'hr')
  update(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) agentId: string,
    @Body() input: UpdateAgentDto,
  ) {
    return this.agents.update(requireAuth(auth).accessToken, agentId, input);
  }

  @Post(':id/reactivate')
  @RequireRoles('platform_admin', 'planning_admin', 'hr')
  reactivate(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) agentId: string,
    @Body() input: ReactivateAgentDto,
  ) {
    return this.agents.reactivate(
      requireAuth(auth).accessToken,
      agentId,
      input.organizationId,
      input.reason,
    );
  }

  @Get(':id/offboarding-plan')
  @RequireRoles('platform_admin', 'planning_admin', 'hr', 'auditor')
  getOffboardingPlan(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) agentId: string,
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    return this.agents.getOffboardingPlan(
      requireAuth(auth).accessToken,
      agentId,
      organizationId,
    );
  }

  @Post(':id/offboarding-plan/retry')
  @RequireRoles('platform_admin', 'planning_admin', 'hr')
  retryOffboarding(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) agentId: string,
    @Body() input: RetryAgentOffboardingDto,
  ) {
    return this.agents.retryOffboarding(
      requireAuth(auth).accessToken,
      agentId,
      input.organizationId,
      input.reason,
    );
  }
}

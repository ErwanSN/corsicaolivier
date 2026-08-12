import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import type { AuthIdentity } from '../auth/auth-context';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { RequireRoles } from '../auth/require-roles.decorator';
import { requireAuth } from '../common/require-auth';
import {
  AddGroupMemberDto,
  CreateAgentUnavailabilityDto,
  CreateGroupDto,
  EndAgentUnavailabilityDto,
  EndGroupMembershipDto,
  GetHourBalanceQuery,
  ListAgentUnavailabilityQuery,
  ListGroupsQuery,
  ListHourTargetsQuery,
  SetAgentContractDto,
  SetAgentSkillDto,
  SetGroupHourTargetsDto,
  SetHourTargetDto,
  SetPositionPreferenceDto,
  SetPositionRestrictionDto,
  SetPositionSkillRequirementDto,
} from './workforce.dto';
import { WorkforceService } from './workforce.service';

@Controller()
export class WorkforceController {
  constructor(private readonly workforce: WorkforceService) {}

  @Get('groups')
  listGroups(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Query() query: ListGroupsQuery,
  ) {
    return this.workforce.listGroups(
      requireAuth(auth).accessToken,
      query.siteId,
    );
  }

  @Post('groups')
  @RequireRoles('platform_admin', 'planning_admin', 'planner', 'hr')
  createGroup(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Body() input: CreateGroupDto,
  ) {
    return this.workforce.createGroup(requireAuth(auth).accessToken, input);
  }

  @Get('groups/:id/members')
  listGroupMembers(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) groupId: string,
  ) {
    return this.workforce.listGroupMembers(
      requireAuth(auth).accessToken,
      groupId,
    );
  }

  @Get('hour-targets')
  listHourTargets(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Query() query: ListHourTargetsQuery,
  ) {
    return this.workforce.listHourTargets(
      requireAuth(auth).accessToken,
      query.siteId,
      query.weekStart,
    );
  }

  @Get('agents/:id/rules')
  listAgentRules(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) agentId: string,
  ) {
    return this.workforce.listAgentRules(
      requireAuth(auth).accessToken,
      agentId,
    );
  }

  @Post('agents/:id/contracts')
  @RequireRoles('platform_admin', 'planning_admin', 'hr')
  setAgentContract(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) agentId: string,
    @Body() input: SetAgentContractDto,
  ) {
    return this.workforce.setAgentContract(
      requireAuth(auth).accessToken,
      agentId,
      input,
    );
  }

  @Post('groups/:id/members')
  @RequireRoles('platform_admin', 'planning_admin', 'planner', 'hr')
  addMember(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) groupId: string,
    @Body() input: AddGroupMemberDto,
  ) {
    return this.workforce.addMember(
      requireAuth(auth).accessToken,
      groupId,
      input,
    );
  }

  @Patch('groups/:groupId/members/:membershipId')
  @RequireRoles('platform_admin', 'planning_admin', 'planner', 'hr')
  endMembership(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Body() input: EndGroupMembershipDto,
  ) {
    return this.workforce.endMembership(
      requireAuth(auth).accessToken,
      groupId,
      membershipId,
      input,
    );
  }

  @Put('groups/:id/hour-targets')
  @RequireRoles('platform_admin', 'planning_admin', 'planner', 'hr')
  setGroupHourTargets(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) groupId: string,
    @Body() input: SetGroupHourTargetsDto,
  ) {
    return this.workforce.setGroupHourTargets(
      requireAuth(auth).accessToken,
      groupId,
      input,
    );
  }

  @Put('hour-targets')
  @RequireRoles('platform_admin', 'planning_admin', 'planner', 'hr')
  setHourTarget(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Body() input: SetHourTargetDto,
  ) {
    return this.workforce.setHourTarget(requireAuth(auth), input);
  }

  @Get('hour-balances')
  getHourBalance(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Query() query: GetHourBalanceQuery,
  ) {
    return this.workforce.getHourBalance(
      requireAuth(auth).accessToken,
      query.agentId,
      query.weekStart,
      query.scheduleVersionId,
    );
  }

  @Post('agents/:id/position-preferences')
  @RequireRoles('platform_admin', 'planning_admin', 'planner', 'hr')
  setPreference(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) agentId: string,
    @Body() input: SetPositionPreferenceDto,
  ) {
    return this.workforce.setPreference(requireAuth(auth), agentId, input);
  }

  @Post('agents/:id/position-restrictions')
  @RequireRoles('platform_admin', 'planning_admin', 'hr')
  setRestriction(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) agentId: string,
    @Body() input: SetPositionRestrictionDto,
  ) {
    return this.workforce.setRestriction(requireAuth(auth), agentId, input);
  }

  @Get('agents/:id/skills')
  listAgentSkills(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) agentId: string,
  ) {
    return this.workforce.listAgentSkills(
      requireAuth(auth).accessToken,
      agentId,
    );
  }

  @Post('agents/:id/skills')
  @RequireRoles('platform_admin', 'planning_admin', 'hr')
  setAgentSkill(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) agentId: string,
    @Body() input: SetAgentSkillDto,
  ) {
    return this.workforce.setAgentSkill(requireAuth(auth), agentId, input);
  }

  @Get('agents/:id/unavailability')
  listAgentUnavailability(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) agentId: string,
    @Query() query: ListAgentUnavailabilityQuery,
  ) {
    return this.workforce.listAgentUnavailability(
      requireAuth(auth).accessToken,
      agentId,
      query,
    );
  }

  @Post('agents/:id/unavailability')
  @RequireRoles('platform_admin', 'planning_admin', 'planner', 'hr')
  createAgentUnavailability(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) agentId: string,
    @Body() input: CreateAgentUnavailabilityDto,
  ) {
    return this.workforce.createAgentUnavailability(
      requireAuth(auth),
      agentId,
      input,
    );
  }

  @Patch('agents/:id/unavailability/:unavailabilityId/end')
  @RequireRoles('platform_admin', 'planning_admin', 'planner', 'hr')
  endAgentUnavailability(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) agentId: string,
    @Param('unavailabilityId', ParseUUIDPipe) unavailabilityId: string,
    @Body() input: EndAgentUnavailabilityDto,
  ) {
    return this.workforce.endAgentUnavailability(
      requireAuth(auth).accessToken,
      agentId,
      unavailabilityId,
      input,
    );
  }

  @Get('positions/:id/skills')
  listPositionSkills(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) positionId: string,
  ) {
    return this.workforce.listPositionSkills(
      requireAuth(auth).accessToken,
      positionId,
    );
  }

  @Post('positions/:id/skills')
  @RequireRoles('platform_admin', 'planning_admin')
  setPositionSkill(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('id', ParseUUIDPipe) positionId: string,
    @Body() input: SetPositionSkillRequirementDto,
  ) {
    return this.workforce.setPositionSkill(
      requireAuth(auth).accessToken,
      positionId,
      input,
    );
  }
}

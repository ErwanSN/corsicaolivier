import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import type { AuthIdentity } from '../auth/auth-context';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { RequireRoles } from '../auth/require-roles.decorator';
import { requireAuth } from '../common/require-auth';
import { CreatePositionDto, ListPositionsQuery } from './position.dto';
import { PositionsService } from './positions.service';

@Controller('positions')
export class PositionsController {
  constructor(private readonly positions: PositionsService) {}

  @Get()
  list(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Query() query: ListPositionsQuery,
  ) {
    return this.positions.list(
      requireAuth(auth).accessToken,
      query.organizationId,
      query.siteId,
      query.page,
      query.pageSize,
      query.q,
    );
  }

  @Post()
  @RequireRoles('platform_admin', 'planning_admin', 'planner', 'hr')
  create(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Body() input: CreatePositionDto,
  ) {
    return this.positions.create(requireAuth(auth).accessToken, input);
  }
}

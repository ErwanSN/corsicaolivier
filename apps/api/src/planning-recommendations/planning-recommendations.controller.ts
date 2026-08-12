import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';

import type { AuthIdentity } from '../auth/auth-context';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { RequireRoles } from '../auth/require-roles.decorator';
import { requireAuth } from '../common/require-auth';
import { FindPlanningCandidatesDto } from './planning-recommendations.dto';
import { PlanningRecommendationsService } from './planning-recommendations.service';

@Controller('schedule-versions/:scheduleVersionId/agent-candidates')
export class PlanningRecommendationsController {
  constructor(
    private readonly recommendations: PlanningRecommendationsService,
  ) {}

  @Post('query')
  @RequireRoles('platform_admin', 'planning_admin', 'planner')
  findCandidates(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Param('scheduleVersionId', ParseUUIDPipe) scheduleVersionId: string,
    @Body() input: FindPlanningCandidatesDto,
  ) {
    return this.recommendations.findCandidates(
      requireAuth(auth).accessToken,
      scheduleVersionId,
      input,
    );
  }
}

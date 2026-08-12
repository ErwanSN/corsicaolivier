import { Module } from '@nestjs/common';

import { PlanningRecommendationsController } from './planning-recommendations.controller';
import { PlanningRecommendationsService } from './planning-recommendations.service';

@Module({
  controllers: [PlanningRecommendationsController],
  providers: [PlanningRecommendationsService],
})
export class PlanningRecommendationsModule {}

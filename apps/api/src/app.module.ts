import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AgentsModule } from './agents/agents.module';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { IdentityThrottlerGuard } from './common/identity-throttler.guard';
import { PreAuthThrottlerGuard } from './common/pre-auth-throttler.guard';
import { environment } from './config/environment';
import { validateEnvironment } from './config/validate-environment';
import { SupabaseModule } from './database/supabase.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OperationsModule } from './operations/operations.module';
import { PlanningModule } from './planning/planning.module';
import { PlanningRecommendationsModule } from './planning-recommendations/planning-recommendations.module';
import { PositionsModule } from './positions/positions.module';
import { PortCallsModule } from './port-calls/port-calls.module';
import { SitesModule } from './sites/sites.module';
import { WorkforceModule } from './workforce/workforce.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      expandVariables: false,
      isGlobal: true,
      load: [environment],
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRoot([
      {
        name: 'preauth',
        ttl: 60_000,
        limit: 1_800,
      },
      {
        name: 'default',
        ttl: 60_000,
        limit: 120,
      },
    ]),
    SupabaseModule,
    AuthModule,
    HealthModule,
    NotificationsModule,
    SitesModule,
    AgentsModule,
    PositionsModule,
    PortCallsModule,
    WorkforceModule,
    PlanningModule,
    PlanningRecommendationsModule,
    OperationsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: PreAuthThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: IdentityThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

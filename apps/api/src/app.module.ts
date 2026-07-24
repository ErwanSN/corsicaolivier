import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AgentsModule } from './agents/agents.module';
import { AuthModule } from './auth/auth.module';
import { environment } from './config/environment';
import { validateEnvironment } from './config/validate-environment';
import { SupabaseModule } from './database/supabase.module';
import { HealthModule } from './health/health.module';
import { OperationsModule } from './operations/operations.module';
import { PlanningModule } from './planning/planning.module';
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
        ttl: 60_000,
        limit: 120,
      },
    ]),
    SupabaseModule,
    AuthModule,
    HealthModule,
    SitesModule,
    AgentsModule,
    PositionsModule,
    PortCallsModule,
    WorkforceModule,
    PlanningModule,
    OperationsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

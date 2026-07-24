import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AuthModule } from "./auth/auth.module";
import { BookingsModule } from "./bookings/bookings.module";
import { ControlsModule } from "./controls/controls.module";
import { DatabaseModule } from "./database/database.module";
import { DossiersModule } from "./dossiers/dossiers.module";
import { HealthModule } from "./health/health.module";
import { MetricsModule } from "./metrics/metrics.module";
import { PortMapModule } from "./port-map/port-map.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true
    }),
    DatabaseModule,
    BookingsModule,
    ControlsModule,
    DossiersModule,
    AuthModule,
    HealthModule,
    MetricsModule,
    PortMapModule
  ]
})
export class AppModule {}

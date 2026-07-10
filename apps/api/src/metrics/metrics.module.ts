import { Module } from "@nestjs/common";

import { MetricsController } from "./metrics.controller";
import { MetricsGuard } from "./metrics.guard";

@Module({ controllers: [MetricsController], providers: [MetricsGuard] })
export class MetricsModule {}

import { Controller, Get, Header, UseGuards } from "@nestjs/common";

import { MetricsGuard } from "./metrics.guard";
import { metricsRegistry } from "./metrics.registry";

@Controller("metrics")
@UseGuards(MetricsGuard)
export class MetricsController {
  @Get()
  @Header("Cache-Control", "no-store")
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  getMetrics(): Promise<string> {
    return metricsRegistry.metrics();
  }
}

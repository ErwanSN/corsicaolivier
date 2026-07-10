import { Controller, Get } from "@nestjs/common";

import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check(): Promise<{ database: "reachable"; status: "ok" }> {
    return this.healthService.check();
  }
}

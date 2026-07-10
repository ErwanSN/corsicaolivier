import { Body, Controller, Get, Header, Put, UseGuards } from "@nestjs/common";
import { type PortMapConfig } from "@corsica/contracts";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { PortMapService } from "./port-map.service";

@Controller({ path: "port-map", version: "1" })
export class PortMapController {
  constructor(private readonly portMapService: PortMapService) {}

  @Get()
  @Header("Cache-Control", "public, max-age=30, stale-while-revalidate=120")
  getConfiguration(): Promise<PortMapConfig> {
    return this.portMapService.getConfiguration();
  }

  @Put()
  @Roles("ADMIN")
  @UseGuards(JwtAuthGuard, RolesGuard)
  updateConfiguration(@Body() body: unknown): Promise<PortMapConfig> {
    return this.portMapService.updateConfiguration(body);
  }
}

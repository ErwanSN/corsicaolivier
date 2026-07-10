import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import { type Dossier } from "@corsica/contracts";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { DossiersService } from "./dossiers.service";

@Controller({ path: "dossiers", version: "1" })
@Roles("EMPLOYEE", "ADMIN")
@UseGuards(JwtAuthGuard, RolesGuard)
export class DossiersController {
  constructor(private readonly dossiersService: DossiersService) {}

  @Get("search")
  search(@Query() query: Record<string, unknown>): Promise<Dossier[]> {
    return this.dossiersService.search(query);
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string): Promise<Dossier> {
    return this.dossiersService.findOne(id);
  }
}

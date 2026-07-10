import { Body, Controller, Get, Post, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import { type ControlRecord } from "@corsica/contracts";

import { type AuthenticatedRequest } from "../auth/auth.types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ControlsService } from "./controls.service";

@Controller({ path: "controls", version: "1" })
@Roles("EMPLOYEE", "ADMIN")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ControlsController {
  constructor(private readonly controlsService: ControlsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest): Promise<ControlRecord[]> {
    return this.controlsService.list(getUserId(request));
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<ControlRecord> {
    return this.controlsService.create(getUserId(request), body);
  }
}

function getUserId(request: AuthenticatedRequest): string {
  if (request.user) return request.user.id;
  throw new UnauthorizedException({
    code: "AUTH_MISSING_USER",
    message: "Session utilisateur manquante."
  });
}

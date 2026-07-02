import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { type AuthSessionDto, type AuthUserDto } from "@corsica/contracts";

import { AuthService } from "./auth.service";
import { type AuthenticatedRequest } from "./auth.types";
import { AuthCredentialsDto } from "./dto/auth-credentials.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Controller({
  path: "auth",
  version: "1"
})
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(@Body() credentials: AuthCredentialsDto): Promise<AuthSessionDto> {
    return this.authService.register(credentials);
  }

  @Post("login")
  login(@Body() credentials: AuthCredentialsDto): Promise<AuthSessionDto> {
    return this.authService.login(credentials);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@Req() request: AuthenticatedRequest): AuthUserDto {
    if (!request.user) {
      throw new Error("Authenticated request is missing user.");
    }

    return request.user;
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { type FastifyReply } from "fastify";
import {
  type AuthSessionDto,
  type AuthUserDto,
  type PasswordChangeRequestDto
} from "@corsica/contracts";

import { AuthService } from "./auth.service";
import {
  accessCookieName,
  accessTokenMaxAgeSeconds,
  refreshCookieName,
  refreshTokenMaxAgeSeconds
} from "./auth.constants";
import { AuthRateLimitGuard } from "./auth-rate-limit.guard";
import { AuthRateLimitInterceptor } from "./auth-rate-limit.interceptor";
import { type AuthenticatedRequest } from "./auth.types";
import { AuthCredentialsDto } from "./dto/auth-credentials.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { LoginCredentialsDto } from "./dto/login-credentials.dto";
import { RefreshSessionDto } from "./dto/refresh-session.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Controller({
  path: "auth",
  version: "1"
})
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  async register(
    @Body() credentials: AuthCredentialsDto,
    @Res({ passthrough: true }) reply: FastifyReply
  ): Promise<AuthSessionDto> {
    const session = await this.authService.register(credentials);
    setSessionCookies(reply, session);
    return session;
  }

  @Post("login")
  @UseGuards(AuthRateLimitGuard)
  @UseInterceptors(AuthRateLimitInterceptor)
  async login(
    @Body() credentials: LoginCredentialsDto,
    @Res({ passthrough: true }) reply: FastifyReply
  ): Promise<AuthSessionDto> {
    const session = await this.authService.login(credentials);
    setSessionCookies(reply, session);
    return session;
  }

  @Post("web/register")
  async registerWeb(
    @Body() credentials: AuthCredentialsDto,
    @Res({ passthrough: true }) reply: FastifyReply
  ): Promise<AuthUserDto> {
    const session = await this.authService.register(credentials);
    setSessionCookies(reply, session);
    return session.user;
  }

  @Post("web/login")
  @UseGuards(AuthRateLimitGuard)
  @UseInterceptors(AuthRateLimitInterceptor)
  async loginWeb(
    @Body() credentials: LoginCredentialsDto,
    @Res({ passthrough: true }) reply: FastifyReply
  ): Promise<AuthUserDto> {
    const session = await this.authService.login(credentials);
    setSessionCookies(reply, session);
    return session.user;
  }

  @Post("logout")
  @HttpCode(204)
  async logout(
    @Body() body: RefreshSessionDto | undefined,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply
  ): Promise<void> {
    await this.authService.revokeSession(
      body?.refreshToken ?? request.cookies?.[refreshCookieName]
    );
    clearSessionCookies(reply);
  }

  @Post("refresh")
  async refresh(
    @Body() body: RefreshSessionDto | undefined,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply
  ): Promise<AuthSessionDto> {
    const session = await this.authService.refreshSession(
      requireRefreshToken(body?.refreshToken ?? request.cookies?.[refreshCookieName])
    );
    setSessionCookies(reply, session);
    return session;
  }

  @Post("web/refresh")
  async refreshWeb(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply
  ): Promise<AuthUserDto> {
    const session = await this.authService.refreshSession(
      requireRefreshToken(request.cookies?.[refreshCookieName])
    );
    setSessionCookies(reply, session);
    return session.user;
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@Req() request: AuthenticatedRequest): AuthUserDto {
    if (!request.user) {
      throw new Error("Authenticated request is missing user.");
    }

    return request.user;
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard)
  updateMe(
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateProfileDto
  ): Promise<AuthUserDto> {
    if (!request.user) {
      throw new Error("Authenticated request is missing user.");
    }

    return this.authService.updateUsername(request.user.id, body.username);
  }

  @Patch("password")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() body: ChangePasswordDto,
    @Res({ passthrough: true }) reply: FastifyReply
  ): Promise<void> {
    if (!request.user) throw new Error("Authenticated request is missing user.");
    const session = await this.authService.changePassword(
      request.user.id,
      request.user.role,
      body.currentPassword,
      body.newPassword
    );
    setSessionCookies(reply, session);
  }

  @Post("password-change-requests")
  @UseGuards(JwtAuthGuard)
  requestPasswordChange(@Req() request: AuthenticatedRequest): Promise<PasswordChangeRequestDto> {
    if (!request.user) throw new Error("Authenticated request is missing user.");
    return this.authService.requestPasswordChange(request.user.id, request.user.role);
  }
}

function setSessionCookies(reply: FastifyReply, session: AuthSessionDto): void {
  const secure = process.env.NODE_ENV === "production";
  reply.setCookie(accessCookieName, session.accessToken, {
    httpOnly: true,
    maxAge: accessTokenMaxAgeSeconds,
    path: "/",
    sameSite: "strict",
    secure
  });
  reply.setCookie(refreshCookieName, session.refreshToken, {
    httpOnly: true,
    maxAge: refreshTokenMaxAgeSeconds,
    path: "/api/v1/auth",
    sameSite: "strict",
    secure
  });
}

function clearSessionCookies(reply: FastifyReply): void {
  reply.clearCookie(accessCookieName, { path: "/" });
  reply.clearCookie(refreshCookieName, { path: "/api/v1/auth" });
}

function requireRefreshToken(token: string | undefined): string {
  if (!token) {
    throw new UnauthorizedException({
      code: "AUTH_MISSING_REFRESH_TOKEN",
      message: "Session de renouvellement manquante."
    });
  }
  return token;
}

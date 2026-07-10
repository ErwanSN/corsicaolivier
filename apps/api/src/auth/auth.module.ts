import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { AuthController } from "./auth.controller";
import { AuthAttemptLimiter } from "./auth-rate-limit";
import { AuthRateLimitGuard } from "./auth-rate-limit.guard";
import { AuthRateLimitInterceptor } from "./auth-rate-limit.interceptor";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { RolesGuard } from "./roles.guard";
import { RefreshSessionService } from "./refresh-session.service";

@Module({
  controllers: [AuthController],
  exports: [JwtModule, JwtAuthGuard, RolesGuard],
  imports: [JwtModule.register({})],
  providers: [
    AuthAttemptLimiter,
    AuthRateLimitGuard,
    AuthRateLimitInterceptor,
    AuthService,
    JwtAuthGuard,
    RefreshSessionService,
    RolesGuard
  ]
})
export class AuthModule {}

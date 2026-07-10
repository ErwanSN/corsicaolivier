import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { type FastifyReply, type FastifyRequest } from "fastify";

import {
  AuthAttemptLimiter,
  authLoginRateLimitKey,
  authRateLimitException
} from "./auth-rate-limit";

export type RateLimitedRequest = FastifyRequest & { authRateLimitKey?: string };

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(private readonly limiter: AuthAttemptLimiter) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<RateLimitedRequest>();
    const key = authLoginRateLimitKey(request.ip, request.body);
    const decision = this.limiter.consume(key);
    if (decision.allowed) {
      request.authRateLimitKey = key;
      return true;
    }

    http.getResponse<FastifyReply>().header("Retry-After", String(decision.retryAfterSeconds));
    throw authRateLimitException();
  }
}

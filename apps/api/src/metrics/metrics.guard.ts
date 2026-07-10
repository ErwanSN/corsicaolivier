import { timingSafeEqual } from "node:crypto";

import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type FastifyRequest } from "fastify";

@Injectable()
export class MetricsGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expectedToken = this.configService.get<string>("METRICS_TOKEN");
    const production = this.configService.get<string>("NODE_ENV") === "production";
    if (!expectedToken && !production) return true;
    if (!expectedToken) return false;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const suppliedToken = request.headers.authorization?.replace(/^Bearer\s+/i, "");
    return suppliedToken ? tokensMatch(suppliedToken, expectedToken) : false;
  }
}

export function tokensMatch(supplied: string, expected: string): boolean {
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return (
    suppliedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(suppliedBuffer, expectedBuffer)
  );
}

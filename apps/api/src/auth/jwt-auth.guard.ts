import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

import { PrismaService } from "../database/prisma.service";
import { accessCookieName, getAuthJwtSecret } from "./auth.constants";
import { type AuthenticatedRequest, type AuthTokenPayload } from "./auth.types";
import { toAuthUser, userSelect } from "./auth.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token =
      extractBearerToken(request.headers.authorization) ?? request.cookies?.[accessCookieName];

    if (!token) {
      throw new UnauthorizedException({
        code: "AUTH_MISSING_TOKEN",
        message: "Session manquante."
      });
    }

    try {
      const payload = await this.jwtService.verifyAsync<AuthTokenPayload>(token, {
        secret: getAuthJwtSecret(this.configService)
      });
      const user = await this.prisma.user.findUnique({
        select: userSelect,
        where: {
          id: payload.sub
        }
      });

      const session = await this.prisma.refreshSession.findFirst({
        select: { id: true },
        where: {
          expiresAt: { gt: new Date() },
          id: payload.sessionId,
          revokedAt: null,
          userId: payload.sub
        }
      });

      if (!user || !session || !isSessionVersionCurrent(payload, user.sessionVersion)) {
        throw new UnauthorizedException({
          code: "AUTH_INVALID_TOKEN",
          message: "Session invalide."
        });
      }

      request.user = toAuthUser(user);

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException({
        code: "AUTH_INVALID_TOKEN",
        message: "Session invalide."
      });
    }
  }
}

export function isSessionVersionCurrent(
  payload: Pick<AuthTokenPayload, "sessionVersion">,
  currentVersion: number
): boolean {
  return Number.isSafeInteger(payload.sessionVersion) && payload.sessionVersion === currentVersion;
}

function extractBearerToken(authorization: string | string[] | undefined): string | null {
  const header = Array.isArray(authorization) ? authorization[0] : authorization;

  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

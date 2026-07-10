import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import { Injectable, UnauthorizedException } from "@nestjs/common";

import { PrismaService } from "../database/prisma.service";
import { refreshTokenMaxAgeSeconds } from "./auth.constants";

export type RotatedRefreshSession = Readonly<{
  refreshToken: string;
  sessionId: string;
  userId: string;
}>;

@Injectable()
export class RefreshSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string): Promise<RotatedRefreshSession> {
    const sessionId = randomUUID();
    const refreshToken = createRefreshToken(sessionId);
    await this.prisma.refreshSession.create({
      data: {
        expiresAt: new Date(Date.now() + refreshTokenMaxAgeSeconds * 1000),
        id: sessionId,
        tokenHash: hashRefreshToken(refreshToken),
        userId
      }
    });
    return { refreshToken, sessionId, userId };
  }

  async rotate(refreshToken: string): Promise<RotatedRefreshSession> {
    const parsed = parseRefreshToken(refreshToken);
    if (!parsed) throw invalidRefreshToken();

    const session = await this.prisma.refreshSession.findUnique({
      where: { id: parsed.sessionId }
    });
    const presentedHash = hashRefreshToken(refreshToken);
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !safeHashEqual(session.tokenHash, presentedHash)
    ) {
      if (session && !session.revokedAt) await this.revokeById(session.id);
      throw invalidRefreshToken();
    }

    const rotatedToken = createRefreshToken(session.id);
    const rotated = await this.prisma.refreshSession.updateMany({
      data: { tokenHash: hashRefreshToken(rotatedToken) },
      where: {
        expiresAt: { gt: new Date() },
        id: session.id,
        revokedAt: null,
        tokenHash: presentedHash
      }
    });
    if (rotated.count !== 1) {
      await this.revokeById(session.id);
      throw invalidRefreshToken();
    }
    return { refreshToken: rotatedToken, sessionId: session.id, userId: session.userId };
  }

  async revoke(refreshToken: string | undefined): Promise<void> {
    const parsed = refreshToken ? parseRefreshToken(refreshToken) : null;
    if (parsed) await this.revokeById(parsed.sessionId);
  }

  private async revokeById(sessionId: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      data: { revokedAt: new Date() },
      where: { id: sessionId, revokedAt: null }
    });
  }
}

function createRefreshToken(sessionId: string): string {
  return `${sessionId}.${randomBytes(32).toString("base64url")}`;
}

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function parseRefreshToken(token: string): { sessionId: string } | null {
  const [sessionId, secret, extra] = token.split(".");
  if (
    extra ||
    !sessionId ||
    !secret ||
    !/^[0-9a-f-]{36}$/i.test(sessionId) ||
    secret.length !== 43
  ) {
    return null;
  }
  return { sessionId };
}

function safeHashEqual(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(actual, "hex");
  return (
    expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

function invalidRefreshToken(): UnauthorizedException {
  return new UnauthorizedException({
    code: "AUTH_INVALID_REFRESH_TOKEN",
    message: "Session expirée ou déjà renouvelée."
  });
}

import { randomUUID } from "node:crypto";

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  type AuthSessionDto,
  type AuthUserDto,
  type PasswordChangeRequestDto,
  type Role
} from "@corsica/contracts";

import { PrismaService } from "../database/prisma.service";
import { accessTokenExpiresIn, getAuthJwtSecret } from "./auth.constants";
import { type AuthCredentialsDto } from "./dto/auth-credentials.dto";
import { type LoginCredentialsDto } from "./dto/login-credentials.dto";
import { hashPassword, verifyPassword, verifyPasswordOrDummy } from "./password-hasher";
import { RefreshSessionService } from "./refresh-session.service";

type UserRecord = Readonly<{
  createdAt: Date;
  email: string;
  id: string;
  role: Role;
  sessionVersion: number;
  username: string;
}>;

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly refreshSessions: RefreshSessionService
  ) {}

  async register(credentials: AuthCredentialsDto): Promise<AuthSessionDto> {
    const email = normalizeEmail(credentials.email);
    const passwordHash = await hashPassword(credentials.password);
    const baseUsername = deriveUsername(email);

    // Le username est auto-dérivé du préfixe de l'email. Comme il est unique,
    // on suffixe (-2, -3...) en cas de collision jusqu'à trouver un libre.
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const username =
        attempt === 0 ? baseUsername : truncateUsername(`${baseUsername}${String(attempt + 1)}`);

      try {
        const user = await this.prisma.user.create({
          data: {
            email,
            passwordHash,
            username
          },
          select: userSelect
        });

        return await this.createSession(user);
      } catch (error) {
        if (isUniqueConstraintOn(error, "email")) {
          throw new ConflictException({
            code: "AUTH_EMAIL_ALREADY_USED",
            message: "Un compte existe déjà avec cet email."
          });
        }

        if (isUniqueConstraintOn(error, "username")) {
          continue;
        }

        throw error;
      }
    }

    throw new ConflictException({
      code: "AUTH_USERNAME_UNAVAILABLE",
      message: "Impossible de générer un nom d'utilisateur unique."
    });
  }

  async updateUsername(userId: string, username: string): Promise<AuthUserDto> {
    try {
      const user = await this.prisma.user.update({
        data: {
          username: username.trim().toLowerCase()
        },
        select: userSelect,
        where: {
          id: userId
        }
      });

      return toAuthUser(user);
    } catch (error) {
      if (isUniqueConstraintOn(error, "username")) {
        throw new ConflictException({
          code: "AUTH_USERNAME_ALREADY_USED",
          message: "Ce nom d'utilisateur est déjà pris."
        });
      }

      throw error;
    }
  }

  async login(credentials: LoginCredentialsDto): Promise<AuthSessionDto> {
    // On accepte l'email OU le username. Les deux sont stockés en minuscules.
    const identifier = credentials.identifier.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }]
      }
    });

    const passwordMatches = await verifyPasswordOrDummy(credentials.password, user?.passwordHash);
    if (!user || !passwordMatches) {
      throw new UnauthorizedException({
        code: "AUTH_INVALID_CREDENTIALS",
        message: "Identifiant ou mot de passe incorrect."
      });
    }

    return this.createSession(user);
  }

  async changePassword(
    userId: string,
    role: Role,
    currentPassword: string,
    newPassword: string
  ): Promise<AuthSessionDto> {
    if (role !== "USER") {
      throw new ForbiddenException({
        code: "AUTH_PASSWORD_REQUEST_REQUIRED",
        message: "Les comptes professionnels doivent effectuer une demande de modification."
      });
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException({
        code: "AUTH_CURRENT_PASSWORD_INVALID",
        message: "Le mot de passe actuel est incorrect."
      });
    }

    const passwordHash = await hashPassword(newPassword);
    const updatedUser = await this.prisma.$transaction(async (transaction) => {
      const nextUser = await transaction.user.update({
        data: { passwordHash, sessionVersion: { increment: 1 } },
        select: userSelect,
        where: { id: userId }
      });
      await transaction.refreshSession.updateMany({
        data: { revokedAt: new Date() },
        where: { revokedAt: null, userId }
      });
      return nextUser;
    });
    return this.createSession(updatedUser);
  }

  async requestPasswordChange(userId: string, role: Role): Promise<PasswordChangeRequestDto> {
    if (role === "USER") {
      throw new ForbiddenException({
        code: "AUTH_PASSWORD_CHANGE_AVAILABLE",
        message: "Un client peut modifier directement son mot de passe."
      });
    }

    const existing = await this.prisma.passwordChangeRequest.findFirst({
      where: { status: "PENDING", userId }
    });
    const request =
      existing ??
      (await this.prisma.passwordChangeRequest.create({
        data: { userId }
      }));

    return {
      id: request.id,
      requestedAt: request.requestedAt.toISOString(),
      status: "PENDING"
    };
  }

  async createSession(user: UserRecord): Promise<AuthSessionDto> {
    const session = await this.refreshSessions.create(user.id);
    return this.createSessionResponse(user, session.sessionId, session.refreshToken);
  }

  async refreshSession(refreshToken: string): Promise<AuthSessionDto> {
    const session = await this.refreshSessions.rotate(refreshToken);
    const user = await this.prisma.user.findUnique({
      select: userSelect,
      where: { id: session.userId }
    });
    if (!user) throw new UnauthorizedException();
    return this.createSessionResponse(user, session.sessionId, session.refreshToken);
  }

  async revokeSession(refreshToken: string | undefined): Promise<void> {
    await this.refreshSessions.revoke(refreshToken);
  }

  private async createSessionResponse(
    user: UserRecord,
    sessionId: string,
    refreshToken: string
  ): Promise<AuthSessionDto> {
    const authUser = toAuthUser(user);
    const accessToken = await this.jwtService.signAsync(
      {
        email: authUser.email,
        jti: randomUUID(),
        role: authUser.role,
        sessionId,
        sessionVersion: user.sessionVersion,
        sub: authUser.id
      },
      {
        expiresIn: accessTokenExpiresIn,
        secret: getAuthJwtSecret(this.configService)
      }
    );

    return {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      user: authUser
    };
  }
}

export const userSelect = {
  createdAt: true,
  email: true,
  id: true,
  role: true,
  sessionVersion: true,
  username: true
} as const;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function toAuthUser(user: UserRecord): AuthUserDto {
  return {
    createdAt: user.createdAt.toISOString(),
    email: user.email,
    id: user.id,
    role: user.role,
    username: user.username
  };
}

const usernameMinLength = 3;
const usernameMaxLength = 30;

export function deriveUsername(email: string): string {
  const prefix = (email.split("@")[0] ?? "").toLowerCase();
  const cleaned = prefix.replace(/[^a-z0-9._-]/g, "");
  const padded = cleaned.length >= usernameMinLength ? cleaned : `${cleaned}user`;

  return truncateUsername(padded || "user");
}

function truncateUsername(username: string): string {
  return username.slice(0, usernameMaxLength);
}

export function isUniqueConstraintOn(error: unknown, field: string): boolean {
  if (!isPrismaUniqueError(error)) return false;

  const target = uniqueConstraintTarget(error);

  if (Array.isArray(target)) {
    return target.includes(field);
  }

  return typeof target === "string" && target.includes(field);
}

type PrismaUniqueError = Readonly<{
  code: "P2002";
  meta?: {
    driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } };
    target?: unknown;
  };
}>;

function isPrismaUniqueError(error: unknown): error is PrismaUniqueError {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

function uniqueConstraintTarget(error: PrismaUniqueError): unknown {
  return error.meta?.target ?? error.meta?.driverAdapterError?.cause?.constraint?.fields;
}

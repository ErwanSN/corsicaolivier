import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { type AuthSessionDto, type AuthUserDto, type Role } from "@corsica/contracts";

import { PrismaService } from "../database/prisma.service";
import { authTokenExpiresIn, getAuthJwtSecret } from "./auth.constants";
import { type AuthCredentialsDto } from "./dto/auth-credentials.dto";
import { type LoginCredentialsDto } from "./dto/login-credentials.dto";
import { hashPassword, verifyPassword } from "./password-hasher";

type UserRecord = Readonly<{
  createdAt: Date;
  email: string;
  id: string;
  role: Role;
  username: string;
}>;

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService
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

    if (!user || !(await verifyPassword(credentials.password, user.passwordHash))) {
      throw new UnauthorizedException({
        code: "AUTH_INVALID_CREDENTIALS",
        message: "Identifiant ou mot de passe incorrect."
      });
    }

    return this.createSession(user);
  }

  async createSession(user: UserRecord): Promise<AuthSessionDto> {
    const authUser = toAuthUser(user);
    const accessToken = await this.jwtService.signAsync(
      {
        email: authUser.email,
        role: authUser.role,
        sub: authUser.id
      },
      {
        expiresIn: authTokenExpiresIn,
        secret: getAuthJwtSecret(this.configService)
      }
    );

    return {
      accessToken,
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

function isUniqueConstraintOn(error: unknown, field: string): boolean {
  if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "P2002") {
    return false;
  }

  const target = (error as { meta?: { target?: unknown } }).meta?.target;

  if (Array.isArray(target)) {
    return target.includes(field);
  }

  return typeof target === "string" && target.includes(field);
}

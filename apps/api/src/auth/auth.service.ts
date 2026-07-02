import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { type AuthSessionDto, type AuthUserDto } from "@corsica/contracts";

import { PrismaService } from "../database/prisma.service";
import { authTokenExpiresIn, getAuthJwtSecret } from "./auth.constants";
import { type AuthCredentialsDto } from "./dto/auth-credentials.dto";
import { hashPassword, verifyPassword } from "./password-hasher";

type UserRecord = Readonly<{
  createdAt: Date;
  email: string;
  id: string;
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

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash
        },
        select: userSelect
      });

      return await this.createSession(user);
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new ConflictException({
          code: "AUTH_EMAIL_ALREADY_USED",
          message: "Un compte existe déjà avec cet email."
        });
      }

      throw error;
    }
  }

  async login(credentials: AuthCredentialsDto): Promise<AuthSessionDto> {
    const email = normalizeEmail(credentials.email);
    const user = await this.prisma.user.findUnique({
      where: {
        email
      }
    });

    if (!user || !(await verifyPassword(credentials.password, user.passwordHash))) {
      throw new UnauthorizedException({
        code: "AUTH_INVALID_CREDENTIALS",
        message: "Email ou mot de passe incorrect."
      });
    }

    return this.createSession(user);
  }

  async createSession(user: UserRecord): Promise<AuthSessionDto> {
    const authUser = toAuthUser(user);
    const accessToken = await this.jwtService.signAsync(
      {
        email: authUser.email,
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
  id: true
} as const;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function toAuthUser(user: UserRecord): AuthUserDto {
  return {
    createdAt: user.createdAt.toISOString(),
    email: user.email,
    id: user.id
  };
}

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

import { type AuthUserDto, type Role } from "@corsica/contracts";

export type AuthTokenPayload = Readonly<{
  email: string;
  role: Role;
  sessionId: string;
  sessionVersion: number;
  sub: string;
}>;

export type AuthenticatedRequest = Readonly<{
  cookies?: Readonly<Record<string, string | undefined>>;
  headers: Readonly<{
    authorization?: string | string[];
  }>;
}> & {
  user?: AuthUserDto;
};

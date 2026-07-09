import { type AuthUserDto, type Role } from "@corsica/contracts";

export type AuthTokenPayload = Readonly<{
  email: string;
  role: Role;
  sub: string;
}>;

export type AuthenticatedRequest = Readonly<{
  headers: Readonly<{
    authorization?: string | string[];
  }>;
}> & {
  user?: AuthUserDto;
};

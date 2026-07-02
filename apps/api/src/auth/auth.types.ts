import { type AuthUserDto } from "@corsica/contracts";

export type AuthTokenPayload = Readonly<{
  email: string;
  sub: string;
}>;

export type AuthenticatedRequest = Readonly<{
  headers: Readonly<{
    authorization?: string | string[];
  }>;
}> & {
  user?: AuthUserDto;
};

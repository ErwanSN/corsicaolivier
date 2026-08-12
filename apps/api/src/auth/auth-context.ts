import type { AppRole } from '../database/database.aliases';

export type AuthIdentity = Readonly<{
  accessToken: string;
  userId: string;
  email?: string;
  assuranceLevel: string;
}>;

export type RoleAssignment = Readonly<{
  role: AppRole;
  organizationId: string | null;
  siteId: string | null;
  validFrom: string;
  validUntil: string | null;
}>;

export type AccessContext = Readonly<{
  userId: string;
  displayName: string;
  status: 'active';
  assignments: RoleAssignment[];
}>;

export type AuthenticatedRequest = Readonly<{
  headers: Record<string, string | string[] | undefined>;
  auth?: AuthIdentity;
  accessContext?: AccessContext;
}>;

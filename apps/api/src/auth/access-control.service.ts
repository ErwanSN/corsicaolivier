import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import type { AppRole, Json } from '../database/database.types';
import { SupabaseService } from '../database/supabase.service';
import type { AccessContext, RoleAssignment } from './auth-context';

const APP_ROLES: ReadonlySet<string> = new Set([
  'platform_admin',
  'planning_admin',
  'planner',
  'approver',
  'supervisor',
  'agent',
  'hr',
  'auditor',
]);

@Injectable()
export class AccessControlService {
  constructor(private readonly supabase: SupabaseService) {}

  async getContext(accessToken: string): Promise<AccessContext> {
    const { data, error } = await this.supabase
      .forUser(accessToken)
      .rpc('get_my_access_context');

    if (error) {
      throw new ServiceUnavailableException(
        'Impossible de charger les autorisations.',
      );
    }

    const accessContext = this.parseAccessContext(data);

    if (!accessContext) {
      throw new ForbiddenException('Compte désactivé ou accès non configuré.');
    }

    return accessContext;
  }

  hasAnyRole(
    context: AccessContext,
    allowedRoles: readonly AppRole[],
    organizationId?: string,
    siteId?: string,
  ): boolean {
    return context.assignments.some((assignment) => {
      if (!allowedRoles.includes(assignment.role)) {
        return false;
      }

      if (assignment.role === 'platform_admin') {
        return true;
      }

      if (!organizationId || assignment.organizationId !== organizationId) {
        return false;
      }

      return !siteId || !assignment.siteId || assignment.siteId === siteId;
    });
  }

  private parseAccessContext(value: Json): AccessContext | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const userId = value.userId;
    const displayName = value.displayName;
    const status = value.status;
    const assignments = value.assignments;

    if (
      typeof userId !== 'string' ||
      typeof displayName !== 'string' ||
      status !== 'active' ||
      !Array.isArray(assignments)
    ) {
      return null;
    }

    const parsedAssignments = assignments
      .map((assignment) => this.parseAssignment(assignment))
      .filter(
        (assignment): assignment is RoleAssignment => assignment !== null,
      );

    return { userId, displayName, status, assignments: parsedAssignments };
  }

  private parseAssignment(value: Json): RoleAssignment | null {
    if (
      !this.isRecord(value) ||
      typeof value.role !== 'string' ||
      !APP_ROLES.has(value.role)
    ) {
      return null;
    }

    const organizationId = value.organizationId;
    const siteId = value.siteId;
    const validFrom = value.validFrom;
    const validUntil = value.validUntil;

    if (
      (organizationId !== null && typeof organizationId !== 'string') ||
      (siteId !== null && typeof siteId !== 'string') ||
      typeof validFrom !== 'string' ||
      (validUntil !== null && typeof validUntil !== 'string')
    ) {
      return null;
    }

    return {
      role: value.role as AppRole,
      organizationId,
      siteId,
      validFrom,
      validUntil,
    };
  }

  private isRecord(value: Json): value is Record<string, Json | undefined> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}

import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AppRole } from '../database/database.aliases';
import { AccessControlService } from './access-control.service';
import type { AuthenticatedRequest } from './auth-context';
import { REQUIRED_ROLES } from './require-roles.decorator';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessControl: AccessControlService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<AppRole[]>(REQUIRED_ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles?.length) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest & { accessContext?: never }>();

    if (!request.auth) {
      throw new ForbiddenException('Contexte d’authentification absent.');
    }

    const organizationId = this.readScopeHeader(
      request.headers['x-organization-id'],
      'organisation',
    );
    const siteId = this.readScopeHeader(request.headers['x-site-id'], 'site');
    const accessContext = await this.accessControl.getContext(
      request.auth.accessToken,
    );

    if (
      !this.accessControl.hasAnyRole(
        accessContext,
        roles,
        organizationId,
        siteId,
      )
    ) {
      throw new ForbiddenException(
        'Autorisation insuffisante pour ce périmètre.',
      );
    }

    Object.assign(request, { accessContext });

    return true;
  }

  private readScopeHeader(
    value: string | string[] | undefined,
    label: string,
  ): string | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
      throw new ForbiddenException(`Identifiant de ${label} invalide.`);
    }

    return value;
  }
}

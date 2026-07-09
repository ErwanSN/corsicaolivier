import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { type Role } from "@corsica/contracts";

import { type AuthenticatedRequest } from "./auth.types";
import { ROLES_KEY } from "./roles.decorator";

/**
 * Autorise la requête si le rôle de l'utilisateur (posé par JwtAuthGuard sur
 * request.user) fait partie des rôles requis par @Roles(). Sans @Roles(), la
 * route reste ouverte à tout utilisateur authentifié.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const role = request.user?.role;

    if (!role || !requiredRoles.includes(role)) {
      throw new ForbiddenException({
        code: "AUTH_FORBIDDEN",
        message: "Accès refusé pour votre rôle."
      });
    }

    return true;
  }
}

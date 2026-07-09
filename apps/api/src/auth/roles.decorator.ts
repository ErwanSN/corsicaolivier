import { SetMetadata } from "@nestjs/common";
import { type Role } from "@corsica/contracts";

export const ROLES_KEY = "roles";

/**
 * Restreint une route aux rôles listés. À combiner avec JwtAuthGuard +
 * RolesGuard : `@UseGuards(JwtAuthGuard, RolesGuard)` puis `@Roles("ADMIN")`.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

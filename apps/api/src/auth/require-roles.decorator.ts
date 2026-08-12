import { SetMetadata } from '@nestjs/common';

import type { AppRole } from '../database/database.aliases';

export const REQUIRED_ROLES = 'requiredRoles';

export const RequireRoles = (...roles: AppRole[]) =>
  SetMetadata(REQUIRED_ROLES, roles);

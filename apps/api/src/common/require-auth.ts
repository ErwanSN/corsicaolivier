import { UnauthorizedException } from '@nestjs/common';

import type { AuthIdentity } from '../auth/auth-context';

export function requireAuth(auth?: AuthIdentity): AuthIdentity {
  if (!auth) {
    throw new UnauthorizedException();
  }

  return auth;
}

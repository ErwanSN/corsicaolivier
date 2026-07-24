import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AuthenticatedRequest, AuthIdentity } from './auth-context';

export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthIdentity | undefined => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    return request.auth;
  },
);

import { Injectable } from '@nestjs/common';

import type { AuthenticatedRequest } from '../auth/auth-context';
import { NamedThrottlerGuard } from './named-throttler.guard';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class IdentityThrottlerGuard extends NamedThrottlerGuard {
  protected readonly throttlerName = 'default';

  protected override async getTracker(
    request: Record<string, unknown> & Partial<AuthenticatedRequest>,
  ): Promise<string> {
    const userId = request.auth?.userId;

    if (typeof userId === 'string' && UUID_PATTERN.test(userId)) {
      return `user:${userId.toLowerCase()}`;
    }

    return super.getTracker(request);
  }
}

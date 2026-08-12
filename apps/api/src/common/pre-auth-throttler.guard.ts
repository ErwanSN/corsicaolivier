import { createHash } from 'node:crypto';

import { type ExecutionContext, Injectable } from '@nestjs/common';

import { NamedThrottlerGuard } from './named-throttler.guard';

@Injectable()
export class PreAuthThrottlerGuard extends NamedThrottlerGuard {
  protected readonly throttlerName = 'preauth';

  protected override getTracker(
    request: Record<string, unknown>,
  ): Promise<string> {
    // Ce plafond ignore volontairement Authorization : faire tourner des bearers
    // arbitraires ne doit jamais créer de nouveaux quotas pré-authentification.
    return super.getTracker(request);
  }

  protected override generateKey(
    _context: ExecutionContext,
    tracker: string,
    name: string,
  ): string {
    return createHash('sha256')
      .update(`corsica:${name}:${tracker}`)
      .digest('hex');
  }
}

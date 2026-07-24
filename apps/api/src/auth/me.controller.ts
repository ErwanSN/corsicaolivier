import { Controller, Get, UnauthorizedException } from '@nestjs/common';

import { AccessControlService } from './access-control.service';
import type { AccessContext, AuthIdentity } from './auth-context';
import { CurrentAuth } from './current-auth.decorator';

@Controller('auth')
export class MeController {
  constructor(private readonly accessControl: AccessControlService) {}

  @Get('me')
  async me(@CurrentAuth() auth?: AuthIdentity): Promise<AccessContext> {
    if (!auth) {
      throw new UnauthorizedException();
    }

    return this.accessControl.getContext(auth.accessToken);
  }
}

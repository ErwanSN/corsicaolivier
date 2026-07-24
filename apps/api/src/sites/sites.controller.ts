import { Body, Controller, Get, Post } from '@nestjs/common';

import type { AuthIdentity } from '../auth/auth-context';
import { CurrentAuth } from '../auth/current-auth.decorator';
import { RequireRoles } from '../auth/require-roles.decorator';
import { requireAuth } from '../common/require-auth';
import { CreateSiteDto } from './site.dto';
import { SitesService } from './sites.service';

@Controller('sites')
export class SitesController {
  constructor(private readonly sites: SitesService) {}

  @Get()
  list(@CurrentAuth() auth?: AuthIdentity) {
    return this.sites.list(requireAuth(auth).accessToken);
  }

  @Post()
  @RequireRoles('platform_admin', 'planning_admin')
  create(
    @CurrentAuth() auth: AuthIdentity | undefined,
    @Body() input: CreateSiteDto,
  ) {
    return this.sites.create(requireAuth(auth).accessToken, input);
  }
}

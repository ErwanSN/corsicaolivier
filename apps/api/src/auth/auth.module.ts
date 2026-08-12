import { Module } from '@nestjs/common';

import { AccessControlService } from './access-control.service';
import { AuthGuard } from './auth.guard';
import { MeController } from './me.controller';
import { RolesGuard } from './roles.guard';

@Module({
  controllers: [MeController],
  providers: [AccessControlService, AuthGuard, RolesGuard],
  exports: [AccessControlService, AuthGuard, RolesGuard],
})
export class AuthModule {}

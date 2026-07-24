import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AccessControlService } from './access-control.service';
import { AuthGuard } from './auth.guard';
import { MeController } from './me.controller';
import { RolesGuard } from './roles.guard';

@Module({
  controllers: [MeController],
  providers: [
    AccessControlService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AccessControlService],
})
export class AuthModule {}

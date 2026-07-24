import { Module } from '@nestjs/common';

import { PortCallsController } from './port-calls.controller';
import { PortCallsService } from './port-calls.service';

@Module({
  controllers: [PortCallsController],
  providers: [PortCallsService],
})
export class PortCallsModule {}

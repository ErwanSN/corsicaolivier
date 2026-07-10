import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { ControlsController } from "./controls.controller";
import { ControlsService } from "./controls.service";

@Module({
  controllers: [ControlsController],
  imports: [AuthModule],
  providers: [ControlsService]
})
export class ControlsModule {}

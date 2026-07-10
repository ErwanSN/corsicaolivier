import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { PortMapController } from "./port-map.controller";
import { PortMapService } from "./port-map.service";

@Module({
  controllers: [PortMapController],
  imports: [AuthModule],
  providers: [PortMapService]
})
export class PortMapModule {}

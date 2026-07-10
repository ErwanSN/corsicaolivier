import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { DossiersController } from "./dossiers.controller";
import { DossiersService } from "./dossiers.service";

@Module({
  controllers: [DossiersController],
  imports: [AuthModule],
  providers: [DossiersService]
})
export class DossiersModule {}

import { Logger, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { configureWorkerLifecycle } from "./worker-lifecycle";

@Module({})
class WorkerModule {}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  configureWorkerLifecycle(app);

  Logger.log("Workers context started", "Bootstrap");
}

void bootstrap();

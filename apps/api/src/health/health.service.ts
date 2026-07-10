import { Injectable } from "@nestjs/common";

import { PrismaService } from "../database/prisma.service";

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<{ database: "reachable"; status: "ok" }> {
    await this.prisma.$queryRaw`SELECT 1`;

    return { database: "reachable", status: "ok" };
  }
}

import { BadRequestException, Injectable } from "@nestjs/common";
import { portMapConfigSchema, type PortMapConfig } from "@corsica/contracts";

import { PrismaService } from "../database/prisma.service";

const configurationId = "main";
const emptyConfiguration: PortMapConfig = { points: [], routes: [], version: 3 };

@Injectable()
export class PortMapService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfiguration(): Promise<PortMapConfig> {
    const stored = await this.prisma.portMapConfiguration.findUnique({
      where: { id: configurationId }
    });
    if (!stored) return emptyConfiguration;
    return portMapConfigSchema.parse(JSON.parse(stored.payload) as unknown);
  }

  async updateConfiguration(input: unknown): Promise<PortMapConfig> {
    const parsed = portMapConfigSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "PORT_MAP_INVALID_CONFIGURATION",
        message: "La configuration de la carte est invalide."
      });
    }
    const normalized = normalizePortMapConfiguration(parsed.data);
    await this.prisma.portMapConfiguration.upsert({
      create: { id: configurationId, payload: JSON.stringify(normalized) },
      update: { payload: JSON.stringify(normalized) },
      where: { id: configurationId }
    });
    return normalized;
  }
}

export function normalizePortMapConfiguration(configuration: PortMapConfig): PortMapConfig {
  const coordinatesById = new Map(
    configuration.points.map((point) => [point.id, point.coordinates])
  );
  return {
    ...configuration,
    routes: configuration.routes.map((route) => ({
      ...route,
      geometry: route.pointIds.flatMap((id) => {
        const coordinates = coordinatesById.get(id);
        return coordinates ? [coordinates] : [];
      })
    }))
  };
}

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  controlRecordSchema,
  createControlRecordSchema,
  type ControlRecord
} from "@corsica/contracts";

import { PrismaService } from "../database/prisma.service";

const controlRelations = {
  controlledBy: { select: { username: true } },
  dossier: { select: { id: true, reference: true, routeLabel: true } }
} as const;

@Injectable()
export class ControlsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<ControlRecord[]> {
    const rows = await this.prisma.controlRecord.findMany({
      include: controlRelations,
      orderBy: { controlledAt: "desc" },
      take: 100,
      where: { controlledById: userId }
    });
    return rows.map(toControlRecord);
  }

  async create(userId: string, input: unknown): Promise<ControlRecord> {
    const parsed = createControlRecordSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "CONTROL_INVALID",
        message: "Le résultat du contrôle est invalide."
      });
    }
    const dossier = await this.prisma.dossier.findUnique({
      select: { id: true },
      where: { id: parsed.data.dossierId }
    });
    if (!dossier) {
      throw new NotFoundException({
        code: "DOSSIER_NOT_FOUND",
        message: "Ce dossier est introuvable."
      });
    }
    const row = await this.prisma.controlRecord.create({
      data: {
        controlledById: userId,
        dossierId: dossier.id,
        status: parsed.data.status
      },
      include: controlRelations
    });
    return toControlRecord(row);
  }
}

function toControlRecord(row: {
  controlledAt: Date;
  controlledBy: { username: string };
  dossier: { id: string; reference: string; routeLabel: string };
  id: string;
  status: string;
}): ControlRecord {
  return controlRecordSchema.parse({
    controlledAt: row.controlledAt.toISOString(),
    controlledBy: row.controlledBy.username,
    dossierId: row.dossier.id,
    id: row.id,
    reference: row.dossier.reference,
    route: row.dossier.routeLabel,
    status: row.status
  });
}

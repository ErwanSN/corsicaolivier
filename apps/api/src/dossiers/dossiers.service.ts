import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  dossierSchema,
  dossierSearchQuerySchema,
  type Dossier,
  type DossierSearchField
} from "@corsica/contracts";

import { PrismaService } from "../database/prisma.service";

const dossierRelations = { travelers: true, vehicles: true } as const;

@Injectable()
export class DossiersService {
  constructor(private readonly prisma: PrismaService) {}

  async search(input: unknown): Promise<Dossier[]> {
    const parsed = dossierSearchQuerySchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "DOSSIER_SEARCH_INVALID",
        message: "Le critère de recherche est invalide."
      });
    }

    const query = normalizeSearchValue(parsed.data.query, parsed.data.field);
    const rows = await this.prisma.dossier.findMany({
      include: dossierRelations,
      orderBy: { updatedAt: "desc" },
      take: 20,
      where: dossierWhere(parsed.data.field, query)
    });
    return rows.map(toDossier);
  }

  async findOne(id: string): Promise<Dossier> {
    const row = await this.prisma.dossier.findUnique({
      include: dossierRelations,
      where: { id }
    });
    if (!row) {
      throw new NotFoundException({
        code: "DOSSIER_NOT_FOUND",
        message: "Ce dossier est introuvable."
      });
    }
    return toDossier(row);
  }
}

function dossierWhere(field: DossierSearchField, query: string) {
  switch (field) {
    case "dossier":
      return { reference: { contains: query } };
    case "nom":
      return { travelers: { some: { normalizedName: { contains: query } } } };
    case "telephone":
      return { normalizedPhone: { contains: query } };
    case "vehicule":
      return { vehicles: { some: { normalizedPlate: { contains: query } } } };
  }
}

function normalizeSearchValue(value: string, field: DossierSearchField): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  return field === "telephone" || field === "vehicule"
    ? normalized.replace(/[^a-z0-9]/g, "")
    : normalized;
}

function toDossier(row: {
  currencyLabel: string;
  id: string;
  phone: string;
  reference: string;
  routeLabel: string;
  travelers: { dateLabel: string; id: string; name: string; status: string }[];
  vehicles: { id: string; model: string; owner: string; paid: boolean; plate: string }[];
}): Dossier {
  return dossierSchema.parse(row);
}

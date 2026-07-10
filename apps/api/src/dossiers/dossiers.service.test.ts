import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { DossiersService } from "./dossiers.service";

const dossierRow = {
  currencyLabel: "Réglé en EUR",
  id: "93620490-0000-4000-8000-000000000001",
  phone: "0675561134",
  reference: "9362049",
  routeLabel: "MRS - ILR",
  travelers: [
    {
      dateLabel: "30/06/26 - 19:15",
      id: "00000000-0000-4000-8000-000000000101",
      name: "Jeanne Delavoi",
      status: "embarque"
    }
  ],
  vehicles: [
    {
      id: "00000000-0000-4000-8000-000000000201",
      model: "PEUGEOT 207",
      owner: "Jeanne Delavoi",
      paid: true,
      plate: "EA 279 RZ"
    }
  ]
};

describe("DossiersService", () => {
  it("normalizes a plate and limits the server-side query", async () => {
    const findMany = vi.fn().mockResolvedValue([dossierRow]);
    const service = new DossiersService({ dossier: { findMany } } as never);

    await expect(service.search({ field: "vehicule", query: "EA-279 RZ" })).resolves.toEqual([
      dossierRow
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
        where: { vehicles: { some: { normalizedPlate: { contains: "ea279rz" } } } }
      })
    );
  });

  it("rejects invalid and undersized queries before accessing Prisma", async () => {
    const findMany = vi.fn();
    const service = new DossiersService({ dossier: { findMany } } as never);

    await expect(service.search({ field: "unknown", query: "a" })).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns a stable not-found error", async () => {
    const service = new DossiersService({
      dossier: { findUnique: vi.fn().mockResolvedValue(null) }
    } as never);

    await expect(service.findOne("93620490-0000-4000-8000-000000000099")).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});

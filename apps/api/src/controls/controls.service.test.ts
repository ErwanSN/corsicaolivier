import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { ControlsService } from "./controls.service";

const row = {
  controlledAt: new Date("2026-07-10T08:00:00.000Z"),
  controlledBy: { username: "agent" },
  dossier: {
    id: "93620490-0000-4000-8000-000000000001",
    reference: "9362049",
    routeLabel: "MRS - ILR"
  },
  id: "00000000-0000-4000-8000-000000000301",
  status: "valide"
};

describe("ControlsService", () => {
  it("returns only the current operator history, newest first", async () => {
    const findMany = vi.fn().mockResolvedValue([row]);
    const service = new ControlsService({ controlRecord: { findMany } } as never);
    await expect(service.list("operator-id")).resolves.toMatchObject([
      { controlledBy: "agent", status: "valide" }
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { controlledAt: "desc" },
        take: 100,
        where: { controlledById: "operator-id" }
      })
    );
  });

  it("rejects malformed decisions before database access", async () => {
    const findUnique = vi.fn();
    const service = new ControlsService({ dossier: { findUnique } } as never);
    await expect(service.create("operator-id", { status: "maybe" })).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("does not create a control for an unknown dossier", async () => {
    const service = new ControlsService({
      dossier: { findUnique: vi.fn().mockResolvedValue(null) }
    } as never);
    await expect(
      service.create("operator-id", {
        dossierId: "93620490-0000-4000-8000-000000000099",
        status: "refuse"
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

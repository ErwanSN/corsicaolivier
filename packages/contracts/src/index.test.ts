import { describe, expect, it } from "vitest";

import { createControlRecordSchema, portMapConfigSchema } from "./index";

const controlId = "11111111-1111-4111-8111-111111111111";
const shipId = "22222222-2222-4222-8222-222222222222";
const routeId = "33333333-3333-4333-8333-333333333333";

function configuration() {
  return {
    points: [
      { coordinates: [43.3, 5.36], id: controlId, label: "Contrôle", type: "control" },
      { coordinates: [43.31, 5.35], id: shipId, label: "Navire", type: "ship" }
    ],
    routes: [
      {
        geometry: [
          [43.3, 5.36],
          [43.31, 5.35]
        ],
        id: routeId,
        label: "Embarquement",
        pointIds: [controlId, shipId],
        shipPointId: shipId
      }
    ],
    version: 3
  };
}

describe("portMapConfigSchema", () => {
  it("accepts a referentially valid port configuration", () => {
    expect(portMapConfigSchema.safeParse(configuration()).success).toBe(true);
  });

  it("rejects routes whose destination is not a ship", () => {
    const candidate = configuration();
    candidate.routes = candidate.routes.map((route, index) =>
      index === 0 ? { ...route, shipPointId: controlId } : route
    );
    expect(portMapConfigSchema.safeParse(candidate).success).toBe(false);
  });

  it("rejects coordinates outside geographical bounds", () => {
    const candidate = configuration();
    candidate.points = candidate.points.map((point, index) =>
      index === 0 ? { ...point, coordinates: [100, 5.36] } : point
    );
    expect(portMapConfigSchema.safeParse(candidate).success).toBe(false);
  });
});

describe("createControlRecordSchema", () => {
  it("accepts only explicit control decisions for a valid dossier", () => {
    const dossierId = "93620490-0000-4000-8000-000000000001";
    expect(createControlRecordSchema.safeParse({ dossierId, status: "valide" }).success).toBe(true);
    expect(createControlRecordSchema.safeParse({ dossierId, status: "pending" }).success).toBe(
      false
    );
  });
});

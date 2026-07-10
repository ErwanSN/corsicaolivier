import { describe, expect, it } from "vitest";

import { boardingRoutes, getBoardingRoute } from "./port-guide";

describe("port guide", () => {
  it.each(["foot", "vehicle"] as const)("provides a complete %s boarding route", (mode) => {
    const route = getBoardingRoute(mode);

    expect(route.steps.length).toBeGreaterThanOrEqual(3);
    expect(new Set(route.steps.map(({ id }) => id)).size).toBe(route.steps.length);
    expect(route.steps.every(({ coordinates }) => coordinates.every(Number.isFinite))).toBe(true);
  });

  it("keeps each route identity aligned with its lookup key", () => {
    expect(boardingRoutes.foot.id).toBe("foot");
    expect(boardingRoutes.vehicle.id).toBe("vehicle");
  });
});

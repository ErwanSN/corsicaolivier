import { describe, expect, it, vi } from "vitest";

import { HealthService } from "./health.service";

describe("HealthService", () => {
  it("reports the database as reachable after a successful probe", async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ 1: 1 }]);
    const service = new HealthService({ $queryRaw: queryRaw } as never);

    await expect(service.check()).resolves.toEqual({ database: "reachable", status: "ok" });
    expect(queryRaw).toHaveBeenCalledOnce();
  });

  it("propagates a failed database probe", async () => {
    const queryRaw = vi.fn().mockRejectedValue(new Error("database unavailable"));
    const service = new HealthService({ $queryRaw: queryRaw } as never);

    await expect(service.check()).rejects.toThrow("database unavailable");
  });
});

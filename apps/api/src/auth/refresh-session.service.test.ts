import { describe, expect, it, vi } from "vitest";

import { type PrismaService } from "../database/prisma.service";
import { RefreshSessionService } from "./refresh-session.service";

describe("RefreshSessionService", () => {
  it("rejette un jeton malformé sans interroger la base", async () => {
    const findUnique = vi.fn();
    const service = createService({ findUnique, updateMany: vi.fn() });

    await expect(service.rotate("not-a-refresh-token")).rejects.toMatchObject({
      response: { code: "AUTH_INVALID_REFRESH_TOKEN" }
    });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("révoque et rejette une session expirée", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const service = createService({
      findUnique: vi.fn().mockResolvedValue({
        expiresAt: new Date(Date.now() - 1),
        id: "00000000-0000-4000-8000-000000000000",
        revokedAt: null,
        tokenHash: "0".repeat(64),
        userId: "user-id"
      }),
      updateMany
    });
    const token = `00000000-0000-4000-8000-000000000000.${"a".repeat(43)}`;

    await expect(service.rotate(token)).rejects.toMatchObject({
      response: { code: "AUTH_INVALID_REFRESH_TOKEN" }
    });
    expect(updateMany).toHaveBeenCalledOnce();
  });
});

function createService(refreshSession: {
  findUnique: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
}): RefreshSessionService {
  return new RefreshSessionService({ refreshSession } as unknown as PrismaService);
}

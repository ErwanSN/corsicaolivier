import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const storage = new Map<string, string>();
  return {
    deleteItemAsync: vi.fn((key: string) => {
      storage.delete(key);
      return Promise.resolve();
    }),
    getItemAsync: vi.fn((key: string) => Promise.resolve(storage.get(key) ?? null)),
    setItemAsync: vi.fn((key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    }),
    storage
  };
});

vi.mock("expo-secure-store", () => mocks);

import { clearStoredAuthSession, readStoredTokens, storeAuthSession } from "./auth-storage";

const session = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  tokenType: "Bearer" as const,
  user: {
    createdAt: "2026-07-10T00:00:00.000Z",
    email: "client@example.test",
    id: "00000000-0000-4000-8000-000000000001",
    role: "USER" as const,
    username: "client"
  }
};

describe("mobile auth storage", () => {
  beforeEach(() => {
    mocks.storage.clear();
    vi.clearAllMocks();
  });

  it("stores a complete session atomically and reads only its tokens", async () => {
    await storeAuthSession(session);
    expect(mocks.setItemAsync).toHaveBeenCalledTimes(1);
    await expect(readStoredTokens()).resolves.toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token"
    });
  });

  it("deletes a corrupted v2 session and falls back to legacy tokens", async () => {
    mocks.storage.set("corsica.auth.session.v2", "not-json");
    mocks.storage.set("corsica.auth.accessToken", "legacy-access");
    mocks.storage.set("corsica.auth.refreshToken", "legacy-refresh");
    await expect(readStoredTokens()).resolves.toEqual({
      accessToken: "legacy-access",
      refreshToken: "legacy-refresh"
    });
    expect(mocks.deleteItemAsync).toHaveBeenCalledWith("corsica.auth.session.v2");
  });

  it("clears both current and legacy session formats", async () => {
    await clearStoredAuthSession();
    expect(mocks.deleteItemAsync).toHaveBeenCalledTimes(3);
  });
});

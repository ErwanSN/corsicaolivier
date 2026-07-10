import { describe, expect, it } from "vitest";

import { resolveApiBaseUrl } from "./api-base-url";

describe("resolveApiBaseUrl", () => {
  it("prefers an explicitly configured URL", () => {
    expect(resolveApiBaseUrl(" https://api.example.test ", "192.168.1.2:8081")).toBe(
      "https://api.example.test"
    );
  });

  it("derives the API host from Expo LAN metadata", () => {
    expect(resolveApiBaseUrl(undefined, "192.168.1.42:8081")).toBe("http://192.168.1.42:3001");
  });

  it("supports bracketed IPv6 hosts and a safe fallback", () => {
    expect(resolveApiBaseUrl(undefined, "[::1]:8081")).toBe("http://[::1]:3001");
    expect(resolveApiBaseUrl(undefined, undefined)).toBe("http://localhost:3001");
  });
});

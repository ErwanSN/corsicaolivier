import { describe, expect, it } from "vitest";

import { AuthAttemptLimiter, authLoginRateLimitKey } from "./auth-rate-limit";

describe("authentication rate limiting", () => {
  it("shares a normalized IP and identifier key without including the password", () => {
    const key = authLoginRateLimitKey("127.0.0.1", {
      identifier: " Client@Example.COM ",
      password: "never-log-this"
    });

    expect(key).toBe("127.0.0.1:client@example.com");
    expect(key).not.toContain("never-log-this");
  });

  it("blocks the sixth failure across callers and reports the remaining window", () => {
    const limiter = new AuthAttemptLimiter();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(limiter.consume("shared-key", 1_000)).toEqual({ allowed: true });
    }
    expect(limiter.consume("shared-key", 2_000)).toEqual({
      allowed: false,
      retryAfterSeconds: 59
    });
  });

  it("clears the failures after a successful login or window expiry", () => {
    const limiter = new AuthAttemptLimiter();
    limiter.consume("key", 1_000);
    limiter.clear("key");
    expect(limiter.consume("key", 1_001)).toEqual({ allowed: true });
    expect(limiter.consume("expired", 1_000)).toEqual({ allowed: true });
    expect(limiter.consume("expired", 61_000)).toEqual({ allowed: true });
  });

  it("keeps memory bounded when identifiers are attacker-controlled", () => {
    const limiter = new AuthAttemptLimiter();
    for (let index = 0; index < 10_050; index += 1) {
      limiter.consume(`key-${String(index)}`, 1_000);
    }
    expect(limiter.trackedKeys).toBeLessThanOrEqual(10_000);
  });
});

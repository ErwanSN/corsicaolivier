import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password-hasher";

describe("password hasher", () => {
  it("verifies the original password against its hash", async () => {
    const passwordHash = await hashPassword("correct-horse-battery-staple");

    await expect(verifyPassword("correct-horse-battery-staple", passwordHash)).resolves.toBe(true);
  });

  it("rejects a different password", async () => {
    const passwordHash = await hashPassword("correct-horse-battery-staple");

    await expect(verifyPassword("wrong-password", passwordHash)).resolves.toBe(false);
  });

  it("rejects malformed hashes", async () => {
    await expect(verifyPassword("password", "not-a-valid-hash")).resolves.toBe(false);
  });
});

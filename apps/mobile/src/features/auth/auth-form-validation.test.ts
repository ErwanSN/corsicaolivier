import { describe, expect, it } from "vitest";

import { validateAuthForm } from "./auth-form-validation";

describe("validateAuthForm", () => {
  it("normalizes valid account registrations", () => {
    expect(validateAuthForm("createAccount", " Client@Example.com ", "password123")).toEqual({
      credentials: { email: "client@example.com", password: "password123" },
      success: true
    });
  });

  it("enforces the password policy only when creating an account", () => {
    expect(validateAuthForm("createAccount", "client@example.com", "short").success).toBe(false);
    expect(validateAuthForm("signIn", "client@example.com", "short").success).toBe(true);
  });

  it("rejects malformed registration emails", () => {
    expect(validateAuthForm("createAccount", "invalid", "password123").success).toBe(false);
  });
});

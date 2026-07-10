import { describe, expect, it } from "vitest";

import { isUniqueConstraintOn } from "./auth.service";

describe("isUniqueConstraintOn", () => {
  it("supports Prisma native constraint metadata", () => {
    expect(isUniqueConstraintOn({ code: "P2002", meta: { target: ["email"] } }, "email")).toBe(
      true
    );
  });

  it("supports SQLite driver-adapter constraint metadata", () => {
    const error = {
      code: "P2002",
      meta: {
        driverAdapterError: {
          cause: { constraint: { fields: ["email"] } }
        }
      }
    };

    expect(isUniqueConstraintOn(error, "email")).toBe(true);
  });

  it("rejects unrelated errors and fields", () => {
    expect(isUniqueConstraintOn({ code: "P2025" }, "email")).toBe(false);
    expect(isUniqueConstraintOn({ code: "P2002", meta: { target: ["username"] } }, "email")).toBe(
      false
    );
  });
});

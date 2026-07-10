import { describe, expect, it } from "vitest";

import { isSessionVersionCurrent } from "./jwt-auth.guard";

describe("session version validation", () => {
  it("accepts only the current safe integer version", () => {
    expect(isSessionVersionCurrent({ sessionVersion: 2 }, 2)).toBe(true);
    expect(isSessionVersionCurrent({ sessionVersion: 1 }, 2)).toBe(false);
    expect(isSessionVersionCurrent({ sessionVersion: Number.NaN }, 2)).toBe(false);
  });
});

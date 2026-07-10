import { describe, expect, it } from "vitest";

import { resolveCorsOrigins } from "./cors-origins";

describe("resolveCorsOrigins", () => {
  it("denies unspecified production origins", () => {
    expect(resolveCorsOrigins("production", undefined)).toBe(false);
  });

  it("uses a narrow local development allowlist", () => {
    expect(resolveCorsOrigins("development", undefined)).toEqual([
      "http://localhost:3000",
      "http://127.0.0.1:3000"
    ]);
  });

  it("normalizes and deduplicates configured origins", () => {
    expect(resolveCorsOrigins("production", " https://app.test,https://app.test ")).toEqual([
      "https://app.test"
    ]);
  });
});

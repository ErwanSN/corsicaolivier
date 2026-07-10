import { describe, expect, it, vi } from "vitest";

import { resolveRequestId } from "./request-id";

const generatedId = "22222222-2222-4222-8222-222222222222";

describe("resolveRequestId", () => {
  it("propagates a valid UUID supplied by trusted infrastructure", () => {
    expect(resolveRequestId("11111111-1111-4111-8111-111111111111")).toBe(
      "11111111-1111-4111-8111-111111111111"
    );
  });

  it("replaces malformed or ambiguous identifiers", () => {
    const generate = vi.fn(() => generatedId);
    expect(resolveRequestId("attacker-controlled-value", generate)).toBe(generatedId);
    expect(resolveRequestId(["first", "second"], generate)).toBe(generatedId);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("generates an identifier when none is supplied", () => {
    expect(resolveRequestId(undefined, () => generatedId)).toBe(generatedId);
  });
});

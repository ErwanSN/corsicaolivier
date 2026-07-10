import { describe, expect, it } from "vitest";

import { formatControlTime } from "./control-history";

describe("formatControlTime", () => {
  it("formats recent and older controls in French", () => {
    const now = new Date("2026-07-10T12:00:00.000Z").getTime();
    expect(formatControlTime("2026-07-10T11:58:00.000Z", now)).toBe("il y a 2 minutes");
    expect(formatControlTime("2026-07-09T12:00:00.000Z", now)).toBe("hier");
  });
});

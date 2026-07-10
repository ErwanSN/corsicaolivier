import { TraceFlags } from "@opentelemetry/api";
import { describe, expect, it } from "vitest";

import { getActiveTraceContext } from "./trace-context";

describe("getActiveTraceContext", () => {
  it("retourne uniquement les identifiants W3C du span actif", () => {
    const spanContext = {
      isRemote: true,
      spanId: "1234567890abcdef",
      traceFlags: TraceFlags.SAMPLED,
      traceId: "1234567890abcdef1234567890abcdef"
    };

    expect(getActiveTraceContext(spanContext)).toEqual({
      spanId: "1234567890abcdef",
      traceId: "1234567890abcdef1234567890abcdef"
    });
    expect(getActiveTraceContext(undefined)).toBeNull();
  });
});

import { type ExecutionContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";

import { MetricsGuard, tokensMatch } from "./metrics.guard";

describe("MetricsGuard", () => {
  it("keeps local metrics available when no token is configured", () => {
    const guard = new MetricsGuard(new ConfigService({ NODE_ENV: "development" }));
    expect(guard.canActivate(contextWithAuthorization())).toBe(true);
  });

  it("requires the configured Bearer token in production", () => {
    const guard = new MetricsGuard(
      new ConfigService({ METRICS_TOKEN: "metrics-secret", NODE_ENV: "production" })
    );
    expect(guard.canActivate(contextWithAuthorization("Bearer wrong"))).toBe(false);
    expect(guard.canActivate(contextWithAuthorization("Bearer metrics-secret"))).toBe(true);
  });

  it("compares only equal-length, equal-value tokens", () => {
    expect(tokensMatch("secret", "secret")).toBe(true);
    expect(tokensMatch("short", "longer-secret")).toBe(false);
  });
});

function contextWithAuthorization(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { ...(authorization ? { authorization } : {}) } })
    })
  } as ExecutionContext;
}

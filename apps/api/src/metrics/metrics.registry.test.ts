import { describe, expect, it } from "vitest";

import { metricsRegistry, recordHttpRequest } from "./metrics.registry";

describe("HTTP metrics", () => {
  it("records bounded route, status and duration labels", async () => {
    recordHttpRequest("GET", "/api/health", 200, 12);

    const output = await metricsRegistry.metrics();
    expect(output).toContain(
      'corsica_api_http_requests_total{method="GET",route="/api/health",status="200"} 1'
    );
    expect(output).toContain("corsica_api_http_request_duration_seconds_bucket");
    expect(output).not.toContain("query=");
  });
});

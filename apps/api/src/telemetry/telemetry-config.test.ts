import { describe, expect, it } from "vitest";

import { resolveTelemetryConfig } from "./telemetry-config";

describe("resolveTelemetryConfig", () => {
  it("active la propagation locale sans exporter par défaut", () => {
    expect(resolveTelemetryConfig({})).toEqual({
      disabled: false,
      serviceName: "corsica-api"
    });
  });

  it("valide le collecteur et le nom de service", () => {
    expect(
      resolveTelemetryConfig({
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: " https://otel.example/v1/traces ",
        OTEL_SERVICE_NAME: "corsica-api-staging"
      })
    ).toEqual({
      disabled: false,
      endpoint: "https://otel.example/v1/traces",
      serviceName: "corsica-api-staging"
    });
    expect(() =>
      resolveTelemetryConfig({ OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "file:///tmp/traces" })
    ).toThrow(/HTTP ou HTTPS/);
  });
});

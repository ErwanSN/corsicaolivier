import { describe, expect, it } from "vitest";

import { validateRuntimeConfiguration } from "./runtime-config";

const productionConfiguration = {
  API_INSTANCE_COUNT: "1",
  API_PUBLIC_URL: "https://api.example.test",
  APP_PUBLIC_URL: "https://app.example.test",
  AUTH_JWT_SECRET: "a-secure-production-secret-with-32-characters",
  CORS_ORIGIN: "https://app.example.test",
  DATABASE_URL: "file:./prisma/production.db",
  METRICS_TOKEN: "a-secure-metrics-token-with-32-characters",
  NODE_ENV: "production"
} satisfies NodeJS.ProcessEnv;

describe("validateRuntimeConfiguration", () => {
  it("accepts a hardened single-instance production configuration", () => {
    expect(() => {
      validateRuntimeConfiguration(productionConfiguration);
    }).not.toThrow();
  });

  it("rejects weak secrets and insecure production origins", () => {
    expect(() => {
      validateRuntimeConfiguration({
        ...productionConfiguration,
        AUTH_JWT_SECRET: "change-me",
        CORS_ORIGIN: "http://example.test"
      });
    }).toThrow(/AUTH_JWT_SECRET.*CORS_ORIGIN/s);
  });

  it("rejects multiple API instances backed by SQLite", () => {
    expect(() => {
      validateRuntimeConfiguration({ ...productionConfiguration, API_INSTANCE_COUNT: "2" });
    }).toThrow(/API_INSTANCE_COUNT must be 1/);
  });

  it("rejects malformed operational settings in every environment", () => {
    expect(() => {
      validateRuntimeConfiguration({ API_PORT: "70000", TRUST_PROXY: "sometimes" });
    }).toThrow(/API_PORT.*TRUST_PROXY/s);
  });
});

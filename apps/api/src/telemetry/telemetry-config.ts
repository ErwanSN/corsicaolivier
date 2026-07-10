export type TelemetryConfig = Readonly<{
  disabled: boolean;
  endpoint?: string;
  serviceName: string;
}>;

export function resolveTelemetryConfig(
  environment: NodeJS.ProcessEnv = process.env
): TelemetryConfig {
  const endpoint = normalizeEndpoint(environment.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT);
  const configuredServiceName = environment.OTEL_SERVICE_NAME?.trim();
  return {
    disabled: environment.OTEL_SDK_DISABLED === "true",
    ...(endpoint ? { endpoint } : {}),
    serviceName: configuredServiceName?.length ? configuredServiceName : "corsica-api"
  };
}

function normalizeEndpoint(endpoint: string | undefined): string | undefined {
  const value = endpoint?.trim();
  if (!value) return undefined;
  const parsed = new URL(value);
  if (!new Set(["http:", "https:"]).has(parsed.protocol)) {
    throw new Error("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT doit utiliser HTTP ou HTTPS.");
  }
  return parsed.href;
}

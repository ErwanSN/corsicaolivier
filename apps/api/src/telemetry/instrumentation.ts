import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { NoopSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { PrismaInstrumentation } from "@prisma/instrumentation";

import { resolveTelemetryConfig } from "./telemetry-config";

const configuration = resolveTelemetryConfig();
const sdk = configuration.disabled
  ? null
  : new NodeSDK({
      ...(configuration.endpoint
        ? { traceExporter: new OTLPTraceExporter({ url: configuration.endpoint }) }
        : { spanProcessors: [new NoopSpanProcessor()] }),
      instrumentations: [
        new PrismaInstrumentation(),
        getNodeAutoInstrumentations({
          "@opentelemetry/instrumentation-fs": { enabled: false }
        })
      ],
      serviceName: configuration.serviceName
    });

sdk?.start();

export async function shutdownTelemetry(): Promise<void> {
  await sdk?.shutdown();
}

import { collectDefaultMetrics, Counter, Histogram, Registry } from "prom-client";

export const metricsRegistry = new Registry();

collectDefaultMetrics({ prefix: "corsica_api_", register: metricsRegistry });

const httpRequests = new Counter({
  help: "Total number of completed HTTP requests.",
  labelNames: ["method", "route", "status"] as const,
  name: "corsica_api_http_requests_total",
  registers: [metricsRegistry]
});

const httpRequestDuration = new Histogram({
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  help: "HTTP request duration in seconds.",
  labelNames: ["method", "route", "status"] as const,
  name: "corsica_api_http_request_duration_seconds",
  registers: [metricsRegistry]
});

export function recordHttpRequest(
  method: string,
  route: string,
  status: number,
  durationMilliseconds: number
): void {
  const labels = { method, route, status: String(status) };
  httpRequests.inc(labels);
  httpRequestDuration.observe(labels, durationMilliseconds / 1000);
}

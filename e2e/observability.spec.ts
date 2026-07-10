import { expect, test } from "@playwright/test";

const apiUrl = "http://localhost:3001/api";
const propagatedId = "11111111-1111-4111-8111-111111111111";
const propagatedTraceId = "1234567890abcdef1234567890abcdef";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test("l’API corrèle les requêtes et expose des métriques Prometheus", async ({ request }) => {
  const propagated = await request.get(`${apiUrl}/health`, {
    headers: {
      traceparent: `00-${propagatedTraceId}-1234567890abcdef-01`,
      "X-Request-Id": propagatedId
    }
  });
  expect(propagated.headers()["x-request-id"]).toBe(propagatedId);
  expect(propagated.headers()["x-trace-id"]).toBe(propagatedTraceId);

  const replaced = await request.get(`${apiUrl}/health`, {
    headers: { "X-Request-Id": "untrusted-log-value" }
  });
  expect(replaced.headers()["x-request-id"]).toMatch(uuidPattern);
  expect(replaced.headers()["x-trace-id"]).toMatch(/^[0-9a-f]{32}$/);

  const metrics = await request.get(`${apiUrl}/metrics`);
  expect(metrics.status()).toBe(200);
  expect(metrics.headers()["cache-control"]).toBe("no-store");
  const body = await metrics.text();
  expect(body).toContain("corsica_api_http_requests_total");
  expect(body).toContain("corsica_api_http_request_duration_seconds_bucket");
});

import { apiErrorSchema } from "@corsica/contracts";
import { expect, test, type APIResponse } from "@playwright/test";

const apiUrl = "http://localhost:3001/api";

test("toutes les erreurs API utilisent l’enveloppe corrélée", async ({ request }) => {
  const validation = await request.post(`${apiUrl}/v1/auth/web/login`, { data: {} });
  await expectApiError(validation, 400, "REQUEST_VALIDATION_FAILED");

  const unauthorized = await request.post(`${apiUrl}/v1/auth/web/login`, {
    data: { identifier: "unknown@example.test", password: "incorrect-password" }
  });
  await expectApiError(unauthorized, 401, "AUTH_INVALID_CREDENTIALS");

  const missing = await request.get(`${apiUrl}/route-that-does-not-exist`);
  const missingError = await expectApiError(missing, 404, "ROUTE_NOT_FOUND");
  expect(missingError.message).not.toContain("route-that-does-not-exist");
});

async function expectApiError(response: APIResponse, status: number, code: string) {
  expect(response.status()).toBe(status);
  const parsed = apiErrorSchema.parse(await response.json());
  expect(parsed.code).toBe(code);
  expect(response.headers()["x-request-id"]).toBe(parsed.requestId);
  return parsed;
}

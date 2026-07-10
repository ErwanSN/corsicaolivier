import { apiErrorSchema } from "@corsica/contracts";
import { expect, test } from "@playwright/test";

const apiUrl = "http://localhost:3001/api/v1/auth";

test("les connexions ont un quota dédié sans bloquer les lectures publiques", async ({
  request
}) => {
  const identifier = `rate-${crypto.randomUUID()}@example.test`;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await request.post(`${apiUrl}/web/login`, {
      data: { identifier, password: "incorrect-password" }
    });
    expect(response.status()).toBe(401);
  }

  const blocked = await request.post(`${apiUrl}/login`, {
    data: { identifier: identifier.toUpperCase(), password: "incorrect-password" }
  });
  expect(blocked.status()).toBe(429);
  const error = apiErrorSchema.parse(await blocked.json());
  expect(error.code).toBe("AUTH_RATE_LIMIT_EXCEEDED");
  expect(blocked.headers()["retry-after"]).toBeTruthy();
  expect(blocked.headers()["x-request-id"]).toBe(error.requestId);

  const publicRead = await request.get("http://localhost:3001/api/v1/port-map");
  expect(publicRead.status()).toBe(200);
});

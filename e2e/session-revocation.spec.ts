import { apiErrorSchema, authSessionSchema } from "@corsica/contracts";
import { expect, test } from "@playwright/test";

const apiUrl = "http://localhost:3001/api/v1/auth";
const currentPassword = "Corsica-Current-2026!";
const newPassword = "Corsica-New-2026!";
const webOrigin = { Origin: "http://localhost:3000" };

test("un changement de mot de passe révoque les anciens jetons et renouvelle le cookie", async ({
  request
}) => {
  const email = `revoke-${crypto.randomUUID()}@example.test`;
  const registration = await request.post(`${apiUrl}/register`, {
    data: { email, password: currentPassword }
  });
  const initialSession = authSessionSchema.parse(await registration.json());

  const changed = await request.patch(`${apiUrl}/password`, {
    data: { currentPassword, newPassword },
    headers: { Authorization: `Bearer ${initialSession.accessToken}` }
  });
  expect(changed.status()).toBe(204);
  expect(changed.headers()["set-cookie"]).toContain("HttpOnly");

  const staleToken = await request.get(`${apiUrl}/me`, {
    headers: { Authorization: `Bearer ${initialSession.accessToken}` }
  });
  expect(staleToken.status()).toBe(401);
  expect(apiErrorSchema.parse(await staleToken.json()).code).toBe("AUTH_INVALID_TOKEN");

  const renewedCookie = await request.get(`${apiUrl}/me`);
  expect(renewedCookie.status()).toBe(200);

  const oldPassword = await request.post(`${apiUrl}/login`, {
    data: { identifier: email, password: currentPassword },
    headers: webOrigin
  });
  expect(oldPassword.status()).toBe(401);

  const login = await request.post(`${apiUrl}/login`, {
    data: { identifier: email, password: newPassword },
    headers: webOrigin
  });
  const nextSession = authSessionSchema.parse(await login.json());
  expect(nextSession.accessToken).not.toBe(initialSession.accessToken);
  const currentToken = await request.get(`${apiUrl}/me`, {
    headers: { Authorization: `Bearer ${nextSession.accessToken}` }
  });
  expect(currentToken.status()).toBe(200);
});

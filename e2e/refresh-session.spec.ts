import { apiErrorSchema, authSessionSchema } from "@corsica/contracts";
import { expect, test } from "@playwright/test";

const authUrl = "http://localhost:3001/api/v1/auth";
const originHeaders = { Origin: "http://localhost:3000" };

test("la rotation interdit le rejeu et révoque toute la famille compromise", async ({
  request
}) => {
  const email = `rotation-${crypto.randomUUID()}@example.test`;
  const password = "Corsica-Rotation-2026!";
  const registration = await request.post(`${authUrl}/register`, {
    data: { email, password },
    headers: originHeaders
  });
  const initial = authSessionSchema.parse(await registration.json());

  const rotatedResponse = await request.post(`${authUrl}/refresh`, {
    data: { refreshToken: initial.refreshToken },
    headers: originHeaders
  });
  expect(rotatedResponse.status()).toBe(201);
  const rotated = authSessionSchema.parse(await rotatedResponse.json());
  expect(rotated.refreshToken).not.toBe(initial.refreshToken);
  expect(rotated.accessToken).not.toBe(initial.accessToken);

  const replay = await request.post(`${authUrl}/refresh`, {
    data: { refreshToken: initial.refreshToken },
    headers: originHeaders
  });
  expect(replay.status()).toBe(401);
  expect(apiErrorSchema.parse(await replay.json()).code).toBe("AUTH_INVALID_REFRESH_TOKEN");

  const compromisedFamily = await request.get(`${authUrl}/me`, {
    headers: { Authorization: `Bearer ${rotated.accessToken}` }
  });
  expect(compromisedFamily.status()).toBe(401);
  expect(apiErrorSchema.parse(await compromisedFamily.json()).code).toBe("AUTH_INVALID_TOKEN");
});

test("la déconnexion révoque immédiatement la session mobile", async ({ request }) => {
  const email = `logout-${crypto.randomUUID()}@example.test`;
  const registration = await request.post(`${authUrl}/register`, {
    data: { email, password: "Corsica-Logout-2026!" },
    headers: originHeaders
  });
  const session = authSessionSchema.parse(await registration.json());

  const logout = await request.post(`${authUrl}/logout`, {
    data: { refreshToken: session.refreshToken },
    headers: originHeaders
  });
  expect(logout.status()).toBe(204);

  const access = await request.get(`${authUrl}/me`, {
    headers: { Authorization: `Bearer ${session.accessToken}` }
  });
  expect(access.status()).toBe(401);

  const refresh = await request.post(`${authUrl}/refresh`, {
    data: { refreshToken: session.refreshToken },
    headers: originHeaders
  });
  expect(refresh.status()).toBe(401);
});

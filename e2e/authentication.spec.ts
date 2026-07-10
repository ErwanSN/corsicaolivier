import { expect, test } from "@playwright/test";

const email = "e2e.client@corsica.local";
const password = "Corsica-E2E-2026!";

test.beforeAll(async ({ request }) => {
  const response = await request.post("http://localhost:3001/api/v1/auth/register", {
    data: { email, password }
  });

  expect([201, 409]).toContain(response.status());
});

test("un client se connecte par cookie et accède à sa sécurité", async ({ page }) => {
  await page.goto("/compte");
  await page.getByLabel("Email ou nom d'utilisateur").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  const loginResponse = page.waitForResponse((response) =>
    response.url().endsWith("/api/v1/auth/web/login")
  );
  await page.getByRole("button", { name: "Se connecter" }).click();

  const loginPayload = (await (await loginResponse).json()) as Record<string, unknown>;
  expect(loginPayload).not.toHaveProperty("accessToken");
  expect(loginPayload).not.toHaveProperty("tokenType");

  await expect(page.getByRole("heading", { name: "Compte client" })).toBeVisible();
  await expect(page.getByText("Modifier mon mot de passe")).toBeVisible();
  const sessionCookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === "corsica_session"
  );
  expect(sessionCookie).toMatchObject({ httpOnly: true, sameSite: "Strict" });
  await expect(
    page.evaluate(() => window.localStorage.getItem("corsica.auth.accessToken"))
  ).resolves.toBeNull();
});

import { execSync } from "node:child_process";

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const apiUrl = "http://localhost:3001/api/v1";
const employeeEmail = "e2e.employee@corsica.local";
const clientEmail = "e2e.client.dossiers@corsica.local";
const password = "Corsica-Staff-E2E-2026!";

test.beforeAll(async ({ request }) => {
  await ensureAccount(request, employeeEmail);
  execSync(`pnpm --filter @corsica/api promote ${employeeEmail} EMPLOYEE`, { stdio: "ignore" });
});

test("un visiteur est renvoyé vers la connexion", async ({ page }) => {
  await page.goto("/salarie/rechercher");
  await expect(page).toHaveURL(/\/compte$/);
});

test("les dossiers refusent les visiteurs et les comptes clients", async ({ request }) => {
  const path = `${apiUrl}/dossiers/search?field=telephone&query=06`;
  expect((await request.get(path)).status()).toBe(401);

  await ensureAccount(request, clientEmail);
  const login = await request.post(`${apiUrl}/auth/login`, {
    data: { identifier: clientEmail, password }
  });
  if (!login.ok()) throw new Error(`Client login failed: ${await login.text()}`);
  const { accessToken } = (await login.json()) as { accessToken: string };
  expect(
    (
      await request.get(path, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
    ).status()
  ).toBe(403);
});

test("un employé recherche et ouvre un dossier persisté", async ({ page }) => {
  await login(page, employeeEmail);
  await page.getByLabel("Saisissez le n° de téléphone").fill("0675561134");
  const result = page.getByRole("link", { name: /Dossier n° 9362049/ });
  await expect(result).toBeVisible();
  await result.click();
  await expect(page).toHaveURL(/\/salarie\/dossier\/93620490-0000-4000-8000-000000000001$/);
  await expect(page.getByRole("heading", { name: "Dossier n° 9362049" })).toBeVisible();
  await expect(page.getByText("Jeanne Delavoi")).toBeVisible();
});

async function ensureAccount(request: APIRequestContext, email: string): Promise<void> {
  const registration = await request.post(`${apiUrl}/auth/register`, {
    data: { email, password }
  });
  expect([201, 409]).toContain(registration.status());
  execSync(`pnpm --filter @corsica/api set-password ${email} ${password}`, { stdio: "ignore" });
}

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/compte");
  await page.getByLabel("Email ou nom d'utilisateur").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/salarie\/rechercher$/);
}

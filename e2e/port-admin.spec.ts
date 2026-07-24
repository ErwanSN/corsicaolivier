import { execSync } from "node:child_process";

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const apiUrl = "http://localhost:3001/api/v1";
const email = "e2e.admin@corsica.local";
const password = "Corsica-Admin-E2E-2026!";
const controlPointId = "87b52a0c-8cd6-4b03-8a0f-72292643b059";
const shipPointId = "0245e32d-a900-48d7-9bc8-e564313fbad2";
const routeId = "42cf4f17-8530-4594-a1dd-60c948a31346";
const fixtureConfig = {
  points: [
    {
      coordinates: [43.3074, 5.3575],
      id: controlPointId,
      label: "Contrôle E2E",
      type: "control"
    },
    {
      coordinates: [43.3102, 5.3522],
      id: shipPointId,
      label: "Navire E2E",
      type: "ship"
    }
  ],
  routes: [
    {
      geometry: [
        [43.3074, 5.3575],
        [43.3102, 5.3522]
      ],
      id: routeId,
      label: "Embarquement E2E",
      pointIds: [controlPointId, shipPointId],
      shipPointId
    }
  ],
  version: 3
} as const;

let adminToken = "";
let originalConfig: unknown;

test.beforeAll(async ({ request }) => {
  await ensureAdminAccount(request);
  const login = await request.post(`${apiUrl}/auth/login`, {
    data: { identifier: email, password }
  });
  expect(login.ok()).toBe(true);
  const session = (await login.json()) as { accessToken: string };
  adminToken = session.accessToken;

  const current = await request.get(`${apiUrl}/port-map`);
  expect(current.ok()).toBe(true);
  originalConfig = await current.json();
  await putConfiguration(request, fixtureConfig);
});

test.afterAll(async ({ request }) => {
  if (adminToken && originalConfig) await putConfiguration(request, originalConfig);
});

test("un administrateur déplace un point, recalcule et persiste l’itinéraire", async ({ page }) => {
  await page.goto("/salarie/connexion");
  await page.getByLabel("Email ou nom d'utilisateur").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/salarie\/rechercher$/);

  await page.goto("/port/admin");
  await expect(page.getByRole("heading", { name: "Configurer le guidage" })).toBeVisible();
  const routePath = page.locator(".leaflet-overlay-pane path").last();
  const geometryBefore = await routePath.getAttribute("d");
  const marker = page.locator('.leaflet-marker-icon[title="Contrôle E2E"]');
  const markerBox = await marker.boundingBox();
  expect(markerBox).not.toBeNull();
  if (!markerBox) return;

  await page.mouse.move(markerBox.x + markerBox.width / 2, markerBox.y + markerBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    markerBox.x + markerBox.width / 2 + 48,
    markerBox.y + markerBox.height / 2 + 24,
    {
      steps: 8
    }
  );
  await page.mouse.up();
  await expect(routePath).not.toHaveAttribute("d", geometryBefore ?? "");

  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page).toHaveURL(/\/port$/);

  const persisted = await page.request.get(`${apiUrl}/port-map`);
  const config = (await persisted.json()) as typeof fixtureConfig;
  expect(config.points.find(({ id }) => id === controlPointId)?.coordinates).not.toEqual(
    fixtureConfig.points[0].coordinates
  );
  expect(config.routes[0].geometry[0]).toEqual(
    config.points.find(({ id }) => id === controlPointId)?.coordinates
  );
});

test("les changements restent transactionnels jusqu’à un enregistrement explicite", async ({
  page
}) => {
  await loginAsAdmin(page);
  await page.goto("/port/admin");
  const saveButton = page.getByRole("button", { name: "Enregistrer" });
  const resetButton = page.getByRole("button", { name: "Réinitialiser le brouillon" });
  await expect(saveButton).toBeDisabled();
  await expect(resetButton).toBeDisabled();

  await page.getByLabel("Latitude de Contrôle E2E").fill("43.308");
  await expect(saveButton).toBeEnabled();
  await resetButton.click();
  const confirmation = page.getByRole("dialog", { name: "Réinitialiser le brouillon ?" });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByText("Contrôle E2E", { exact: true })).toBeVisible();

  await resetButton.click();
  await confirmation.getByRole("button", { name: "Réinitialiser", exact: true }).click();
  await expect(page.getByText("Aucun point placé.")).toBeVisible();
  await expect(saveButton).toBeEnabled();

  const persisted = await page.request.get(`${apiUrl}/port-map`);
  const config = (await persisted.json()) as typeof fixtureConfig;
  expect(config.points.length).toBeGreaterThan(0);
});

async function ensureAdminAccount(request: APIRequestContext): Promise<void> {
  const registration = await request.post(`${apiUrl}/auth/register`, { data: { email, password } });
  expect([201, 409]).toContain(registration.status());
  execSync(`pnpm --filter @corsica/api promote ${email} ADMIN`, { stdio: "ignore" });
}

async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/salarie/connexion");
  await page.getByLabel("Email ou nom d'utilisateur").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/salarie\/rechercher$/);
}

async function putConfiguration(request: APIRequestContext, data: unknown): Promise<void> {
  const response = await request.put(`${apiUrl}/port-map`, {
    data,
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  expect(response.ok()).toBe(true);
}

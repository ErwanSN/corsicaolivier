import { expect, test } from "@playwright/test";

test("la page d'accueil expose une navigation et un contenu principal", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("la carte du port se charge sans contrôles cartographiques parasites", async ({ page }) => {
  await page.goto("/port");

  await expect(page.getByText("Chargement de la carte du port…")).toBeHidden();
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator(".leaflet-control-zoom")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Leaflet" })).toHaveCount(0);
});

test("l'administration du port refuse explicitement un visiteur", async ({ page }) => {
  await page.goto("/port/admin");

  await expect(page.getByRole("heading", { name: "Accès administrateur requis" })).toBeVisible();
});

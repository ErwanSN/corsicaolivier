import { expect, test } from "@playwright/test";

test("la page d'accueil expose une navigation et un contenu principal", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("la recherche de traversée reste dans le parcours de réservation interne", async ({
  page
}) => {
  await page.goto("/");

  const search = page.getByRole("search", { name: "Rechercher une traversée" });
  await expect(search).toHaveAttribute("action", "/reservation");
  await expect(page.getByRole("combobox", { name: "Traversée" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Date aller" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retour (facultatif)" })).toBeDisabled();
  await expect(page.getByText(/Réserver sur le site officiel/i)).toHaveCount(0);

  await page.getByRole("button", { name: "Rechercher" }).click();
  await expect(page.getByText("Choisissez une traversée et une date aller.")).toBeVisible();

  const routeTrigger = page.getByRole("combobox", { name: "Traversée" });
  const routeTriggerBox = await routeTrigger.boundingBox();
  await routeTrigger.click();
  const routeDropdownBox = await page.getByRole("listbox").boundingBox();
  expect(routeTriggerBox).not.toBeNull();
  expect(routeDropdownBox).not.toBeNull();
  expect((routeDropdownBox?.y ?? 0) + (routeDropdownBox?.height ?? 0)).toBeLessThan(
    routeTriggerBox?.y ?? 0
  );
  await page.getByRole("option", { name: "Marseille → Ajaccio" }).click();
  await page.getByRole("button", { name: "Date aller" }).click();
  const selectedDay = page.locator(".rdp-month_grid button:not([disabled])").first();
  await selectedDay.click();
  await expect(search.locator('input[name="depart"]')).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
  await expect(page.getByRole("button", { name: "Retour (facultatif)" })).toBeEnabled();
  await page.getByRole("button", { name: "Rechercher" }).click();

  await expect(page).toHaveURL(/\/reservation\?route=mrs-aja/);
  await expect(page.getByRole("heading", { name: "Construisons votre voyage" })).toBeVisible();
  await expect(page.getByText("Marseille → Ajaccio")).toBeVisible();
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

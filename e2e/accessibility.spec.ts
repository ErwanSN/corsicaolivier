import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const pageDefinition of [
  { path: "/", title: /Corsica Linea/i },
  { path: "/compte", title: /Compte \| Corsica Linea/i },
  { path: "/port", title: /Se repérer au port/i },
  { path: "/port/admin", title: /Administration du port/i }
] as const) {
  test(`${pageDefinition.path} respecte WCAG A et AA`, async ({ page }) => {
    await page.goto(pageDefinition.path);
    await expect(page).toHaveTitle(pageDefinition.title);
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();

    expect(results.violations).toEqual([]);
  });
}

import { expect, test } from "@playwright/test";

const production = Boolean(process.env.CI);
const budgets = production
  ? { domContentLoaded: 2_500, javascriptBytes: 900_000, requests: 50, totalBytes: 2_000_000 }
  : { domContentLoaded: 10_000, javascriptBytes: 6_000_000, requests: 100, totalBytes: 12_000_000 };

test("la page d’accueil respecte les budgets de livraison front-end", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const bytesFor = (initiatorType?: string) =>
      resources
        .filter((resource) => !initiatorType || resource.initiatorType === initiatorType)
        .reduce((total, resource) => total + resource.encodedBodySize, 0);

    return {
      domContentLoaded: navigation.domContentLoadedEventEnd,
      domNodes: document.querySelectorAll("*").length,
      javascriptBytes: bytesFor("script"),
      requests: resources.length,
      totalBytes: bytesFor()
    };
  });

  expect(metrics.domContentLoaded).toBeLessThan(budgets.domContentLoaded);
  expect(metrics.domNodes).toBeLessThan(1_500);
  expect(metrics.javascriptBytes).toBeLessThan(budgets.javascriptBytes);
  expect(metrics.requests).toBeLessThan(budgets.requests);
  expect(metrics.totalBytes).toBeLessThan(budgets.totalBytes);
});

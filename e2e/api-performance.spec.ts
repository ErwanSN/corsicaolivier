import { expect, test } from "@playwright/test";

const apiHealthUrl = "http://localhost:3001/api/health";
const requestCount = 40;
const concurrency = 5;
const p95BudgetMilliseconds = process.env.CI ? 150 : 400;

test("l’API reste disponible et réactive sous concurrence contrôlée", async ({ request }) => {
  const durations: number[] = [];
  const statuses: number[] = [];

  for (let index = 0; index < 3; index += 1) {
    expect((await request.get(apiHealthUrl)).status()).toBe(200);
  }

  for (let offset = 0; offset < requestCount; offset += concurrency) {
    const batch = Array.from({ length: concurrency }, async () => {
      const startedAt = performance.now();
      const response = await request.get(apiHealthUrl);
      durations.push(performance.now() - startedAt);
      statuses.push(response.status());
    });
    await Promise.all(batch);
  }

  const sortedDurations = [...durations].sort((left, right) => left - right);
  const p95Index = Math.ceil(sortedDurations.length * 0.95) - 1;
  const p95 = sortedDurations[p95Index];

  expect(statuses).toHaveLength(requestCount);
  expect(statuses.every((status) => status === 200)).toBe(true);
  expect(p95).toBeLessThan(p95BudgetMilliseconds);
});

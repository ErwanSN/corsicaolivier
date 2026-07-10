import { expect, test } from "@playwright/test";

test("le frontend applique une politique navigateur restrictive sans casser la carte", async ({
  page,
  request
}) => {
  const response = await request.get("/");
  const headers = response.headers();
  const policy = headers["content-security-policy"];

  expect(policy).toContain("default-src 'self'");
  expect(policy).toContain("object-src 'none'");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).toContain("https://*.basemaps.cartocdn.com");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  if (process.env.CI) {
    expect(policy).not.toContain("'unsafe-eval'");
    expect(headers["strict-transport-security"]).toContain("max-age=63072000");
  }

  const violations: string[] = [];
  page.on("console", (message) => {
    if (message.text().toLowerCase().includes("content security policy")) {
      violations.push(message.text());
    }
  });
  await page.goto("/port");
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect.poll(() => violations).toEqual([]);
});

import { defineConfig, devices } from "@playwright/test";

const isCi = Boolean(process.env.CI);

export default defineConfig({
  expect: { timeout: 10_000 },
  forbidOnly: isCi,
  fullyParallel: false,
  outputDir: "test-results/playwright",
  reporter: isCi ? [["github"], ["html", { open: "never" }]] : "list",
  retries: isCi ? 2 : 0,
  testDir: "./e2e",
  timeout: 30_000,
  workers: 2,
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure"
  },
  webServer: [
    {
      command: isCi ? "pnpm --filter @corsica/api start" : "pnpm --filter @corsica/api dev",
      reuseExistingServer: !isCi,
      timeout: 120_000,
      url: "http://localhost:3001/api/health"
    },
    {
      command: isCi ? "pnpm --filter @corsica/web start" : "pnpm --filter @corsica/web dev",
      reuseExistingServer: !isCi,
      timeout: 120_000,
      url: "http://localhost:3000"
    }
  ],
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.platform === "win32" ? { channel: "msedge" } : {})
      }
    },
    {
      name: "mobile",
      testMatch: /public-pages\.spec\.ts/,
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        ...(process.platform === "win32" ? { channel: "msedge" } : {})
      }
    },
    {
      name: "firefox",
      testMatch: /(accessibility|public-pages|security-headers)\.spec\.ts/,
      use: { ...devices["Desktop Firefox"] }
    }
  ]
});

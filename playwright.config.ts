import { defineConfig } from "@playwright/test";
const production = process.env.E2E_PRODUCTION === "true";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: production ? "production.spec.ts" : "product.spec.ts",
  timeout: 90000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: production ? "npm start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      APP_ORIGIN: "http://localhost:3000",
      LOCAL_DEMO: production ? "false" : "true",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
  outputDir: "test-results",
});

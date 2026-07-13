import { defineConfig, devices } from "@playwright/test";

const externalBaseURL = process.env.PLAYWRIGHT_TEST_BASE_URL;
const localPort = process.env.PLAYWRIGHT_LOCAL_PORT ?? "4321";
const baseURL = externalBaseURL || `http://127.0.0.1:${localPort}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }], ["list"]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] }
    },
    {
      name: "tablet",
      use: { browserName: "chromium", viewport: { width: 768, height: 1024 } }
    },
    {
      name: "desktop",
      use: { browserName: "chromium", viewport: { width: 1440, height: 960 } }
    }
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        command: `npm run preview -- --host 127.0.0.1 --port ${localPort}`,
        url: baseURL,
        reuseExistingServer: false
      }
});

import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results-connected",
  testMatch: "**/connected.spec.ts",
  timeout: 45000,
  workers: 1,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:5174",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "VITE_DEFAULT_ROOM_ID=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa VITE_USE_EMULATORS=true npm run dev -- --port 5174",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: false,
  },
});

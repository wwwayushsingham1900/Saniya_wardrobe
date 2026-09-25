import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: process.env.FIREBASE_DATABASE_EMULATOR_HOST
      ? ["tests/rules.integration.ts"]
      : ["tests/**/*.test.ts"],
    testTimeout: 15000,
  },
});

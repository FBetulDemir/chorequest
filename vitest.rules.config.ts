import { defineConfig } from "vitest/config";
import path from "node:path";

// Security rules tests run against the Firestore emulator: `npm run test:rules`
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    include: ["tests/rules/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});

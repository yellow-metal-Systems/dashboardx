import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    testTimeout: 20_000,
    // One file at a time: the *.db.test.ts files share TEST_DATABASE_URL and each
    // truncates it, so running them in parallel let one wipe the other's rows
    // mid-test ("new customer" failed only in a full run, never alone).
    fileParallelism: false,
  },
});

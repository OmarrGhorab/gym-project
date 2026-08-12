import { defineConfig } from "vitest/config";

import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Server Component modules guard themselves with `server-only`, which
      // throws outside a React server build. Stub it so their pure helpers stay
      // testable; it has no runtime behaviour of its own.
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    // Server modules read this at import time and throw without it. Tests never
    // reach the network, so any well-formed URL does.
    env: {
      API_BASE_URL: "https://api.example.test",
    },
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    maxWorkers: 1,
    pool: "forks",
    setupFiles: ["./src/test/setup.ts"],
  },
});

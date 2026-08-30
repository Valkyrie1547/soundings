import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests run in node by default. A file that needs a DOM starts with
// `// @vitest-environment jsdom`.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    restoreMocks: true,
    unstubEnvs: true,
    // Thresholds sit two points under what the suite reaches, so the gate
    // catches a real drop and does not break on one refactor.
    coverage: {
      provider: "v8",
      thresholds: { statements: 86, branches: 84, functions: 84, lines: 87 },
    },
  },
});

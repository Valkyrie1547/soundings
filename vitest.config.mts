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
  },
});

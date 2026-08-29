import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // The cyclomatic complexity gate. See CLAUDE.md for the threshold table.
      // 1 to 5 is fine. 6 to 10 is the watch band. `npm run lint:complexity` reports it.
      // 11 and above fails lint. Refactor the function.
      complexity: ["error", { max: 10 }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

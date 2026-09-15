/**
 * ESLINT_CONFIG
 *
 * Purpose: Enforces Next.js, TypeScript, and repository code-quality constraints consistently.
 * Connections: ESLint CLI, Next.js conventions, and repository quality gates.
 * Risk: Medium because rule changes can permit or reject repository-wide patterns.
 */
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    rules: {
      complexity: ["error", 7],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "dist/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

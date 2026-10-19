import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Plain Node scripts
    "scripts/**",
    // Native projects and build output (contain copies of the built web app)
    "android/**",
    "ios/**",
    // Cloud Functions have their own package and build
    "functions/**",
  ]),
]);

export default eslintConfig;

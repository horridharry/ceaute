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

    // Design reference bundle, not application source. The .dc.html prototypes
    // ship a vendored viewer script (designs/support.js) that is not ours to
    // fix and never runs in the product.
    "design_handoff_ceaute_mvp/**",
  ]),
]);

export default eslintConfig;

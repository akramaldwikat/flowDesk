import { defineConfig, globalIgnores } from "eslint/config";
import ts from "typescript-eslint";
import next from "eslint-config-next/core-web-vitals";
export default defineConfig([
  globalIgnores([
    "**/dist/**",
    "**/.next/**",
    "**/node_modules/**",
    "**/next-env.d.ts",
  ]),
  ...ts.configs.recommended,
  ...next.map((c) => ({ ...c, files: ["apps/web/**/*.{ts,tsx}"] })),
  { settings: { next: { rootDir: "apps/web/" } } },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
]);

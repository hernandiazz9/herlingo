import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The app bundle stays free of server code and runtime zod (content/schema.ts is for scripts).
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/content/schema.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "zod", allowTypeImports: true, message: "src/ never imports zod at runtime." },
            { name: "@anthropic-ai/sdk", message: "Server only (api/)." },
            { name: "@upstash/redis", message: "Server only (api/)." },
          ],
          patterns: [{ group: ["**/api/**"], message: "src/ never imports server code from api/." }],
        },
      ],
    },
  },
  globalIgnores([
    ".claude/**",
    ".next/**",
    ".vercel/**",
    "node_modules/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

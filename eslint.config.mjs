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
  {
    // Speech recognition goes through the one engine (docs/speech.md): only src/lib/speech/ may
    // touch SpeechRecognition / webkitSpeechRecognition (globals, `window.…`, `"…" in window`, types).
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/speech/**"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "SpeechRecognition", message: "Use useListen / createListenSession (docs/speech.md)." },
        { name: "webkitSpeechRecognition", message: "Use useListen / createListenSession (docs/speech.md)." },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "Identifier[name=/^(webkit)?SpeechRecognition/]",
          message: "Only src/lib/speech/ touches SpeechRecognition: use useListen / createListenSession (docs/speech.md).",
        },
        {
          selector: "Literal[value=/^(webkit)?SpeechRecognition/]",
          message: "Only src/lib/speech/ touches SpeechRecognition: use useListen / createListenSession (docs/speech.md).",
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

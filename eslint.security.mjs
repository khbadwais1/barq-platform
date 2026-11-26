// SAST (G08): قواعد أمان فقط على كود النظام وكود العرض — تُشغَّل من scripts/quality-gates.mjs
import security from "eslint-plugin-security";
import tsParser from "@typescript-eslint/parser";

const config = [
  { ignores: ["node_modules/**", ".next/**", ".pgdata/**", "demo/barq-demo.html", "demo/fonts/**"] },
  {
    files: ["src/**/*.{ts,tsx}", "scripts/**/*.mjs", "demo/src/**/*.js"],
    languageOptions: { parser: tsParser, ecmaVersion: "latest", sourceType: "module" },
    plugins: { security },
    rules: {
      // أخطاء حرجة: تمنع الدمج
      "security/detect-eval-with-expression": "error",
      "security/detect-non-literal-require": "error",
      "security/detect-pseudoRandomBytes": "error",
      "security/detect-buffer-noassert": "error",
      "security/detect-new-buffer": "error",
      "security/detect-disable-mustache-escape": "error",
      "security/detect-bidi-characters": "error",
      "security/detect-child-process": "error",
      "security/detect-unsafe-regex": "error",
      // تحذيرات تُراجع يدويًا
      "security/detect-possible-timing-attacks": "warn",
      "security/detect-non-literal-regexp": "warn",
      "security/detect-non-literal-fs-filename": "warn",
    },
  },
];

export default config;

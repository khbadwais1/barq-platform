// فحص الكود (G02) — صيغة الإعداد الجديدة في ESLint 9 / Next.js 16
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import security from "eslint-plugin-security";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // قواعد الأمان معرّفة هنا حتى تُقبل تعليقات الاستثناء؛ تُفعّل في eslint.security.mjs (G08)
  { plugins: { security } },
  globalIgnores([
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // نسخة العرض ملف مستقل بلغة JavaScript وتُفحص ببوابة خاصة (node --check + اختباراتها) — انظر TESTING.md
    "demo/**",
    ".pgdata/**",
    "reports/**",
  ]),
]);

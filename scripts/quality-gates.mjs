// بوابات الجودة حسب معايير 3 TECH v1.4 — مستوى الإلزام T3
// التشغيل: npm run gates   (يكتب reports/gates-latest.md ويخرج بـ 1 إذا فشلت بوابة مطلوبة)
// ملاحظة: حزمة 3 TECH الرسمية (.3tech/check.py) غير مثبتة؛ هذا السكربت يطبّق البوابات يدويًا ويُستبدل بها عند تثبيتها.
// eslint-disable-next-line security/detect-child-process -- أداة تطوير تشغّل أوامر ثابتة ولا تُشحن مع التطبيق (SECURITY.md)
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";

const TIER = "T3";
const results = [];
const now = new Date();
const sh = (cmd, opts = {}) => {
  const r = spawnSync(cmd, { shell: true, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });
  return { code: r.status ?? 1, out: (r.stdout || "") + (r.stderr || "") };
};
const tail = (s, n = 6) => s.trim().split("\n").slice(-n).join("\n");
function gate(id, name, status, evidence) {
  results.push({ id, name, status, evidence: String(evidence || "").replace(/\|/g, "\\|") });
  console.log(`${id} ${name}: ${status}`);
}

// ── الاستثناءات السارية من EXCEPTIONS.md ──
function waivers() {
  if (!existsSync("EXCEPTIONS.md")) return {};
  const txt = readFileSync("EXCEPTIONS.md", "utf8");
  const out = {};
  for (const block of txt.split(/^### /m).slice(1)) {
    const id = block.match(/^(EX-\d+)/)?.[1];
    const g = block.match(/\*\*البوابة:\*\*\s*(G\d+)/)?.[1];
    const exp = block.match(/\*\*ينتهي:\*\*\s*(\d{4}-\d{2}-\d{2})/)?.[1];
    const accepted = /\*\*قابل المخاطرة:\*\*\s*(?!بانتظار)\S/.test(block);
    if (id && g) out[g] = { id, exp, valid: !!exp && new Date(exp + "T23:59:59+03:00") >= now && accepted, accepted };
  }
  return out;
}

// G01 Build
{
  const r = sh("npm run build");
  gate("G01", "Build", r.code === 0 ? "PASS" : "FAIL", r.code === 0 ? "next build exit 0" : tail(r.out));
}
// G02 Lint
{
  const r = sh("npm run lint");
  gate("G02", "Lint", r.code === 0 ? "PASS" : "FAIL", r.code === 0 ? "eslint exit 0 (src)؛ نسخة العرض: node --check" : tail(r.out));
  const files = sh("git ls-files demo/src/*.js demo/test/*.cjs demo/*.mjs").out.trim().split("\n").filter(Boolean);
  const bad = files.filter((f) => sh(`node --check "${f}"`).code !== 0);
  if (bad.length) gate("G02", "Lint (demo syntax)", "FAIL", bad.join(", "));
}
// G03 Secret Scan — الملفات المتتبعة في Git
{
  const allow = existsSync(".secrets-allowlist") ? readFileSync(".secrets-allowlist", "utf8").split("\n").map((l) => l.split("#")[0].trim()).filter(Boolean) : [];
  const patterns = [
    [/-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/, "private key"],
    [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/, "GitHub token"],
    [/\bgithub_pat_[A-Za-z0-9_]{40,}\b/, "GitHub PAT"],
    [/\bAKIA[0-9A-Z]{16}\b/, "AWS key"],
    [/\bsk-[A-Za-z0-9]{32,}\b/, "API secret key"],
    [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, "Slack token"],
    [/postgres(ql)?:\/\/[^:\s"']+:([^@\s"']+)@(?!localhost|127\.0\.0\.1|db:)/, "remote DB password in URL"],
  ];
  const files = sh("git ls-files").out.trim().split("\n").filter((f) => f && !/\.(png|jpe?g|woff2?|ico|pdf)$/i.test(f) && f !== "package-lock.json");
  const hits = [];
  for (const f of files) {
    let t;
    try { t = readFileSync(f, "utf8"); } catch { continue; }
    for (const [re, name] of patterns) {
      const m = t.match(re);
      if (m && !allow.some((a) => m[0].includes(a))) hits.push(`${f}: ${name}`);
    }
  }
  if (existsSync(".env") && sh("git ls-files --error-unmatch .env").code === 0) hits.push(".env tracked in git");
  gate("G03", "Secret Scan", hits.length ? "FAIL" : "PASS", hits.length ? hits.join("; ") : `${files.length} ملفًا متتبعًا بلا أسرار`);
}
// G04 Dependency Scan
{
  const r = sh("npm audit --json");
  let v = {};
  try { v = JSON.parse(r.out.slice(r.out.indexOf("{"))).metadata.vulnerabilities; } catch {}
  const bad = (v.critical || 0) + (v.high || 0);
  gate("G04", "Dependency Scan", bad ? "FAIL" : "PASS", `critical ${v.critical || 0}, high ${v.high || 0}, moderate ${v.moderate || 0}, low ${v.low || 0}`);
}
// G05 Type Check
{
  const r = sh("npx tsc --noEmit");
  gate("G05", "Type Check", r.code === 0 ? "PASS" : "FAIL", r.code === 0 ? "tsc --noEmit exit 0" : tail(r.out));
}
// G06 Tests
{
  const u = sh("npx vitest run");
  const d = sh("npm run test:demo");
  const unit = u.out.match(/Tests\s+.*?(\d+) passed/)?.[1];
  const acc = d.out.match(/acceptance (\d+\/\d+)/)?.[1];
  const pages = d.out.match(/pages rendered: (\d+)/)?.[1];
  const inv = d.out.match(/invariant failures: (\d+)/)?.[1];
  const ok = u.code === 0 && d.code === 0;
  gate("G06", "Tests", ok ? "PASS" : "FAIL", `unit ${unit ?? "?"} passed; demo acceptance ${acc ?? "?"}; crawl ${pages ?? "?"} pages; fuzz invariant failures ${inv ?? "?"}${ok ? "" : " — " + tail(u.out + d.out, 4)}`);
}
// G07 Business Rule Coverage (T3: كل القواعد)
{
  if (!existsSync("BUSINESS_RULES.md")) gate("G07", "Business Rule Coverage", "FAIL", "BUSINESS_RULES.md غير موجود");
  else {
    const ids = [...readFileSync("BUSINESS_RULES.md", "utf8").matchAll(/^### (BR-\d+)/gm)].map((m) => m[1]);
    const corpus = ["tests/lib.test.ts", "demo/src/acceptance.js", "demo/test/fuzz.cjs", "demo/test/crawl.cjs"].filter(existsSync).map((f) => readFileSync(f, "utf8")).join("\n");
    const missing = ids.filter((id) => !corpus.includes(id));
    gate("G07", "Business Rule Coverage", ids.length && !missing.length ? "PASS" : "FAIL", missing.length ? `بلا اختبار: ${missing.join(", ")}` : `${ids.length} قاعدة، لكل منها اختبار`);
  }
}
// G08 SAST
{
  const r = sh("npx eslint -c eslint.security.mjs .");
  const errs = r.out.match(/(\d+) errors?/)?.[1] || "0";
  const warns = r.out.match(/(\d+) warnings?/)?.[1] || "0";
  gate("G08", "SAST", r.code === 0 ? "PASS" : "FAIL", `eslint-plugin-security: ${errs} errors, ${warns} warnings (مراجعة في SECURITY.md)`);
}
// G09 Migration Check — تطبيق كل الترحيلات على قاعدة جديدة فارغة تُنشأ وتُحذف لهذا الفحص فقط
{
  const v = sh("npx prisma validate");
  const base = process.env.GATES_DB_ADMIN_URL || "postgresql://barq:barq_dev_password@localhost:5433/postgres";
  const name = "barq_gate_" + Date.now();
  // Prisma 7: عنوان القاعدة من البيئة عبر prisma.config.ts (لا يوجد خيار --url)
  const exec = (sql) => sh("npx prisma db execute --stdin", { input: sql, env: { ...process.env, DATABASE_URL: base } });
  const edited = sh("git diff --name-only HEAD -- prisma/migrations").out.trim();
  const created = v.code === 0 ? exec(`CREATE DATABASE ${name};`) : { code: 1, out: "" };
  if (v.code !== 0) gate("G09", "Migration Check", "FAIL", tail(v.out));
  else if (created.code !== 0) gate("G09", "Migration Check", "BLOCKED", "قاعدة الاختبار غير متاحة — شغّل npm run db:start");
  else {
    const url = base.replace(/\/postgres(\?|$)/, "/" + name + "$1");
    const r = sh("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url } });
    exec(`DROP DATABASE IF EXISTS ${name};`);
    if (edited) gate("G09", "Migration Check", "FAIL", `ترحيل منشور تم تعديله: ${edited}`);
    else gate("G09", "Migration Check", r.code === 0 ? "PASS" : "FAIL", r.code === 0 ? "schema valid؛ كل الترحيلات طُبّقت على قاعدة جديدة فارغة ثم حُذفت" : tail(r.out));
  }
}
// G10 API Contract
gate("G10", "API Contract", existsSync("src/app/api") ? "NOT TESTED" : "N/A", existsSync("src/app/api") ? "لا يوجد اختبار عقد بعد" : "لا توجد واجهات API منشورة بعد");
// G11 E2E
gate("G11", "E2E", existsSync("e2e") ? "NOT TESTED" : "NOT TESTED", "لا توجد اختبارات متصفح آلية (Playwright) بعد — مطلوبة في T3");
// G12 AI Eval
gate("G12", "AI Eval", "N/A", "لا توجد ميزات ذكاء اصطناعي في النظام");
// G13 Architecture Plan
{
  const a = existsSync("ARCHITECTURE.md"), p = existsSync("PLAN.md");
  const plan = p ? readFileSync("PLAN.md", "utf8") : "";
  const approved = /\*\*اعتماد المخطط:\*\*\s*معتمد/.test(plan);
  gate("G13", "Architecture Plan", !a || !p ? "FAIL" : approved ? "PASS" : "BLOCKED", !a || !p ? "ARCHITECTURE.md أو PLAN.md غير موجود" : approved ? "المخطط معتمد" : "المخطط مكتوب وينتظر اعتماد خالد");
}

// ── التطبيق على مستوى الإلزام والاستثناءات ──
const W = waivers();
const required = { T1: ["G01", "G02", "G03", "G04"], T2: ["G01", "G02", "G03", "G04", "G05", "G06", "G07", "G08", "G09", "G13"], T3: ["G01", "G02", "G03", "G04", "G05", "G06", "G07", "G08", "G09", "G10", "G11", "G13"] }[TIER];
let blocking = 0;
for (const r of results) {
  if (r.status === "N/A" || r.status === "PASS") continue;
  if (!required.includes(r.id)) continue;
  const w = W[r.id];
  if (w && w.valid) r.status = `WAIVED (${w.id} حتى ${w.exp})`;
  else {
    if (w && !w.valid) r.evidence += ` — الاستثناء ${w.id} ${w.accepted ? "منتهٍ" : "لم يُقبل بعد"}`;
    blocking++;
  }
}
const md = `# تقرير بوابات الجودة — 3 TECH v1.4

- المشروع: barq-platform
- مستوى الإلزام: **${TIER}**
- التاريخ: ${now.toISOString()}
- الإصدار: ${sh("git rev-parse --short HEAD").out.trim()}
- الأداة: scripts/quality-gates.mjs (حزمة 3 TECH الرسمية غير مثبتة)

| البوابة | الاسم | الحالة | الدليل |
|---|---|---|---|
${results.map((r) => `| ${r.id} | ${r.name} | ${r.status} | ${r.evidence.replace(/\n/g, "<br>")} |`).join("\n")}

**النتيجة:** ${blocking ? `${blocking} بوابة مطلوبة لم تنجح — الدمج والإطلاق ممنوعان` : "كل البوابات المطلوبة ناجحة أو مستثناة باستثناء ساري"}
`;
mkdirSync("reports", { recursive: true });
writeFileSync("reports/gates-latest.md", md);
console.log(`\nreports/gates-latest.md — blocking: ${blocking}`);
process.exitCode = blocking ? 1 : 0;

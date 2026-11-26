// BR-008 (الصلاحيات ونطاق كل دور) — زاحف: يفتح كل صفحة لكل دور، ويتبع كل رابط وكل data-go، ويتحقق أن كل data-act له معالج
const fs = require("fs");
const vm = require("vm");
const html = fs.readFileSync(__dirname + "/../barq-demo.html", "utf8");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const app = scripts.find((x) => x.includes("function seedState")).replace(/\/\* ── التشغيل ── \*\/[\s\S]*$/, "");
const store = {};
const el = () => ({ innerHTML: "", appendChild() {}, classList: { add() {}, remove() {}, toggle() {} }, querySelector: () => null, style: {}, remove() {}, focus() {} });
const ctx = {
  console, Intl, Date, Math, JSON, crypto: require("crypto").webcrypto, TextEncoder, btoa: (s) => Buffer.from(s, "binary").toString("base64"), setTimeout: (f) => f(), clearTimeout() {}, setInterval() {}, URLSearchParams, Blob: class {}, URL,
  localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = String(v)), removeItem: (k) => delete store[k] },
  location: { hash: "#/login" },
  document: { addEventListener() {}, querySelector: () => el(), querySelectorAll: () => [], getElementById: () => null, createElement: () => el(), activeElement: null, body: el() },
  window: { addEventListener() {}, scrollTo() {} }, innerWidth: 1400,
};
ctx.window.qrSvg = ctx.qrSvg = () => "<svg/>";
vm.createContext(ctx);
vm.runInContext(app + "\n;globalThis.__=({seedState,ROUTES,ACTIONS,UI,get S(){return S},setMe:(u)=>{ME=u},layout,navItems,canAny,DomainError});", ctx);
const A = ctx.__;
A.seedState();
const S = A.S;
const problems = [];
const actsSeen = new Set();
function renderPath(u, p) {
  const [path, qs] = p.replace(/^#/, "").split("?");
  const r = A.ROUTES.find((r) => r.re.test(path));
  if (!r) return { err: "NO_ROUTE" };
  if (r.perms.length && !A.canAny(u, ...r.perms)) return { forbidden: true };
  const m = path.match(r.re);
  const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
  try {
    const html = r.fn(params, Object.fromEntries(new URLSearchParams(qs || "")));
    return { html: r.opts.bare ? html : A.layout(html, path, false) };
  } catch (e) {
    if (e instanceof A.DomainError || e.constructor.name === "DomainError") return { forbidden: true, msg: e.message };
    return { err: e.message + " @ " + (e.stack.split("\n")[1] || "").trim() };
  }
}
let pages = 0;
for (const u of S.users) {
  A.setMe(u);
  const queue = A.navItems(u).map((n) => n.href);
  const seen = new Set();
  // صفحات تبويب العميل
  while (queue.length && seen.size < 900) {
    const p = queue.shift().replace(/^#/, "");
    const key = p.replace(/\?.*$/, "").replace(/\/[a-z]+-[a-z0-9]{6,}/g, "/:id") + (p.includes("?") ? "?" : "");
    if (seen.has(p)) continue;
    seen.add(p);
    // نكتفي بثلاث نسخ من كل نمط مسار
    const same = [...seen].filter((x) => x.replace(/\?.*$/, "").replace(/\/[a-z]+-[a-z0-9]{6,}/g, "/:id") + (x.includes("?") ? "?" : "") === key).length;
    if (same > 3) continue;
    const res = renderPath(u, p);
    pages++;
    if (res.err) { problems.push(`[${u.username}] ${p} → ${res.err}`); continue; }
    if (res.forbidden) continue;
    const h = res.html;
    if (/الصفحة غير موجودة|غير موجود"|undefined|NaN|\[object Object\]/.test(h.replace(/<script[\s\S]*?<\/script>/g, ""))) {
      const m = h.match(/.{0,60}(الصفحة غير موجودة|undefined|NaN|\[object Object\]).{0,60}/);
      problems.push(`[${u.username}] ${p} → contains "${m ? m[0].replace(/<[^>]+>/g, " ") : "?"}"`);
    }
    for (const m of h.matchAll(/href="(#\/[^"]*)"/g)) queue.push(m[1]);
    for (const m of h.matchAll(/data-go="([^"]*)"/g)) queue.push(m[1].startsWith("/") || m[1].startsWith("#") ? m[1] : "/" + m[1]);
    for (const m of h.matchAll(/data-act(?:-input|-change)?="([^"]+)"/g)) actsSeen.add(m[1]);
    // تبويبات العميل
    const cm = p.match(/^\/customers\/(cus-[a-z0-9]+)$/);
    if (cm) for (const t of ["overview", "custody", "sales", "rentals", "invoices", "payments", "docs", "files", "activity"]) {
      A.UI.tab[cm[1]] = t;
      const r2 = renderPath(u, p);
      pages++;
      if (r2.err) problems.push(`[${u.username}] ${p} tab ${t} → ${r2.err}`);
      else if (r2.html) {
        for (const m of r2.html.matchAll(/href="(#\/[^"]*)"/g)) queue.push(m[1]);
        for (const m of r2.html.matchAll(/data-go="([^"]*)"/g)) queue.push(m[1]);
        for (const m of r2.html.matchAll(/data-act(?:-input|-change)?="([^"]+)"/g)) actsSeen.add(m[1]);
      }
    }
  }
}
const missing = [...actsSeen].filter((a) => !A.ACTIONS[a]);
console.log("pages rendered:", pages);
console.log("actions referenced:", actsSeen.size, "missing handlers:", missing.join(", ") || "none");
console.log("problems:", problems.length);
[...new Set(problems)].slice(0, 60).forEach((p) => console.log("  " + p));

if (problems.length || missing.length) process.exitCode = 1;

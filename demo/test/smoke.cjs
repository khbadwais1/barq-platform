// اختبار دخان: يشغّل كود العرض في Node مع DOM وهمي، ويولّد البيانات، ويشغّل اختبارات القبول، ويعرض كل صفحة لكل دور
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
ctx.window.qrSvg = () => "<svg/>";
ctx.qrSvg = ctx.window.qrSvg;
vm.createContext(ctx);
vm.runInContext(app + "\n;globalThis.__api={get S(){return S},seedState,runAcceptance,ROUTES,set ME(v){ME=v},UI,customerSummary,invRemaining,bal,balAll,accountBalance,S_counts:()=>({customers:S.customers.length,products:S.products.length,sales:S.sales.length,rentals:S.rentals.length,invoices:S.invoices.length,payments:S.payments.length,expenses:S.expenses.length,projects:S.projects.length})};", ctx);
const api = ctx.__api;
const t0 = Date.now();
api.seedState();
console.log("seed ms", Date.now() - t0, JSON.stringify(api.S_counts()));
const S = api.S;
console.log("sales statuses", JSON.stringify(S.sales.reduce((a, s) => ((a[s.status] = (a[s.status] || 0) + 1), a), {})));
console.log("confirmed sales without invoice:", S.sales.filter((s) => s.status === "CONFIRMED" && !s.invoiceId).length);
const r = api.runAcceptance();
const failed = r.results.filter((x) => !x.ok);
console.log(`acceptance ${r.results.length - failed.length}/${r.results.length}`);
failed.forEach((f) => console.log("  FAIL:", f.group, "|", f.name, "|", f.detail));
console.log("docs", r.docs.map((d) => d.join("=")).join(", "));
// عرض كل الصفحات لكل الأدوار
const ids = { sale: S.sales[0].id, rent: S.rentals[0].id, cust: S.customers[0].id, inv: S.invoices[0].id, pay: S.payments[0].id, prod: S.products[0].id, dn: S.deliveries[0].id, rn: S.returns[0].id, pn: S.promissory[0].id, acc: "a-cash" };
const paths = ["/owner/dashboard", "/finance/dashboard", "/seller/dashboard", "/sales", "/sales/new", `/sales/${ids.sale}`, "/rentals", "/rentals/new", `/rentals/${ids.rent}`, "/customers", `/customers/${ids.cust}`, `/customers/${ids.cust}?project=${S.projects.find((p) => p.customerId === ids.cust).id}`, "/invoices", `/invoices/${ids.inv}`, "/payments", `/payments/${ids.pay}`, "/accounts", `/accounts/${ids.acc}`, "/expenses", "/approvals", "/daily", "/inventory", `/inventory/${ids.prod}`, "/reps", "/users", "/settings", "/audit", "/profile", `/print/invoice/${ids.inv}`, `/print/dn/${ids.dn}`, `/print/rn/${ids.rn}`, `/print/rv/${ids.pay}`, `/print/pn/${ids.pn}`, `/print/statement/${ids.cust}`, `/print/daily/2026-11-20`, "/acceptance", "/monthly", "/cashbook", `/print/rentbill/${ids.cust}`, `/print/acct/${ids.cust}`, `/print/rentbill/${S.customers.find((c) => c.name === "محمد").id}`];
const tabs = ["overview", "custody", "sales", "rentals", "invoices", "payments", "docs", "files", "activity"];
let errs = 0, renders = 0;
for (const u of S.users) {
  api.ME = u;
  for (const p of paths) {
    const [path, qs] = p.split("?");
    const route = api.ROUTES.find((r) => r.re.test(path));
    if (!route) { console.log("NO ROUTE", p); errs++; continue; }
    const m = path.match(route.re);
    const params = Object.fromEntries(route.keys.map((k, i) => [k, m[i + 1]]));
    const query = Object.fromEntries(new URLSearchParams(qs || ""));
    const allowed = !route.perms.length || route.perms.some((x) => vm.runInContext(`can(ME, ${JSON.stringify(x)})`, ctx));
    if (!allowed) continue;
    const run = () => { try { route.fn(params, query); renders++; } catch (e) { if (e.constructor.name !== "DomainError") { errs++; console.log("ERR", u.username, p, e.message, e.stack.split("\n")[1]); } } };
    if (path.startsWith("/customers/")) for (const t of tabs) { api.UI.tab[ids.cust] = t; run(); } else run();
  }
}
console.log(`renders ${renders}, errors ${errs}`);

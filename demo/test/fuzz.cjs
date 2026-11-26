// اختبار ضغط: عمليات عشوائية كثيرة عبر قواعد العمل، وبعد كل عملية نتحقق من ثوابت الترابط
const fs = require("fs");
const vm = require("vm");
const html = fs.readFileSync(__dirname + "/../barq-demo.html", "utf8");
const app = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((x) => x.includes("function seedState")).replace(/\/\* ── التشغيل ── \*\/[\s\S]*$/, "");
const store = {};
const el = () => ({ innerHTML: "", appendChild() {}, classList: { add() {}, remove() {}, toggle() {} }, querySelector: () => null, style: {}, remove() {}, focus() {} });
const ctx = {
  console, Intl, Date, Math, JSON, crypto: require("crypto").webcrypto, TextEncoder, btoa: (s) => Buffer.from(s, "binary").toString("base64"), setTimeout: (f) => f(), clearTimeout() {}, setInterval() {}, URLSearchParams, Blob: class {}, URL,
  localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = String(v)), removeItem: (k) => delete store[k] },
  location: { hash: "#/" },
  document: { addEventListener() {}, querySelector: () => el(), querySelectorAll: () => [], getElementById: () => null, createElement: () => el(), activeElement: null, body: el() },
  window: { addEventListener() {}, scrollTo() {} },
  innerWidth: 1400,
};
ctx.window.qrSvg = ctx.qrSvg = () => "<svg/>";
vm.createContext(ctx);
vm.runInContext(app, ctx);
const X = vm.runInContext(
  "({closeRental,cancelRental,cancelSale,seedState,createSale,recordPayment,createRental,deliverRental,returnRental,billRental,rentalDeposit,depositHeld,createExpense,decideApproval,invRemaining,invPaid,bal,balances,STATES,accountBalance,transactions,customerSummary,lineEvents,DomainError,get S(){return S},openPayModal,openCustomerModal,openExpenseModal,openPaymentPicker,ACTIONS,UI,setMe:(u)=>{ME=u}})",
  ctx,
);
X.seedState();
const S = X.S;
let seed = Number(process.argv[2] || 7);
const R = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = (a) => a[Math.floor(R() * a.length)];
const U = (n) => S.users.find((u) => u.username === n);
const owner = U("sulaiman"),
  fin = U("finance"),
  sellers = [U("seller1"), U("seller2")],
  yard = U("yard");
const stats = {},
  rejected = {},
  fails = [];
const isDomain = (e) => e instanceof X.DomainError || e.constructor.name === "DomainError";

// ثوابت قواعد الأعمال: BR-002 BR-003 BR-004 BR-005 BR-011 BR-012 BR-013 BR-014 BR-041
function invariants(step, label) {
  const errs = [];
  const B = X.balances();
  for (const [k, b] of Object.entries(B)) for (const s of X.STATES) if (b[s] < 0) errs.push(`negative ${s} ${k}`);
  for (const i of S.invoices) {
    const p = X.invPaid(i);
    if (p > i.total || p < 0) errs.push(`invoice ${i.no} paid ${p} > total ${i.total}`);
    if (i.total !== i.taxable + i.vat) errs.push(`invoice ${i.no} total mismatch`);
  }
  for (const p of S.payments) if (p.amount !== p.allocations.reduce((a, x) => a + x.amount, 0)) errs.push(`payment ${p.no} alloc mismatch`);
  for (const r of S.rentals)
    r.lines.forEach((l, i) => {
      if (l.returned > l.delivered || l.delivered > l.qty) errs.push(`rental ${r.no} line ${i} counts`);
      const ev = X.lineEvents(r.id, i).reduce((a, e) => a + e.delta, 0);
      if (ev !== l.delivered - l.returned) errs.push(`rental ${r.no} line ${i} ledger ${ev} vs ${l.delivered - l.returned}`);
    });
  const rentedBook = {}, rentedCustody = {}, resBook = {}, resNeed = {};
  for (const [k, b] of Object.entries(B)) {
    const pid = k.split("|")[0];
    rentedBook[pid] = (rentedBook[pid] || 0) + b.RENTED;
    resBook[pid] = (resBook[pid] || 0) + b.RESERVED;
  }
  for (const r of S.rentals)
    for (const l of r.lines) {
      rentedCustody[l.pid] = (rentedCustody[l.pid] || 0) + l.delivered - l.returned;
      if (!["CANCELLED", "CLOSED"].includes(r.status)) resNeed[l.pid] = (resNeed[l.pid] || 0) + l.qty - l.delivered;
    }
  for (const pid of new Set([...Object.keys(rentedBook), ...Object.keys(rentedCustody)]))
    if ((rentedBook[pid] || 0) !== (rentedCustody[pid] || 0)) errs.push(`rented book ${rentedBook[pid]} vs custody ${rentedCustody[pid]}`);
  for (const pid of new Set([...Object.keys(resBook), ...Object.keys(resNeed)]))
    if ((resBook[pid] || 0) !== (resNeed[pid] || 0)) errs.push(`reserved book ${resBook[pid] || 0} vs open need ${resNeed[pid] || 0} (${S.products.find((p) => p.id === pid)?.name})`);
  for (const a of S.accounts) {
    const t = X.transactions().filter((x) => x.accountId === a.id);
    if (X.accountBalance(a.id) !== a.opening + t.reduce((s, x) => s + (x.dir === "IN" ? x.amount : -x.amount), 0)) errs.push(`account ${a.id}`);
  }
  for (const r of S.rentals) if (X.depositHeld(r.id) < 0) errs.push(`deposit negative ${r.no}`);
  for (const a of S.accounts) if (a.type === "CASH" && X.accountBalance(a.id) < 0) errs.push(`cash negative ${a.id}`);
  for (const s of S.sales) if (s.status === "CANCELLED" && s.invoiceId && S.invoices.find((i) => i.id === s.invoiceId).status !== "CANCELLED") errs.push(`cancelled sale ${s.no} has live invoice`);
  for (const c of S.customers) {
    const cs = X.customerSummary(c.id);
    const projs = S.projects.filter((p) => p.customerId === c.id);
    const sumProj = projs.reduce((a, p) => a + X.customerSummary(c.id, p.id).balance, 0);
    if (cs.balance !== sumProj) errs.push(`customer ${c.code} balance ${cs.balance} != projects ${sumProj}`);
    if (cs.onSite !== projs.reduce((a, p) => a + X.customerSummary(c.id, p.id).onSite, 0)) errs.push(`customer ${c.code} onSite mismatch`);
  }
  if (errs.length) {
    fails.push(`step ${step} (${label}): ${[...new Set(errs)].slice(0, 4).join(" | ")}`);
    return false;
  }
  return true;
}
let last = "seed";
const tryOp = (name, fn) => {
  last = name;
  try {
    fn();
    stats[name] = (stats[name] || 0) + 1;
  } catch (e) {
    if (!isDomain(e)) fails.push(`${name} crashed: ${e.message} ${e.stack.split("\n")[1]}`);
    else rejected[name] = (rejected[name] || 0) + 1;
  }
};
invariants(-1, "seed");
const products = S.products.filter((p) => p.status === "ACTIVE");
for (let step = 0; step < 1500 && !fails.length; step++) {
  const c = pick(S.customers.filter((c) => S.projects.some((p) => p.customerId === c.id)));
  const proj = pick(S.projects.filter((p) => p.customerId === c.id));
  const op = R();
  if (op < 0.18)
    tryOp("sale", () => {
      const t = pick(["CASH", "CREDIT", "PARTIAL"]);
      const p = pick(products);
      X.createSale({ customerId: c.id, projectId: proj.id, wh: pick(["w1", "w2"]), lines: [{ pid: p.id, count: 1 + Math.floor(R() * 30), price: p.price }], docDisc: R() < 0.2 ? 500 : 0, term: t, paid: t === "PARTIAL" ? 100 : undefined, accountId: "a-cash", method: "CASH", idemKey: R() < 0.1 ? "dup-" + (step % 7) : "s" + step }, pick(sellers));
    });
  else if (op < 0.38) {
    const inv = pick(S.invoices.filter((i) => X.invRemaining(i) > 0));
    if (inv) tryOp("payment", () => X.recordPayment({ customerId: inv.customerId, allocations: [{ invoiceId: inv.id, amount: R() < 0.15 ? X.invRemaining(inv) + 100 : Math.max(1, Math.floor(X.invRemaining(inv) * R())) }], method: pick(["CASH", "TRANSFER"]), accountId: pick(["a-cash", "a-rajhi", "a-ahli"]), repId: pick(S.reps).id, idemKey: "p" + step }, fin));
  } else if (op < 0.5)
    tryOp("rental", () => X.createRental({ customerId: c.id, projectId: proj.id, wh: "w1", basis: pick(["DAILY", "WEEKLY", "MONTHLY"]), periods: 1 + Math.floor(R() * 3), mode: pick(["FIXED", "OPEN"]), lines: [{ pid: pick(products).id, qty: 1 + Math.floor(R() * 40) }], deposit: R() < 0.3 ? 10000 : 0, idemKey: "r" + step }, pick(sellers)));
  else if (op < 0.62) {
    const r = pick(S.rentals.filter((r) => r.lines.some((l) => l.delivered < l.qty)));
    if (r) tryOp("deliver", () => X.deliverRental(r.id, { lines: r.lines.map((l, idx) => ({ idx, qty: Math.ceil((l.qty - l.delivered) * (R() < 0.3 ? 2 : R())) })), transport: R() < 0.3 ? 5000 : 0, idemKey: "d" + step }, yard));
  } else if (op < 0.76) {
    const r = pick(S.rentals.filter((r) => r.lines.some((l) => l.delivered > l.returned)));
    if (r) tryOp("return", () => X.returnRental(r.id, { lines: r.lines.map((l, idx) => ({ idx, qty: Math.ceil((l.delivered - l.returned) * (R() < 0.2 ? 1.5 : R())), cond: pick(["GOOD", "GOOD", "MAINTENANCE", "DAMAGED", "LOST"]) })), fee: R() < 0.2 ? 3000 : 0, idemKey: R() < 0.1 ? "rdup" : "rn" + step }, yard));
  } else if (op < 0.79) {
    const r = pick(S.rentals.filter((r) => !["CLOSED", "CANCELLED"].includes(r.status)));
    if (r) tryOp(R() < 0.6 ? "close" : "cancelRental", () => (R() < 0.6 ? X.closeRental(r.id, fin) : X.cancelRental(r.id, "اختبار", owner)));
  } else if (op < 0.8) {
    const s = pick(S.sales.filter((s) => s.status === "CONFIRMED"));
    if (s) tryOp("cancelSale", () => X.cancelSale(s.id, "اختبار", owner));
  } else if (op < 0.82) {
    const r = pick(S.rentals);
    if (r) tryOp("bill", () => X.billRental(r.id, fin));
  } else if (op < 0.88) tryOp("expense", () => X.createExpense({ cat: "مصروف صيانة", amount: pick([100000, 499999, 500000, 900000]), accountId: pick(["a-cash", "a-rajhi"]), idemKey: "e" + step }, fin));
  else if (op < 0.94) {
    const ap = pick(S.approvals.filter((a) => a.status === "PENDING"));
    if (ap) tryOp("approval", () => X.decideApproval(ap.id, R() < 0.7 ? "APPROVED" : "REJECTED", "سبب", owner));
  } else {
    const r = pick(S.rentals.filter((r) => r.deposit));
    if (r) tryOp("deposit", () => X.rentalDeposit(r.id, { kind: pick(["RECEIVED", "REFUNDED", "FORFEITED"]), amount: pick([5000, 10000, 50000]), accountId: "a-cash" }, fin));
  }
  invariants(step, last);
}

X.setMe(owner);
const modalErrs = [];
const fakeEl = (ds) => ({ dataset: ds, value: "", checked: false, tagName: "BUTTON" });
const openers = [
  ["openPayModal", () => X.openPayModal(S.invoices.find((i) => X.invRemaining(i) > 0).customerId)],
  ["openCustomerModal", () => X.openCustomerModal()],
  ["openExpenseModal", () => X.openExpenseModal()],
  ["openPaymentPicker", () => X.openPaymentPicker()],
  ["deliver", () => X.ACTIONS.deliver(fakeEl({ r: S.rentals[0].id }))],
  ["returnNote", () => X.ACTIONS.returnNote(fakeEl({ r: S.rentals[0].id }))],
  ["deposit", () => X.ACTIONS.deposit(fakeEl({ r: S.rentals[0].id, k: "RECEIVED" }))],
  ["rate", () => X.ACTIONS.rate(fakeEl({ c: S.customers[0].id }))],
  ["blacklist", () => X.ACTIONS.blacklist(fakeEl({ c: S.customers[0].id }))],
  ["followup", () => X.ACTIONS.followup(fakeEl({ c: S.customers[0].id }))],
  ["addPN", () => X.ACTIONS.addPN(fakeEl({ c: S.customers[0].id, p: "" }))],
  ["newProject", () => X.ACTIONS.newProject(fakeEl({ c: S.customers[0].id }))],
  ["productForm", () => X.ACTIONS.productForm(fakeEl({ p: S.products[0].id }))],
  ["adjust", () => X.ACTIONS.adjust(fakeEl({}))],
  ["addRep", () => X.ACTIONS.addRep(fakeEl({}))],
  ["addUser", () => X.ACTIONS.addUser(fakeEl({}))],
  ["addBank", () => X.ACTIONS.addBank(fakeEl({}))],
];
for (const [n, f] of openers) {
  try {
    f();
    const m = X.UI.modal;
    const b = typeof m.body === "function" ? m.body() : m.body;
    if (/undefined|NaN/.test(b)) modalErrs.push(n + ": undefined/NaN in body");
  } catch (e) {
    modalErrs.push(n + ": " + e.message);
  }
}
console.log("ops ok:", JSON.stringify(stats));
console.log("guards rejected:", JSON.stringify(rejected));
console.log("invariant failures:", fails.length);
fails.slice(0, 10).forEach((f) => console.log("  " + f));
console.log("modal problems:", modalErrs.length ? modalErrs.join(" | ") : "none");

if (fails.length || modalErrs.length) process.exitCode = 1;

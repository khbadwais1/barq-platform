/* ═══════════ قواعد العمل (نفس قواعد الخادم في النظام الكامل) ═══════════ */
"use strict";

class DomainError extends Error {}
let S = null; // الحالة الكاملة
let VER = 0; // يزيد مع كل عملية لتحديث الذاكرة المؤقتة
const memo = {};
function cached(key, fn) {
  if (memo[key] && memo[key].v === VER) return memo[key].val;
  const val = fn();
  memo[key] = { v: VER, val };
  return val;
}
function touch() {
  VER++;
  save();
}

/* ─── أدوات ─── */
const byId = (arr, id) => arr.find((x) => x.id === id);
const uid = (p) => p + "-" + Math.random().toString(36).slice(2, 10);
const vatOf = (taxable, rate) => Math.round((taxable * rate) / 100); // نصف للأعلى على الهللة
const yearOf = (t) => new Date(t + RIYADH).getUTCFullYear();
function nextNo(prefix, at, pad = 5) {
  const key = `${prefix}-${yearOf(at)}`;
  S.seq[key] = (S.seq[key] || 0) + 1;
  return `${key}-${String(S.seq[key]).padStart(pad, "0")}`;
}
function nextCode(prefix, pad = 4) {
  S.seq[prefix] = (S.seq[prefix] || 0) + 1;
  return `${prefix}-${String(S.seq[prefix]).padStart(pad, "0")}`;
}
function audit(actor, action, entity, id, before, after, at) {
  S.audit.push({
    id: uid("au"),
    at: at || Date.now(),
    userId: actor?.id || null,
    role: actor?.role || null,
    action,
    entity,
    entityId: id,
    before: before ? JSON.parse(JSON.stringify(before)) : null,
    after: after ? JSON.parse(JSON.stringify(after)) : null,
  });
}
/** مفتاح الطلب الثابت: إعادة نفس الطلب تعيد نفس النتيجة ولا تكرر الأثر */
function idem(key) {
  return key && S.idem[key] ? S.idem[key] : null;
}
function remember(key, result) {
  if (key) S.idem[key] = result;
}

/* ─── المخزون: الرصيد يُشتق دائمًا من دفتر الحركات ─── */
const STATES = ["AVAILABLE", "RESERVED", "RENTED", "DAMAGED", "LOST", "MAINTENANCE"];
const STATE_LABEL = { AVAILABLE: "متاح", RESERVED: "محجوز", RENTED: "مؤجر", DAMAGED: "تالف", LOST: "مفقود", MAINTENANCE: "تحت الصيانة" };
function balances() {
  return cached("bal", () => {
    const m = {};
    for (const mv of S.movements) {
      const k = mv.pid + "|" + mv.wh;
      const b = (m[k] ||= { AVAILABLE: 0, RESERVED: 0, RENTED: 0, DAMAGED: 0, LOST: 0, MAINTENANCE: 0, SOLD: 0 });
      if (mv.from) b[mv.from] -= mv.qty;
      if (mv.to) b[mv.to] += mv.qty;
      if (mv.type === "SALE_OUT") b.SOLD += mv.qty;
      if (mv.type === "SALE_RETURN") b.SOLD -= mv.qty;
    }
    return m;
  });
}
function bal(pid, wh) {
  const b = balances()[pid + "|" + wh];
  return b || { AVAILABLE: 0, RESERVED: 0, RENTED: 0, DAMAGED: 0, LOST: 0, MAINTENANCE: 0, SOLD: 0 };
}
function balAll(pid) {
  const out = { AVAILABLE: 0, RESERVED: 0, RENTED: 0, DAMAGED: 0, LOST: 0, MAINTENANCE: 0, SOLD: 0 };
  for (const w of S.warehouses) {
    const b = bal(pid, w.id);
    for (const k in out) out[k] += b[k];
  }
  return out;
}
function move(mv) {
  S.movements.push({ id: uid("mv"), at: Date.now(), ...mv });
}

/* ─── حسابات البيع ─── */
function lineCalc(p, l) {
  const meters = p.len ? Math.round(p.len * l.count * 100) / 100 : null;
  const priceQty = p.pricing === "METER" && meters ? meters : l.count;
  const gross = Math.round(priceQty * l.price);
  const disc = Math.max(0, Math.round(l.disc || 0));
  return { meters, priceQty, gross, disc, net: gross - disc };
}
function saleTotals(lines, docDisc, rate) {
  const calc = lines.map((l) => lineCalc(byId(S.products, l.pid), l));
  const gross = calc.reduce((a, c) => a + c.gross, 0);
  const itemsDisc = calc.reduce((a, c) => a + c.disc, 0);
  const net = gross - itemsDisc;
  const doc = Math.max(0, Math.round(docDisc || 0));
  const taxable = net - doc;
  const vat = vatOf(taxable, rate);
  const totalDisc = itemsDisc + doc;
  return { calc, gross, itemsDisc, docDisc: doc, taxable, vat, total: taxable + vat, totalDisc, discPct: gross ? (totalDisc / gross) * 100 : 0 };
}

/* ─── الفواتير والذمم ─── */
function allocIndex() {
  return cached("alloc", () => {
    const m = {};
    for (const p of S.payments) if (p.status !== "VOID") for (const a of p.allocations) m[a.invoiceId] = (m[a.invoiceId] || 0) + a.amount;
    return m;
  });
}
const invPaid = (inv) => allocIndex()[inv.id] || 0;
const invRemaining = (inv) => (inv.status === "CANCELLED" ? 0 : inv.total - invPaid(inv));
function invStatus(inv, now = Date.now()) {
  if (inv.status === "CANCELLED") return "CANCELLED";
  const paid = invPaid(inv);
  if (paid >= inv.total) return "PAID";
  if (dayNo(now) > dayNo(inv.due)) return "OVERDUE";
  return paid > 0 ? "PARTIAL" : "UNPAID";
}
function createInvoice({ kind, refId, customerId, projectId, sellerId, at, due, gross, disc, taxable, rate, items, periodFrom, periodTo, actor, notes }) {
  const vat = vatOf(taxable, rate);
  const inv = {
    id: uid("inv"),
    no: nextNo("INV", at, 6),
    kind,
    refId,
    customerId,
    projectId,
    sellerId,
    at,
    due,
    gross,
    disc,
    taxable,
    rate,
    vat,
    total: taxable + vat,
    items,
    periodFrom,
    periodTo,
    status: "ISSUED",
    createdBy: actor.id,
    notes: notes || "",
    uuid: crypto.randomUUID ? crypto.randomUUID() : uid("uuid"),
  };
  S.invoices.push(inv);
  return inv;
}

/* ─── الحسابات المالية: الرصيد = الافتتاحي + الداخل − الخارج ─── */
function transactions() {
  return cached("txs", () => {
    const t = [];
    for (const p of S.payments)
      if (p.status !== "VOID") t.push({ id: "tx-" + p.id, at: p.at, accountId: p.accountId, dir: "IN", amount: p.amount, src: "PAYMENT", ref: p.id, desc: `سند قبض ${p.no}`, customerId: p.customerId });
    for (const e of S.expenses)
      if (e.status === "APPROVED") t.push({ id: "tx-" + e.id, at: e.postedAt || e.at, accountId: e.accountId, dir: "OUT", amount: e.amount, src: "EXPENSE", ref: e.id, desc: `مصروف ${e.no} - ${e.cat}` });
    for (const d of S.deposits.filter((x) => x.kind !== "FORFEITED"))
      t.push({ id: "tx-" + d.id, at: d.at, accountId: d.accountId, dir: d.kind === "RECEIVED" ? "IN" : "OUT", amount: d.amount, src: "DEPOSIT", ref: d.rentalId, desc: (d.kind === "RECEIVED" ? "تأمين مقبوض - " : "رد تأمين - ") + byId(S.rentals, d.rentalId)?.no });
    return t.sort((a, b) => a.at - b.at);
  });
}
function accountBalance(aid, until = Infinity) {
  const a = byId(S.accounts, aid);
  let b = a.opening;
  for (const t of transactions()) if (t.accountId === aid && t.at < until) b += t.dir === "IN" ? t.amount : -t.amount;
  return b;
}

/** الصندوق النقدي لا يصرف أكثر من رصيده */
function assertCash(accountId, amount) {
  const a = byId(S.accounts, accountId);
  if (a && a.type === "CASH" && accountBalance(accountId) < amount) throw new DomainError(`رصيد ${a.name} (${(accountBalance(accountId) / 100).toFixed(2)}) لا يكفي لصرف ${(amount / 100).toFixed(2)}`);
}

/** كل سندات الصرف: المصروفات المعتمدة المرحّلة وردود التأمين */
function paymentVouchers() {
  return cached("pvs", () => {
    const out = [];
    for (const e of S.expenses) if (e.status === "APPROVED" && e.pvNo) out.push({ id: e.id, kind: "exp", no: e.pvNo, at: e.postedAt, payee: e.payee || e.cat, amount: e.amount, accountId: e.accountId, method: e.method || "CASH", chequeNo: e.chequeNo || "", forWhat: `${e.cat}${e.desc && e.desc !== e.cat ? " — " + e.desc : ""}`, projectId: e.projectId, by: e.requestedBy, approvedBy: e.reviewedBy, ref: e.no });
    for (const d of S.deposits) if (d.kind === "REFUNDED" && d.pvNo) { const r = byId(S.rentals, d.rentalId); out.push({ id: d.id, kind: "dep", no: d.pvNo, at: d.at, payee: byId(S.customers, r.customerId).name, amount: d.amount, accountId: d.accountId, method: byId(S.accounts, d.accountId).type === "CASH" ? "CASH" : "TRANSFER", chequeNo: "", forWhat: "رد تأمين عقد إيجار " + r.no, projectId: r.projectId, by: d.by, approvedBy: d.by, ref: r.no, customerId: r.customerId }); }
    return out.sort((a, b) => b.at - a.at);
  });
}

/* ─── العملاء ─── */
function blacklistState(cid) {
  const ev = S.blacklist.filter((b) => b.customerId === cid).sort((a, b) => a.at - b.at);
  const last = ev[ev.length - 1];
  return last && last.action === "BLACKLIST" ? last : null;
}
function assertCanTransact(cid, term) {
  const bl = blacklistState(cid);
  if (!bl) return;
  if (bl.scope === "ALL") throw new DomainError(`العميل في القائمة السوداء (${bl.reason}). العمليات الجديدة موقوفة بقرار المالك.`);
  if (bl.scope === "CREDIT" && term !== "CASH") throw new DomainError(`العميل في القائمة السوداء للبيع الآجل (${bl.reason}). المسموح نقدي فقط.`);
}
function assertProject(cid, pid) {
  const p = byId(S.projects, pid);
  if (!p || p.customerId !== cid) throw new DomainError("المشروع لا يتبع هذا العميل");
}

/* ─── البيع ─── */
function createSale(input, actor) {
  const dup = idem(input.idemKey);
  if (dup) return { ...dup, duplicate: true };
  const at = input.at || Date.now();
  const cust = byId(S.customers, input.customerId);
  if (!cust) throw new DomainError("اختر العميل");
  if (!input.projectId) throw new DomainError("اختر المشروع");
  assertProject(cust.id, input.projectId);
  assertCanTransact(cust.id, input.term);
  if (!input.lines?.length) throw new DomainError("أضف صنفًا واحدًا على الأقل");
  const rate = S.settings.vatRate;
  const lines = input.lines.map((l) => {
    const p = byId(S.products, l.pid);
    if (!p || p.status !== "ACTIVE") throw new DomainError("صنف غير متاح للبيع");
    if (!Number.isInteger(l.count) || l.count <= 0) throw new DomainError(`العدد غير صالح للصنف ${p.name}`);
    return { pid: p.id, sku: p.sku, name: p.name, len: p.len, pricing: p.pricing, count: l.count, price: l.price ?? p.price, cost: p.cost, disc: l.disc || 0 };
  });
  let t;
  try {
    t = saleTotals(lines, input.docDisc, rate);
  } catch (e) {
    throw new DomainError(e.message);
  }
  lines.forEach((l, i) => {
    if (t.calc[i].disc > t.calc[i].gross) throw new DomainError(`خصم البند أكبر من قيمته (${l.name})`);
  });
  if (t.docDisc > t.gross - t.itemsDisc) throw new DomainError("خصم المستند أكبر من الصافي");
  // المخزون: مجموع العدد لكل صنف ≤ المتاح في المستودع المختار
  const need = {};
  lines.forEach((l) => (need[l.pid] = (need[l.pid] || 0) + l.count));
  for (const pid in need) {
    const avail = bal(pid, input.wh).AVAILABLE;
    if (need[pid] > avail) {
      const p = byId(S.products, pid);
      const other = S.warehouses.filter((w) => w.id !== input.wh && bal(pid, w.id).AVAILABLE >= need[pid]);
      throw new DomainError(`الكمية غير متوفرة: ${p.name} — المتاح ${avail} في ${byId(S.warehouses, input.wh).name}${other.length ? ` (متوفر في ${other[0].name})` : ""}`);
    }
  }
  const paidNow = input.term === "CREDIT" ? 0 : Math.round(input.paid ?? (input.term === "CASH" ? t.total : 0));
  if (paidNow < 0 || paidNow > t.total) throw new DomainError("المدفوع لا يمكن أن يتجاوز الإجمالي");
  if (input.term === "CASH" && paidNow !== t.total) throw new DomainError("البيع النقدي يُدفع بالكامل");
  if (input.term === "PARTIAL" && (paidNow <= 0 || paidNow >= t.total)) throw new DomainError("في الدفع الجزئي أدخل مبلغًا أقل من الإجمالي");
  if (paidNow > 0 && !input.accountId) throw new DomainError("اختر حساب القبض");

  const seller = byId(S.users, input.sellerId || actor.id);
  const limit = actor.role === "OWNER" ? 100 : seller?.maxDisc ?? S.settings.sellerMaxDiscountPct;
  const needsApproval = t.discPct > limit + 1e-9;

  const sale = {
    id: uid("sale"),
    no: nextNo("S", at),
    at,
    sellerId: seller.id,
    repId: input.repId || cust.repId || null,
    customerId: cust.id,
    projectId: input.projectId,
    wh: input.wh,
    term: input.term,
    due: input.term === "CASH" ? at : input.due || at + S.settings.creditDays * DAY,
    lines,
    docDisc: t.docDisc,
    rate,
    gross: t.gross,
    itemsDisc: t.itemsDisc,
    taxable: t.taxable,
    vat: t.vat,
    total: t.total,
    cost: lines.reduce((a, l) => a + l.cost * l.count, 0),
    status: needsApproval ? "PENDING_APPROVAL" : "CONFIRMED",
    notes: input.notes || "",
    location: input.location || "",
    pendingPayment: needsApproval && paidNow > 0 ? { amount: paidNow, accountId: input.accountId, method: input.method } : null,
  };
  S.sales.push(sale);
  audit(actor, "SALE_CREATE", "Sale", sale.id, null, { no: sale.no, total: sale.total, status: sale.status }, at);
  let result;
  if (needsApproval) {
    S.approvals.push({ id: uid("ap"), type: "SALE_DISCOUNT", entity: "Sale", entityId: sale.id, status: "PENDING", at, requestedBy: actor.id, amount: t.totalDisc, summary: `خصم ${t.discPct.toFixed(1)}% على البيع ${sale.no} (الحد ${limit}%)` });
    result = { sale, pending: true };
  } else {
    result = { sale, ...confirmSale(sale, actor, { paidNow, accountId: input.accountId, method: input.method, at, driver: input.driver }) };
  }
  remember(input.idemKey, result);
  touch();
  return result;
}

/** تأكيد البيع: حركة خروج + سند استلام + فاتورة + قبض (إن وجد) — كلها معًا */
function confirmSale(sale, actor, { paidNow = 0, accountId, method, at, driver } = {}) {
  at = at || Date.now();
  for (const l of sale.lines) {
    if (bal(l.pid, sale.wh).AVAILABLE < l.count) throw new DomainError(`الكمية لم تعد متوفرة: ${l.name}`);
  }
  const dn = {
    id: uid("dn"),
    no: nextNo("DN", at),
    kind: "SALE",
    refId: sale.id,
    customerId: sale.customerId,
    projectId: sale.projectId,
    wh: sale.wh,
    at,
    driver: driver || "",
    repName: byId(S.reps, sale.repId)?.name || "",
    lines: sale.lines.map((l) => ({ pid: l.pid, name: l.name, count: l.count, meters: lineCalc(byId(S.products, l.pid), l).meters, price: l.price })),
    createdBy: actor.id,
  };
  S.deliveries.push(dn);
  for (const l of sale.lines) move({ type: "SALE_OUT", pid: l.pid, wh: sale.wh, qty: l.count, from: "AVAILABLE", to: null, at, saleId: sale.id, dnId: dn.id, customerId: sale.customerId, projectId: sale.projectId, by: actor.id });
  const inv = createInvoice({
    kind: "SALE",
    refId: sale.id,
    customerId: sale.customerId,
    projectId: sale.projectId,
    sellerId: sale.sellerId,
    at,
    due: sale.due,
    gross: sale.gross,
    disc: sale.itemsDisc + sale.docDisc,
    taxable: sale.taxable,
    rate: sale.rate,
    items: sale.lines.map((l) => ({ desc: l.name, qty: l.count, price: l.price, disc: l.disc, net: lineCalc(byId(S.products, l.pid), l).net })),
    actor,
  });
  sale.status = "CONFIRMED";
  sale.invoiceId = inv.id;
  sale.dnId = dn.id;
  let payment = null;
  if (paidNow > 0) {
    payment = recordPaymentRaw({ customerId: sale.customerId, projectId: sale.projectId, allocations: [{ invoiceId: inv.id, amount: paidNow }], method: method || "CASH", accountId, repId: sale.repId, at, notes: `دفعة عند البيع ${sale.no}` }, actor);
  }
  return { invoice: inv, dn, payment };
}

/* ─── التحصيل ─── */
function recordPayment(input, actor) {
  const dup = idem(input.idemKey);
  if (dup) return { ...dup, duplicate: true };
  const p = recordPaymentRaw(input, actor);
  remember(input.idemKey, p);
  touch();
  return p;
}
function recordPaymentRaw(input, actor) {
  const at = input.at || Date.now();
  if (!input.accountId) throw new DomainError("اختر الحساب");
  if (!input.allocations?.length) throw new DomainError("لا توجد فاتورة للتخصيص");
  let total = 0;
  for (const a of input.allocations) {
    const inv = byId(S.invoices, a.invoiceId);
    if (!inv || inv.customerId !== input.customerId) throw new DomainError("الفاتورة لا تخص هذا العميل");
    if (!Number.isFinite(a.amount) || a.amount <= 0) throw new DomainError("المبلغ يجب أن يكون أكبر من صفر");
    const rem = invRemaining(inv);
    if (a.amount > rem) throw new DomainError(`المبلغ يتجاوز المتبقي على الفاتورة ${inv.no} (${(rem / 100).toFixed(2)})`);
    total += a.amount;
  }
  if (input.method === "CHEQUE" && !input.ref) throw new DomainError("أدخل رقم الشيك");
  const rep = byId(S.reps, input.repId);
  const pay = {
    id: uid("pay"),
    no: nextNo("RV", at),
    at,
    customerId: input.customerId,
    projectId: input.projectId || byId(S.invoices, input.allocations[0].invoiceId).projectId,
    amount: total,
    method: input.method || "CASH",
    accountId: input.accountId,
    ref: input.ref || "",
    repId: rep?.id || null,
    repName: rep?.name || "",
    recordedBy: actor.id,
    allocations: input.allocations.map((a) => ({ ...a })),
    notes: input.notes || "",
    status: "POSTED",
  };
  S.payments.push(pay);
  audit(actor, "PAYMENT_CREATE", "Payment", pay.id, null, { no: pay.no, amount: pay.amount, account: pay.accountId }, at);
  VER++;
  return pay;
}

/* ─── الإيجار ─── */
const BASIS_DAYS = { DAILY: 1, WEEKLY: 7, MONTHLY: 30 };
const BASIS_LABEL = { DAILY: "يومي", WEEKLY: "أسبوعي", MONTHLY: "شهري" };
const BASIS_UNIT = { DAILY: "يوم", WEEKLY: "أسبوع", MONTHLY: "شهر" };
const rateFor = (p, basis) => (basis === "DAILY" ? p.rentD : basis === "WEEKLY" ? p.rentW : p.rentM);

function rentalEstimate(lines, periods, discount, rate) {
  const lineTotals = lines.map((l) => l.qty * l.rate * periods);
  const gross = lineTotals.reduce((a, b) => a + b, 0);
  const disc = Math.max(0, Math.round(discount || 0));
  const taxable = gross - disc;
  const vat = vatOf(taxable, rate);
  return { lineTotals, gross, disc, taxable, vat, total: taxable + vat };
}

function createRental(input, actor) {
  const dup = idem(input.idemKey);
  if (dup) return { ...dup, duplicate: true };
  const at = input.at || Date.now();
  const cust = byId(S.customers, input.customerId);
  if (!cust) throw new DomainError("اختر العميل");
  if (!input.projectId) throw new DomainError("اختر المشروع");
  assertProject(cust.id, input.projectId);
  assertCanTransact(cust.id, "CREDIT");
  if (!input.lines?.length) throw new DomainError("أضف صنفًا واحدًا على الأقل");
  const periods = Math.round(input.periods);
  if (!(periods > 0)) throw new DomainError("المدة يجب أن تكون أكبر من صفر");
  const need = {};
  const lines = input.lines.map((l) => {
    const p = byId(S.products, l.pid);
    if (!Number.isInteger(l.qty) || l.qty <= 0) throw new DomainError("الكمية غير صالحة");
    need[p.id] = (need[p.id] || 0) + l.qty;
    return { pid: p.id, sku: p.sku, name: p.name, len: p.len, qty: l.qty, rate: l.rate ?? rateFor(p, input.basis), delivered: 0, returned: 0, billedThrough: null };
  });
  for (const pid in need) {
    const avail = bal(pid, input.wh).AVAILABLE;
    if (need[pid] > avail) throw new DomainError(`الكمية غير متوفرة: ${byId(S.products, pid).name} — المتاح ${avail}`);
  }
  const rate = S.settings.vatRate;
  const est = rentalEstimate(lines, periods, input.discount, rate);
  const startDay = dayNo(input.start || at);
  const r = {
    id: uid("rent"),
    no: nextNo("R", at),
    at,
    sellerId: input.sellerId || actor.id,
    repId: input.repId || cust.repId || null,
    customerId: cust.id,
    projectId: input.projectId,
    wh: input.wh,
    mode: input.mode || "FIXED",
    basis: input.basis,
    periods,
    startDay,
    endDay: startDay + periods * BASIS_DAYS[input.basis],
    rate,
    discount: est.disc,
    est,
    lines,
    deposit: Math.round(input.deposit || 0),
    status: "RESERVED",
    notes: input.notes || "",
    location: input.location || "",
  };
  S.rentals.push(r);
  for (const l of lines) move({ type: "RESERVE", pid: l.pid, wh: r.wh, qty: l.qty, from: "AVAILABLE", to: "RESERVED", at, rentalId: r.id, customerId: r.customerId, projectId: r.projectId, by: actor.id });
  let invoice = null;
  if (r.mode === "FIXED") {
    // المدة المتفق عليها تُفوتر عند العقد؛ ما يزيد عنها يُفوتر لاحقًا
    invoice = createInvoice({
      kind: "RENTAL",
      refId: r.id,
      customerId: r.customerId,
      projectId: r.projectId,
      sellerId: r.sellerId,
      at,
      due: at + (input.dueDays ?? 7) * DAY,
      gross: est.gross,
      disc: est.disc,
      taxable: est.taxable,
      rate,
      periodFrom: dayStart(r.startDay),
      periodTo: dayStart(r.endDay),
      items: lines.map((l, i) => ({ desc: `إيجار ${l.name} × ${l.qty} لمدة ${periods} ${BASIS_UNIT[r.basis]}`, qty: l.qty, price: l.rate * periods, disc: 0, net: est.lineTotals[i] })),
      actor,
    });
    lines.forEach((l) => (l.billedThrough = r.endDay));
  }
  audit(actor, "RENTAL_CREATE", "Rental", r.id, null, { no: r.no, estimate: est.total, mode: r.mode }, at);
  const result = { rental: r, invoice };
  remember(input.idemKey, result);
  touch();
  return result;
}

/** أحداث العهدة لبند: تسليم (+) ورد (−) بأيام الرياض */
function lineEvents(rentalId, idx) {
  return S.movements
    .filter((m) => m.rentalId === rentalId && m.lineIdx === idx && (m.type === "RENTAL_OUT" || m.type === "RENTAL_RETURN"))
    // عرف المؤسسة: الأيام تُحسب شاملة يوم التسليم ويوم الرد (كشف 01/02 ← 30/05 = 119 يومًا)
    // لذلك يخرج المرتجع من العدّ في اليوم التالي لرده
    .map((m) => ({ day: dayNo(m.at) + (m.type === "RENTAL_RETURN" ? 1 : 0), delta: m.type === "RENTAL_OUT" ? m.qty : -m.qty }));
}
function pieceDays(events, fromDay, toDay) {
  if (toDay <= fromDay) return 0;
  const ev = [...events].sort((a, b) => a.day - b.day);
  let total = 0,
    onSite = 0,
    cursor = fromDay;
  for (const e of ev) {
    if (e.day <= fromDay) {
      onSite += e.delta;
      continue;
    }
    if (e.day >= toDay) break;
    total += onSite * (e.day - cursor);
    cursor = e.day;
    onSite += e.delta;
  }
  return Math.max(0, total + onSite * (toDay - cursor));
}
/** القيمة المستحقة غير المفوترة حتى يوم معيّن (حصري) */
function rentalUnbilled(r, untilDay = dayNo(Date.now()) + 1) {
  let gross = 0;
  const parts = r.lines.map((l, i) => {
    const ev = lineEvents(r.id, i);
    if (!ev.length) return { pd: 0, amount: 0 };
    const firstDay = Math.min(...ev.map((e) => e.day));
    const from = l.billedThrough ?? firstDay;
    const pd = pieceDays(ev, from, untilDay);
    const amount = Math.round((pd * l.rate) / BASIS_DAYS[r.basis]);
    gross += amount;
    return { pd, amount, from };
  });
  return { gross, parts };
}
/** قيمة الإيجار المستحقة فعليًا منذ البداية حتى اليوم (للعرض في البروفايل) */
function rentalAccruedToDate(r) {
  const today = dayNo(Date.now()) + 1;
  let gross = 0;
  r.lines.forEach((l, i) => {
    const ev = lineEvents(r.id, i);
    if (!ev.length) return;
    const first = Math.min(...ev.map((e) => e.day));
    gross += Math.round((pieceDays(ev, first, today) * l.rate) / BASIS_DAYS[r.basis]);
  });
  return gross;
}
function rentalInvoiced(r) {
  return S.invoices.filter((i) => i.refId === r.id && i.status !== "CANCELLED").reduce((a, i) => a + i.total, 0);
}
function rentalStatusCalc(r) {
  if (r.status === "CANCELLED" || r.status === "CLOSED") return r.status;
  const delivered = r.lines.reduce((a, l) => a + l.delivered, 0);
  const returned = r.lines.reduce((a, l) => a + l.returned, 0);
  const ordered = r.lines.reduce((a, l) => a + l.qty, 0);
  if (!delivered) return "RESERVED";
  if (returned >= delivered && delivered >= ordered) return "RETURNED";
  if (returned > 0) return "PARTIALLY_RETURNED";
  return "ACTIVE";
}
function isRentalOverdue(r) {
  const st = rentalStatusCalc(r);
  return (st === "ACTIVE" || st === "PARTIALLY_RETURNED") && r.mode === "FIXED" && dayNo(Date.now()) >= r.endDay;
}

function deliverRental(rentalId, input, actor) {
  const dup = idem(input.idemKey);
  if (dup) return { ...dup, duplicate: true };
  const r = byId(S.rentals, rentalId);
  const at = input.at || Date.now();
  if (["CLOSED", "CANCELLED"].includes(r.status)) throw new DomainError("العقد مغلق — لا يمكن التسليم");
  const lines = input.lines.filter((x) => x.qty > 0);
  if (!lines.length) throw new DomainError("أدخل الكميات المسلمة");
  for (const x of lines) {
    const l = r.lines[x.idx];
    if (x.qty > l.qty - l.delivered) throw new DomainError(`الكمية أكبر من المتبقي للتسليم (${l.name}: ${l.qty - l.delivered})`);
  }
  const dn = {
    id: uid("dn"),
    no: nextNo("DN", at),
    kind: "RENTAL",
    refId: r.id,
    customerId: r.customerId,
    projectId: r.projectId,
    wh: r.wh,
    at,
    driver: input.driver || "",
    receiver: input.receiver || "",
    repName: byId(S.reps, r.repId)?.name || "",
    lines: lines.map((x) => {
      const l = r.lines[x.idx];
      return { pid: l.pid, name: l.name, count: x.qty, meters: l.len ? Math.round(l.len * x.qty * 100) / 100 : null, price: l.rate };
    }),
    createdBy: actor.id,
  };
  S.deliveries.push(dn);
  for (const x of lines) {
    const l = r.lines[x.idx];
    l.delivered += x.qty;
    move({ type: "RENTAL_OUT", pid: l.pid, wh: r.wh, qty: x.qty, from: "RESERVED", to: "RENTED", at, rentalId: r.id, lineIdx: x.idx, dnId: dn.id, customerId: r.customerId, projectId: r.projectId, by: actor.id });
  }
  const transport = Math.round(input.transport || 0);
  if (transport < 0) throw new DomainError("أجرة النقل غير صالحة");
  if (transport > 0) dn.transportInvoiceId = feesInvoice(r, transport, `أجرة نقل — تسليم ${dn.no}`, at, actor).id;
  dn.transport = transport;
  r.status = rentalStatusCalc(r);
  audit(actor, "RENTAL_DELIVER", "Rental", r.id, null, { dn: dn.no, qty: lines.reduce((a, x) => a + x.qty, 0) }, at);
  const result = { dn };
  remember(input.idemKey, result);
  touch();
  return result;
}

/** فاتورة رسوم (نقل، صيانة/تعويض) مرتبطة بالعقد */
function feesInvoice(r, amount, desc, at, actor) {
  return createInvoice({ kind: "FEES", refId: r.id, customerId: r.customerId, projectId: r.projectId, sellerId: r.sellerId, at, due: at + 7 * DAY, gross: amount, disc: 0, taxable: amount, rate: S.settings.vatRate, items: [{ desc, qty: 1, price: amount, disc: 0, net: amount }], actor });
}

const COND_LABEL = { GOOD: "سليم", MAINTENANCE: "يحتاج صيانة", DAMAGED: "تالف", LOST: "مفقود" };
const COND_STATE = { GOOD: "AVAILABLE", MAINTENANCE: "MAINTENANCE", DAMAGED: "DAMAGED", LOST: "LOST" };

function returnRental(rentalId, input, actor) {
  const dup = idem(input.idemKey);
  if (dup) return { ...dup, duplicate: true };
  const r = byId(S.rentals, rentalId);
  const at = input.at || Date.now();
  const lines = input.lines.filter((x) => x.qty > 0);
  if (!lines.length) throw new DomainError("أدخل الكميات المرتجعة");
  const perLine = {};
  for (const x of lines) perLine[x.idx] = (perLine[x.idx] || 0) + x.qty;
  for (const idx in perLine) {
    const l = r.lines[idx];
    const onSite = l.delivered - l.returned;
    if (perLine[idx] > onSite) throw new DomainError(`المرتجع أكبر من الموجود لدى العميل (${l.name}: ${onSite})`);
  }
  const fee = Math.round(input.fee || 0);
  if (fee < 0) throw new DomainError("مبلغ الصيانة غير صالح");
  const rn = {
    id: uid("rn"),
    no: nextNo("RN", at),
    rentalId: r.id,
    customerId: r.customerId,
    projectId: r.projectId,
    wh: r.wh,
    at,
    driver: input.driver || "",
    counter: input.counter || actor.name,
    gate: input.gate || "",
    fee,
    lines: lines.map((x) => ({ idx: x.idx, pid: r.lines[x.idx].pid, name: r.lines[x.idx].name, qty: x.qty, cond: x.cond || "GOOD" })),
    createdBy: actor.id,
    notes: input.notes || "",
  };
  S.returns.push(rn);
  for (const x of rn.lines) {
    const l = r.lines[x.idx];
    l.returned += x.qty;
    move({ type: "RENTAL_RETURN", pid: l.pid, wh: r.wh, qty: x.qty, from: "RENTED", to: COND_STATE[x.cond], at, rentalId: r.id, lineIdx: x.idx, rnId: rn.id, customerId: r.customerId, projectId: r.projectId, by: actor.id, cond: x.cond });
  }
  let feeInvoice = null;
  if (fee > 0) {
    feeInvoice = feesInvoice(r, fee, `مبلغ صيانة/تعويض — كشف دخول ${rn.no}`, at, actor);
    rn.feeInvoiceId = feeInvoice.id;
  }
  const transport = Math.round(input.transport || 0);
  if (transport < 0) throw new DomainError("أجرة النقل غير صالحة");
  if (transport > 0) rn.transportInvoiceId = feesInvoice(r, transport, `أجرة نقل — مرتجع ${rn.no}`, at, actor).id;
  rn.transport = transport;
  // عند اكتمال الرد يُلغى حجز ما لم يُسلَّم
  r.status = rentalStatusCalc(r);
  audit(actor, "RENTAL_RETURN", "Rental", r.id, null, { rn: rn.no, qty: rn.lines.reduce((a, x) => a + x.qty, 0), fee }, at);
  const result = { rn, feeInvoice };
  remember(input.idemKey, result);
  touch();
  return result;
}

/** فوترة الإيجار حتى اليوم: قطعة × يوم الفعلية منذ آخر فوترة */
function billRental(rentalId, actor, untilDay, at) {
  const r = byId(S.rentals, rentalId);
  at = at || Date.now();
  untilDay = untilDay ?? dayNo(at) + 1;
  const ub = rentalUnbilled(r, untilDay);
  if (ub.gross <= 0) throw new DomainError("لا توجد قيمة غير مفوترة حتى اليوم");
  const from = Math.min(...ub.parts.filter((p) => p.amount > 0).map((p) => p.from));
  const inv = createInvoice({
    kind: "RENTAL",
    refId: r.id,
    customerId: r.customerId,
    projectId: r.projectId,
    sellerId: r.sellerId,
    at,
    due: at + 7 * DAY,
    gross: ub.gross,
    disc: 0,
    taxable: ub.gross,
    rate: S.settings.vatRate,
    periodFrom: dayStart(from),
    periodTo: dayStart(untilDay),
    items: r.lines
      .map((l, i) => ({ l, p: ub.parts[i] }))
      .filter((x) => x.p.amount > 0)
      .map(({ l, p }) => ({ desc: `إيجار ${l.name}: ${p.pd} قطعة×يوم`, qty: p.pd, price: Math.round(l.rate / BASIS_DAYS[r.basis]), disc: 0, net: p.amount })),
    actor,
  });
  r.lines.forEach((l, i) => {
    if (ub.parts[i].pd > 0 || l.billedThrough) l.billedThrough = Math.max(l.billedThrough || 0, untilDay);
  });
  audit(actor, "RENTAL_BILL", "Rental", r.id, null, { invoice: inv.no, total: inv.total }, at);
  touch();
  return inv;
}

function rentalDeposit(rentalId, input, actor) {
  const r = byId(S.rentals, rentalId);
  const at = input.at || Date.now();
  const amount = Math.round(input.amount);
  if (!(amount > 0)) throw new DomainError("المبلغ غير صالح");
  const held = depositHeld(r.id);
  if (input.kind !== "RECEIVED" && amount > held) throw new DomainError("المبلغ أكبر من التأمين المحتفظ به");
  if (input.kind === "REFUNDED") assertCash(input.accountId, amount);
  const d = { id: uid("dep"), rentalId, kind: input.kind, amount, accountId: input.accountId, at, by: actor.id, pvNo: input.kind === "REFUNDED" ? nextNo("PV", at) : null };
  S.deposits.push(d);
  audit(actor, "DEPOSIT_" + input.kind, "Rental", r.id, null, { amount }, at);
  touch();
  return d;
}
function depositHeld(rentalId) {
  return S.deposits.filter((d) => d.rentalId === rentalId).reduce((a, d) => a + (d.kind === "RECEIVED" ? d.amount : -d.amount), 0);
}

/* ─── المصروفات والموافقات ─── */
function createExpense(input, actor) {
  const dup = idem(input.idemKey);
  if (dup) return { ...dup, duplicate: true };
  const at = input.at || Date.now();
  const amount = Math.round(input.amount);
  if (!(amount > 0)) throw new DomainError("المبلغ يجب أن يكون أكبر من صفر");
  if (!input.accountId) throw new DomainError("اختر الحساب");
  if (input.method === "CHEQUE" && !(input.chequeNo || "").trim()) throw new DomainError("أدخل رقم الشيك");
  if (!input.cat) throw new DomainError("اختر نوع المصروف");
  const needs = amount >= S.settings.expenseThreshold;
  if (!needs) assertCash(input.accountId, amount);
  const e = {
    id: uid("exp"),
    no: nextNo("EX", at),
    at,
    cat: input.cat,
    amount,
    accountId: input.accountId,
    projectId: input.projectId || null,
    desc: input.desc || "",
    payee: (input.payee || "").trim(),
    method: input.method || (byId(S.accounts, input.accountId)?.type === "CASH" ? "CASH" : "TRANSFER"),
    chequeNo: (input.chequeNo || "").trim(),
    attachment: input.attachment || null,
    status: needs ? "PENDING" : "APPROVED",
    requestedBy: actor.id,
    reviewedBy: needs ? null : actor.id,
    reviewedAt: needs ? null : at,
    postedAt: needs ? null : at,
    pvNo: needs ? null : nextNo("PV", at),
    reason: needs ? "" : "اعتماد تلقائي (أقل من حد الاعتماد)",
  };
  S.expenses.push(e);
  if (needs) S.approvals.push({ id: uid("ap"), type: "EXPENSE", entity: "Expense", entityId: e.id, status: "PENDING", at, requestedBy: actor.id, amount, summary: `مصروف ${e.cat} بمبلغ ${(amount / 100).toLocaleString("en-US")} ر.س` });
  audit(actor, "EXPENSE_CREATE", "Expense", e.id, null, { no: e.no, amount, status: e.status }, at);
  const result = { expense: e };
  remember(input.idemKey, result);
  touch();
  return result;
}

function decideApproval(apId, decision, reason, actor, at) {
  at = at || Date.now();
  const ap = byId(S.approvals, apId);
  if (!ap) throw new DomainError("الطلب غير موجود");
  if (ap.status !== "PENDING") throw new DomainError("تم البت في هذا الطلب مسبقًا — لا يتكرر الأثر");
  if (decision === "REJECTED" && !reason) throw new DomainError("اكتب سبب الرفض");
  const before = { status: ap.status };
  if (ap.type === "EXPENSE") {
    const e = byId(S.expenses, ap.entityId);
    if (e.status !== "PENDING") throw new DomainError("تم البت في المصروف مسبقًا");
    if (decision === "APPROVED") assertCash(e.accountId, e.amount);
    e.status = decision;
    e.reviewedBy = actor.id;
    e.reviewedAt = at;
    e.reason = reason || "";
    if (decision === "APPROVED") {
      e.postedAt = at;
      e.pvNo = nextNo("PV", at);
    }
  } else if (ap.type === "SALE_DISCOUNT") {
    const s = byId(S.sales, ap.entityId);
    if (decision === "APPROVED") {
      const pp = s.pendingPayment;
      confirmSale(s, actor, { paidNow: pp?.amount || 0, accountId: pp?.accountId, method: pp?.method, at });
    } else {
      s.status = "CANCELLED";
      s.cancelReason = reason;
    }
  }
  ap.status = decision;
  ap.decidedBy = actor.id;
  ap.decidedAt = at;
  ap.reason = reason || "";
  audit(actor, "APPROVAL_" + decision, ap.entity, ap.entityId, before, { status: decision, reason }, at);
  touch();
  return ap;
}

/* ─── العملاء والمشاريع ─── */
function addCustomer(input, actor) {
  const type = input.type;
  if (!input.name?.trim()) throw new DomainError("اسم العميل مطلوب");
  const mobile = normalizeMobile(input.mobile);
  if (!/^05\d{8}$/.test(mobile)) throw new DomainError("رقم الجوال غير صحيح (05XXXXXXXX)");
  const c = {
    id: uid("cus"),
    code: nextCode("C"),
    type,
    name: input.name.trim(),
    tradeName: type === "COMPANY" ? input.tradeName?.trim() || null : null,
    nationalId: type === "INDIVIDUAL" ? normalizeId(input.nationalId) : null,
    iqama: type === "INDIVIDUAL" ? normalizeId(input.iqama) : null,
    cr: type === "COMPANY" ? normalizeId(input.cr) : null,
    vat: type === "COMPANY" ? normalizeId(input.vat) : null,
    mobile,
    city: input.city || "المدينة المنورة",
    address: input.address || "",
    fileNo: input.fileNo || "",
    ...guarantorFields(input),
    repId: input.repId || actor.repId || null,
    createdBy: actor.id,
    at: input.at || Date.now(),
  };
  if (type === "INDIVIDUAL" && !c.nationalId && !c.iqama) throw new DomainError("أدخل رقم الهوية الوطنية أو الإقامة");
  if (type === "COMPANY" && !c.cr) throw new DomainError("أدخل رقم السجل التجاري");
  const dupKey = S.customers.find((x) => (c.nationalId && x.nationalId === c.nationalId) || (c.iqama && x.iqama === c.iqama) || (c.cr && x.cr === c.cr));
  if (dupKey) throw new DomainError(`يوجد عميل مسجل بنفس رقم التعريف: ${dupKey.code}`);
  S.customers.push(c);
  audit(actor, "CUSTOMER_CREATE", "Customer", c.id, null, { code: c.code, name: c.name }, c.at);
  if (input.projectName) addProject({ customerId: c.id, name: input.projectName, location: input.projectLocation, at: c.at }, actor, true);
  touch();
  return c;
}
function addProject(input, actor, silent) {
  if (!input.name?.trim()) throw new DomainError("اسم المشروع مطلوب");
  const p = { id: uid("prj"), code: nextCode("P"), customerId: input.customerId, name: input.name.trim(), location: input.location || "", details: input.details || "", at: input.at || Date.now() };
  S.projects.push(p);
  audit(actor, "PROJECT_CREATE", "Project", p.id, null, { code: p.code, name: p.name }, p.at);
  if (!silent) touch();
  return p;
}

/** الكفيل الغارم (اختياري): إن أُدخل أي حقل فالاسم مطلوب، والجوال والهوية بصيغة صحيحة */
function guarantorFields(input) {
  const name = (input.guarantor || "").trim();
  const idNo = normalizeId(input.guarantorId) || "";
  const mob = normalizeMobile(input.guarantorMobile || "");
  if ((idNo || mob) && !name) throw new DomainError("أدخل اسم الكفيل الغارم");
  if (mob && !/^05\d{8}$/.test(mob)) throw new DomainError("جوال الكفيل غير صحيح (05XXXXXXXX)");
  if (idNo && !/^[12]\d{9}$/.test(idNo)) throw new DomainError("رقم هوية/إقامة الكفيل يجب أن يكون 10 أرقام يبدأ بـ 1 أو 2");
  return { guarantor: name, guarantorId: idNo, guarantorMobile: mob };
}
function updateGuarantor(cid, input, actor) {
  const c = byId(S.customers, cid);
  const before = { guarantor: c.guarantor, guarantorId: c.guarantorId, guarantorMobile: c.guarantorMobile };
  Object.assign(c, guarantorFields(input));
  audit(actor, "GUARANTOR_UPDATE", "Customer", c.id, before, { guarantor: c.guarantor, guarantorId: c.guarantorId, guarantorMobile: c.guarantorMobile });
  touch();
  return c;
}

/* ─── البحث: خمسة مفاتيح + أرقام عربية + صيغ الجوال ─── */
function toLatin(s) {
  return String(s || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
}
function normalizeId(s) {
  const v = toLatin(s).replace(/[^0-9A-Za-z]/g, "");
  return v || null;
}
function normalizeMobile(s) {
  let v = toLatin(s).replace(/[^0-9]/g, "");
  if (v.startsWith("00966")) v = v.slice(5);
  else if (v.startsWith("966")) v = v.slice(3);
  if (v.length === 9 && v.startsWith("5")) v = "0" + v;
  return v;
}
function normText(s) {
  return toLatin(s).replace(/[ً-ٟ]/g, "").replace(/[إأآا]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").toLowerCase().trim();
}
/** يعيد [{customer, key}] حيث key هو المفتاح الذي طابق */
function searchCustomers(q) {
  const raw = String(q || "").trim();
  if (!raw) return [];
  const digits = normalizeId(raw);
  const mob = normalizeMobile(raw);
  const t = normText(raw);
  const out = [];
  for (const c of S.customers) {
    let key = null;
    if (digits && digits.length >= 4) {
      if (c.nationalId && c.nationalId.includes(digits)) key = "الهوية الوطنية";
      else if (c.iqama && c.iqama.includes(digits)) key = "الإقامة";
      else if (c.cr && c.cr.includes(digits)) key = "السجل التجاري";
      else if (mob && c.mobile.includes(mob.replace(/^0/, ""))) key = "الجوال";
      else if (c.fileNo && c.fileNo === digits) key = "رقم الملف";
    }
    if (!key && t.length >= 2) {
      if (c.tradeName && normText(c.tradeName).includes(t)) key = "العلامة التجارية";
      else if (normText(c.name).includes(t)) key = "الاسم";
      else if (normText(c.code).includes(t)) key = "الكود";
    }
    if (key) out.push({ customer: c, key });
  }
  return out;
}

/* ─── ملخص العميل/المشروع ─── */
function customerSummary(cid, pid) {
  return cached(`cs|${cid}|${pid || ""}`, () => {
    const inP = (x) => x.customerId === cid && (!pid || x.projectId === pid);
    const invs = S.invoices.filter((i) => inP(i) && i.status !== "CANCELLED");
    const sales = S.sales.filter((s) => inP(s) && s.status !== "CANCELLED");
    const rentals = S.rentals.filter((r) => inP(r) && r.status !== "CANCELLED");
    const pays = S.payments.filter((p) => p.customerId === cid && p.status !== "VOID");
    const invoiced = invs.reduce((a, i) => a + i.total, 0);
    const paid = invs.reduce((a, i) => a + invPaid(i), 0);
    const salesTotal = invs.filter((i) => i.kind === "SALE").reduce((a, i) => a + i.total, 0);
    const rentalInvoiced = invs.filter((i) => i.kind !== "SALE").reduce((a, i) => a + i.total, 0);
    const overdue = invs.filter((i) => invStatus(i) === "OVERDUE");
    let onSite = 0,
      delivered = 0,
      returned = 0,
      accrued = 0,
      unbilled = 0,
      damaged = 0,
      lost = 0;
    for (const r of rentals) {
      for (const l of r.lines) {
        delivered += l.delivered;
        returned += l.returned;
        onSite += l.delivered - l.returned;
      }
      accrued += rentalAccruedToDate(r);
      unbilled += rentalUnbilled(r).gross;
    }
    for (const rn of S.returns.filter(inP)) for (const l of rn.lines) {
      if (l.cond === "DAMAGED") damaged += l.qty;
      if (l.cond === "LOST") lost += l.qty;
    }
    const soldPieces = sales.filter((s) => s.status === "CONFIRMED").reduce((a, s) => a + s.lines.reduce((b, l) => b + l.count, 0), 0);
    const activeRentals = rentals.filter((r) => ["ACTIVE", "PARTIALLY_RETURNED", "RESERVED"].includes(rentalStatusCalc(r)));
    const lastOp = [...sales, ...rentals].sort((a, b) => b.at - a.at)[0];
    const unbilledVat = vatOf(unbilled, S.settings.vatRate);
    return {
      invoiced,
      paid: pid ? paid : pays.reduce((a, p) => a + p.amount, 0),
      allocatedPaid: paid,
      balance: invoiced - paid,
      salesTotal,
      rentalInvoiced,
      overdue,
      overdueAmount: overdue.reduce((a, i) => a + invRemaining(i), 0),
      onSite,
      delivered,
      returned,
      damaged,
      lost,
      soldPieces,
      accrued,
      unbilled,
      unbilledWithVat: unbilled + unbilledVat,
      activeRentals,
      salesCount: sales.length,
      rentalsCount: rentals.length,
      lastOp,
    };
  });
}

/** عهدة العميل: صنف × مشروع (مسلم / مرتجع / بالموقع) — من الحركات مباشرة */
function custodyRows(cid, pid) {
  const m = {};
  for (const mv of S.movements) {
    if (mv.customerId !== cid || (pid && mv.projectId !== pid)) continue;
    if (mv.type !== "RENTAL_OUT" && mv.type !== "RENTAL_RETURN") continue;
    const k = mv.projectId + "|" + mv.pid;
    const row = (m[k] ||= { projectId: mv.projectId, pid: mv.pid, delivered: 0, returned: 0, good: 0, maint: 0, damaged: 0, lost: 0 });
    if (mv.type === "RENTAL_OUT") row.delivered += mv.qty;
    else {
      row.returned += mv.qty;
      if (mv.cond === "GOOD") row.good += mv.qty;
      else if (mv.cond === "MAINTENANCE") row.maint += mv.qty;
      else if (mv.cond === "DAMAGED") row.damaged += mv.qty;
      else if (mv.cond === "LOST") row.lost += mv.qty;
    }
  }
  return Object.values(m).map((r) => ({ ...r, onSite: r.delivered - r.returned }));
}

/** كل سندات العميل في سجل واحد */
function customerDocuments(cid, pid) {
  const inP = (x) => x.customerId === cid && (!pid || x.projectId === pid);
  const docs = [];
  for (const s of S.sales.filter(inP)) docs.push({ type: "بيع", kind: "sale", id: s.id, no: s.no, at: s.at, amount: s.total, projectId: s.projectId, status: s.status });
  for (const r of S.rentals.filter(inP)) docs.push({ type: "عقد إيجار", kind: "rental", id: r.id, no: r.no, at: r.at, amount: r.est.total, projectId: r.projectId, status: rentalStatusCalc(r) });
  for (const i of S.invoices.filter(inP)) docs.push({ type: "فاتورة", kind: "invoice", id: i.id, no: i.no, at: i.at, amount: i.total, projectId: i.projectId, status: invStatus(i) });
  for (const d of S.deliveries.filter(inP)) docs.push({ type: d.kind === "SALE" ? "سند استلام مواد — بيع" : "سند استلام مواد — تأجير", kind: "dn", id: d.id, no: d.no, at: d.at, qty: d.lines.reduce((a, l) => a + l.count, 0), projectId: d.projectId, status: "ISSUED" });
  for (const r of S.returns.filter(inP)) docs.push({ type: "كشف دخول (مرتجع)", kind: "rn", id: r.id, no: r.no, at: r.at, qty: r.lines.reduce((a, l) => a + l.qty, 0), projectId: r.projectId, status: "ISSUED" });
  for (const p of S.payments.filter((x) => x.customerId === cid && (!pid || x.projectId === pid))) docs.push({ type: "سند قبض", kind: "payment", id: p.id, no: p.no, at: p.at, amount: p.amount, projectId: p.projectId, status: p.status, rep: p.repName });
  for (const n of S.promissory.filter(inP)) docs.push({ type: "سند لأمر", kind: "promissory", id: n.id, no: n.no, at: n.at, amount: n.amount, projectId: n.projectId, status: n.status });
  return docs.sort((a, b) => b.at - a.at);
}

/* ─── التنبيهات (تُشتق من البيانات وتصل للمستخدم المختص) ─── */
function notificationsFor(user) {
  return cached("notif|" + user.id, () => {
    const out = [];
    const now = Date.now();
    const seeAll = user.role === "OWNER" || user.role === "FINANCE";
    if (user.role !== "WAREHOUSE")
      for (const i of S.invoices) {
        if (!seeAll && i.sellerId !== user.id) continue;
        const st = invStatus(i);
        if (st === "OVERDUE") out.push({ key: "od-" + i.id, type: "red", title: `فاتورة متأخرة ${i.no}`, body: `${byId(S.customers, i.customerId).name} — متبقي ${(invRemaining(i) / 100).toLocaleString("en-US")} ر.س`, link: "#/invoices/" + i.id, at: i.due });
        else if ((st === "UNPAID" || st === "PARTIAL") && dayNo(i.due) - dayNo(now) <= S.settings.dueSoonDays && dayNo(i.due) >= dayNo(now))
          out.push({ key: "ds-" + i.id, type: "amber", title: `استحقاق قريب ${i.no}`, body: `يستحق ${fmtDate(i.due)}`, link: "#/invoices/" + i.id, at: i.due });
      }
    for (const r of S.rentals) {
      if (!seeAll && user.role === "SELLER" && r.sellerId !== user.id) continue;
      if (isRentalOverdue(r)) out.push({ key: "ro-" + r.id, type: "red", title: `عقد إيجار تجاوز مدته ${r.no}`, body: byId(S.customers, r.customerId).name, link: "#/rentals/" + r.id, at: dayStart(r.endDay) });
    }
    if (user.role !== "SELLER")
      for (const p of S.products) {
        const b = balAll(p.id);
        if (p.status === "ACTIVE" && b.AVAILABLE <= p.min) out.push({ key: "ls-" + p.id, type: "amber", title: `مخزون منخفض: ${p.name}`, body: `المتاح ${b.AVAILABLE} — الحد الأدنى ${p.min}`, link: "#/inventory/" + p.id, at: now - 1 });
      }
    if (user.role === "OWNER") for (const a of S.approvals.filter((a) => a.status === "PENDING")) out.push({ key: "ap-" + a.id, type: "blue", title: "طلب موافقة", body: a.summary, link: "#/approvals", at: a.at });
    if (user.role === "SELLER") for (const a of S.approvals.filter((a) => a.requestedBy === user.id && a.status !== "PENDING" && now - a.decidedAt < 7 * DAY)) out.push({ key: "apd-" + a.id, type: a.status === "APPROVED" ? "green" : "red", title: a.status === "APPROVED" ? "تم اعتماد طلبك" : "تم رفض طلبك", body: a.summary, link: "#/sales", at: a.decidedAt });
    for (const r of (S.reminders || []).filter((r) => r.userId === user.id && !r.done && r.due && dayNo(r.due) <= dayNo(now))) out.push({ key: "rm-" + r.id, type: dayNo(r.due) < dayNo(now) ? "red" : "blue", title: "تذكير", body: r.text, link: r.customerId ? "#/customers/" + r.customerId : "#" + ROLE_HOME[user.role], at: r.due });
    for (const f of S.followups.filter((f) => f.userId === user.id && f.next && dayNo(f.next) <= dayNo(now) && !f.done)) out.push({ key: "fu-" + f.id, type: "blue", title: "متابعة مستحقة", body: `${byId(S.customers, f.customerId).name} — ${f.outcome}`, link: "#/customers/" + f.customerId, at: f.next });
    return out.sort((a, b) => b.at - a.at);
  });
}


/* ─── إغلاق عقد الإيجار: بعد رد كل المعدات — يفك حجز غير المسلَّم ويفوتر المتبقي ─── */
function closeRental(rentalId, actor) {
  const r = byId(S.rentals, rentalId);
  if (["CLOSED", "CANCELLED"].includes(r.status)) throw new DomainError("العقد مغلق مسبقًا");
  const onSite = r.lines.reduce((a, l) => a + l.delivered - l.returned, 0);
  if (onSite > 0) throw new DomainError(`لا يمكن الإغلاق: ما زالت ${onSite} قطعة لدى العميل`);
  if (!r.lines.some((l) => l.delivered > 0)) throw new DomainError("لم يُسلَّم شيء — استخدم إلغاء العقد");
  const at = Date.now();
  let bill = null;
  if (rentalUnbilled(r).gross > 0) bill = billRental(r.id, actor);
  r.lines.forEach((l, i) => {
    const rest = l.qty - l.delivered;
    if (rest > 0) move({ type: "UNRESERVE", pid: l.pid, wh: r.wh, qty: rest, from: "RESERVED", to: "AVAILABLE", at, rentalId: r.id, lineIdx: i, customerId: r.customerId, projectId: r.projectId, by: actor.id, reason: "إغلاق العقد — كمية لم تُسلَّم" });
  });
  r.status = "CLOSED";
  r.closedAt = at;
  audit(actor, "RENTAL_CLOSE", "Rental", r.id, null, { bill: bill?.no || null }, at);
  touch();
  return { rental: r, bill };
}

/* ─── إلغاء عقد قبل أي تسليم: يفك الحجز ويلغي فاتورته بإشعار دائن إن لم يُدفع منها شيء ─── */
function cancelRental(rentalId, reason, actor) {
  const r = byId(S.rentals, rentalId);
  if (["CLOSED", "CANCELLED"].includes(r.status)) throw new DomainError("العقد مغلق مسبقًا");
  if (r.lines.some((l) => l.delivered > 0)) throw new DomainError("سُلّمت معدات من هذا العقد — سجّل المرتجع ثم أغلق العقد");
  if (!reason) throw new DomainError("اكتب سبب الإلغاء");
  const invs = S.invoices.filter((i) => i.refId === r.id && i.status !== "CANCELLED");
  if (invs.some((i) => invPaid(i) > 0)) throw new DomainError("على فاتورة العقد دفعات — يلزم استرداد قبل الإلغاء");
  if (depositHeld(r.id) > 0) throw new DomainError("رد التأمين المقبوض أولًا");
  const at = Date.now();
  r.lines.forEach((l, i) => move({ type: "UNRESERVE", pid: l.pid, wh: r.wh, qty: l.qty, from: "RESERVED", to: "AVAILABLE", at, rentalId: r.id, lineIdx: i, customerId: r.customerId, projectId: r.projectId, by: actor.id, reason: "إلغاء العقد" }));
  invs.forEach((i) => {
    i.status = "CANCELLED";
    i.cancelNote = "أُلغيت بإشعار دائن — " + reason;
  });
  r.status = "CANCELLED";
  r.cancelledAt = at;
  r.cancelReason = reason;
  audit(actor, "RENTAL_CANCEL", "Rental", r.id, { status: "RESERVED" }, { status: "CANCELLED", reason, invoices: invs.map((i) => i.no) }, at);
  touch();
  return r;
}

/* ─── إلغاء بيع مؤكد (المالك): يعيد الكمية للمستودع ويلغي الفاتورة بإشعار دائن ─── */
function cancelSale(saleId, reason, actor) {
  const s = byId(S.sales, saleId);
  if (actor.role !== "OWNER") throw new DomainError("إلغاء البيع صلاحية المالك");
  if (s.status !== "CONFIRMED") throw new DomainError("البيع ليس مؤكدًا");
  if (!reason) throw new DomainError("اكتب سبب الإلغاء");
  const inv = byId(S.invoices, s.invoiceId);
  if (inv && invPaid(inv) > 0) throw new DomainError("على الفاتورة دفعات — يلزم استرداد المبلغ قبل الإلغاء");
  const at = Date.now();
  for (const l of s.lines) move({ type: "SALE_RETURN", pid: l.pid, wh: s.wh, qty: l.count, from: null, to: "AVAILABLE", at, saleId: s.id, customerId: s.customerId, projectId: s.projectId, by: actor.id, reason: "إلغاء البيع " + s.no });
  if (inv) {
    inv.status = "CANCELLED";
    inv.cancelNote = "أُلغيت بإشعار دائن — " + reason;
  }
  s.status = "CANCELLED";
  s.cancelReason = reason;
  s.cancelledAt = at;
  audit(actor, "SALE_CANCEL", "Sale", s.id, { status: "CONFIRMED" }, { status: "CANCELLED", reason }, at);
  touch();
  return s;
}

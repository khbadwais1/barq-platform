/* ═══════════ تقارير بنفس نماذج المؤسسة: فاتورة إيجارات الفترة، كشف الحساب، الحركة الشهرية، دفتر الصندوق ═══════════ */
"use strict";

const dayToISO = (d) => isoDay(dayStart(d));
const isoToDay = (s) => dayNo(parseDay(s));

/**
 * بنود «فاتورة إيجارات الفترة» كما في كشف المؤسسة:
 * لكل صنف فترات ثابتة الكمية: الكمية، من، إلى، الأيام (شاملة)، الإيجار الشهري، المبلغ = الكمية × الشهري ÷ 30 × الأيام.
 * تبدأ من آخر يوم مفوتر لكل بند حتى لا يُفوتر اليوم مرتين.
 */
function rentalPeriodRows(cid, pid, fromDay, toDay) {
  const rows = [];
  for (const r of S.rentals.filter((r) => r.customerId === cid && (!pid || r.projectId === pid) && r.status !== "CANCELLED")) {
    r.lines.forEach((l, i) => {
      const ev = lineEvents(r.id, i).sort((a, b) => a.day - b.day);
      if (!ev.length) return;
      const start = Math.max(fromDay, l.billedThrough ?? -Infinity, Math.min(...ev.map((e) => e.day)));
      const endEx = toDay + 1;
      if (endEx <= start) return;
      // نقاط التغيّر داخل الفترة
      const cuts = [...new Set([start, ...ev.map((e) => e.day).filter((d) => d > start && d < endEx), endEx])].sort((a, b) => a - b);
      for (let k = 0; k < cuts.length - 1; k++) {
        const a = cuts[k],
          b = cuts[k + 1];
        const qty = ev.filter((e) => e.day <= a).reduce((s, e) => s + e.delta, 0);
        if (qty <= 0) continue;
        const days = b - a;
        const dn = S.movements.find((m) => m.rentalId === r.id && m.lineIdx === i && m.type === "RENTAL_OUT" && dayNo(m.at) === a);
        rows.push({
          rentalId: r.id,
          rentalNo: r.no,
          projectId: r.projectId,
          name: l.name,
          qty,
          fromDay: a,
          toDay: b - 1,
          days,
          monthly: Math.round((l.rate * 30) / BASIS_DAYS[r.basis]),
          amount: Math.round((qty * days * l.rate) / BASIS_DAYS[r.basis]),
          ref: dn ? byId(S.deliveries, dn.dnId)?.no : "",
        });
      }
    });
  }
  return rows.sort((x, y) => x.fromDay - y.fromDay || x.rentalNo.localeCompare(y.rentalNo));
}

function statementPeriod(query) {
  const today = dayNo(Date.now());
  return { from: query.from ? isoToDay(query.from) : today - 120, to: query.to ? isoToDay(query.to) : today };
}
function periodPicker(base, cid, pid, from, to) {
  return `<div class="row wrap"><span class="muted small">الفترة من</span><input type="date" class="input" style="width:155px;height:36px" value="${dayToISO(from)}" data-act-change="stmtFrom" data-base="${base}" data-c="${cid}" data-p="${pid || ""}" data-other="${dayToISO(to)}"><span class="muted small">إلى</span><input type="date" class="input" style="width:155px;height:36px" value="${dayToISO(to)}" max="${isoDay(Date.now())}" data-act-change="stmtTo" data-base="${base}" data-c="${cid}" data-p="${pid || ""}" data-other="${dayToISO(from)}"></div>`;
}
Object.assign(ACTIONS, {
  stmtFrom: (el) => go(`${el.dataset.base}/${el.dataset.c}?from=${el.value}&to=${el.dataset.other}${el.dataset.p ? "&project=" + el.dataset.p : ""}`),
  stmtTo: (el) => go(`${el.dataset.base}/${el.dataset.c}?from=${el.dataset.other}&to=${el.value}${el.dataset.p ? "&project=" + el.dataset.p : ""}`),
});

route("/print/rentbill/:id", [], ({ id }, query) => {
  const c = byId(S.customers, id);
  if (!canSeeCustomer(ME, c)) throw new DomainError("خارج نطاق صلاحيتك");
  const pid = query.project || null;
  const { from, to } = statementPeriod(query);
  const rows = rentalPeriodRows(id, pid, from, to);
  const total = rows.reduce((a, r) => a + r.amount, 0);
  const vat = vatOf(total, S.settings.vatRate);
  const canBill = can(ME, "rentals.bill") && total > 0;
  const blank = Math.max(0, 14 - rows.length);
  const sheet = `<div class="print-sheet">${sheetHead(c.fileNo ? "ملف " + c.fileNo : c.code, "فاتورة إيجارات الفترة")}
    <div class="ps-fields"><div>اسم العميل: <b>${esc(c.name)}</b></div><div>الفترة من <b class="num">${fmtDate(dayStart(from))}</b> إلى <b class="num">${fmtDate(dayStart(to))}</b></div><div>المشروع: <b>${pid ? esc(projName(pid)) : "كل المشاريع"}</b></div><div>المندوب: <b>${esc(byId(S.reps, c.repId)?.name || "—")}</b></div></div>
    <table class="ps-table"><thead><tr><th rowspan="2">م</th><th rowspan="2" style="width:22%">البيان</th><th rowspan="2">العدد</th><th colspan="2">التاريخ</th><th rowspan="2">الأيام</th><th rowspan="2">الإيجار الشهري</th><th rowspan="2">المبلغ</th><th rowspan="2">ملاحظات</th></tr><tr><th>من</th><th>إلى</th></tr></thead>
    <tbody>${rows.map((r, k) => `<tr><td>${k + 1}</td><td style="text-align:right">${esc(r.name)}</td><td class="num">${nf0.format(r.qty)}</td><td class="num">${fmtDate(dayStart(r.fromDay))}</td><td class="num">${fmtDate(dayStart(r.toDay))}</td><td class="num">${r.days}</td><td class="num">${nf2.format(r.monthly / 100)}</td><td class="num">${nf2.format(r.amount / 100)}</td><td class="small">${r.ref ? "س رقم " + r.ref : ""}</td></tr>`).join("")}${Array.from({ length: blank }, () => "<tr>" + "<td></td>".repeat(9) + "</tr>").join("")}</tbody>
    <tfoot><tr><th colspan="7" style="text-align:right">الإجمالي قبل الضريبة</th><th class="num">${nf2.format(total / 100)}</th><th></th></tr><tr><td colspan="7" style="text-align:right">ضريبة القيمة المضافة ${S.settings.vatRate}%</td><td class="num">${nf2.format(vat / 100)}</td><td></td></tr><tr><th colspan="7" style="text-align:right">الإجمالي :- ${tafqeet(total + vat)}</th><th class="num">${nf2.format((total + vat) / 100)}</th><th></th></tr></tfoot></table>
    <div class="xs" style="margin-top:8px;color:#475569">طريقة الحساب: العدد × الإيجار الشهري ÷ 30 × عدد الأيام (شاملة يوم التسليم ويوم الرد). الأصناف المرافقة بسعر صفر تظهر للمطابقة الكمية.</div>
    <div class="ps-sign"><div>المستلم</div><div>${COMPANY.name}</div></div>${tplStamp(Date.now())}${sheetFoot()}</div>`;
  return `<div class="content" style="max-width:1150px">${pageHead("فاتورة إيجارات الفترة", `${esc(c.name)} — بنفس شكل كشف «ف» المعتمد في المؤسسة`, `${periodPicker("/print/rentbill", id, pid, from, to)}${canBill ? `<button class="btn success" data-act="issuePeriod" data-c="${id}" data-p="${pid || ""}" data-to="${to}">${ic("file")}إصدار الفاتورة (${nf2.format((total + vat) / 100)})</button>` : ""}${pdfBtn()}<button class="btn primary" onclick="window.print()">${ic("print")}طباعة</button><a class="btn" href="#/customers/${id}${pid ? "?project=" + pid : ""}">رجوع</a>`)}
  ${rows.length ? "" : `<div class="alert info" style="margin-bottom:12px">${ic("info")}<div>لا توجد أيام إيجار غير مفوترة في هذه الفترة.</div></div>`}
  <div class="print-wrap">${sheet}</div></div>`;
});
ACTIONS.issuePeriod = (el) => {
  const cid = el.dataset.c,
    pid = el.dataset.p || null,
    to = +el.dataset.to;
  confirmDialog("إصدار فاتورة إيجارات الفترة", "تصدر فاتورة إيجار لكل عقد بالأيام غير المفوترة حتى نهاية الفترة، ولا يُفوتر اليوم نفسه مرة ثانية.", () =>
    runAction(
      null,
      () => {
        const out = [];
        for (const r of S.rentals.filter((r) => r.customerId === cid && (!pid || r.projectId === pid))) {
          if (rentalUnbilled(r, to + 1).gross > 0) out.push(billRental(r.id, ME, to + 1));
        }
        if (!out.length) throw new DomainError("لا توجد قيمة غير مفوترة");
        go(`/print/acct/${cid}${pid ? "?project=" + pid : ""}`);
        return out;
      },
      (out) => `صدرت ${out.length} فاتورة: ${out.map((i) => i.no).join("، ")}`,
    ),
  { danger: false, yes: "إصدار" });
};

/* كشف حساب العميل (نموذج «ك»): رصيد سابق، مدين/دائن بالفترة، رصيد، وملحوظة المطابقة */
route("/print/acct/:id", [], ({ id }, query) => {
  const c = byId(S.customers, id);
  if (!canSeeCustomer(ME, c)) throw new DomainError("خارج نطاق صلاحيتك");
  const pid = query.project || null;
  const { from, to } = statementPeriod(query);
  const fromT = dayStart(from),
    toT = dayStart(to + 1);
  const inP = (x) => x.customerId === id && (!pid || x.projectId === pid);
  const ent = [];
  for (const i of S.invoices.filter((i) => inP(i) && i.status !== "CANCELLED"))
    ent.push({ at: i.at, desc: i.kind === "RENTAL" ? (i.periodFrom ? `إيجارات الفترة من ${fmtDate(i.periodFrom)} إلى ${fmtDate(i.periodTo - DAY)}` : "إيجار — قيمة العقد") : i.kind === "SALE" ? "مبيعات" : i.items[0].desc.split(" — ")[0], no: i.no, debit: i.total, credit: 0 });
  for (const p of S.payments.filter((p) => p.customerId === id && p.status !== "VOID")) {
    const amt = p.allocations.filter((a) => !pid || byId(S.invoices, a.invoiceId).projectId === pid).reduce((s, a) => s + a.amount, 0);
    if (amt) ent.push({ at: p.at, desc: `دفعة — ${METHOD[p.method]}${p.repName ? " (المندوب " + p.repName + ")" : ""}`, no: p.no, debit: 0, credit: amt });
  }
  ent.sort((a, b) => a.at - b.at);
  const opening = ent.filter((e) => e.at < fromT).reduce((s, e) => s + e.debit - e.credit, 0);
  const rows = ent.filter((e) => e.at >= fromT && e.at < toT);
  let bal = opening;
  rows.forEach((r) => (r.bal = bal += r.debit - r.credit));
  const dSum = rows.reduce((s, r) => s + r.debit, 0),
    cSum = rows.reduce((s, r) => s + r.credit, 0);
  const sheet = `<div class="print-sheet">${sheetHead(c.fileNo ? "ملف " + c.fileNo : c.code, `كشف حساب الفترة من ${fmtDate(fromT)} إلى ${fmtDate(toT - DAY)}`)}
    <div class="ps-fields"><div>اسم العميل: <b>${esc(c.name)}</b></div><div>المشروع: <b>${pid ? esc(projName(pid)) : "كل المشاريع"}</b></div></div>
    <table class="ps-table"><thead><tr><th>التاريخ</th><th style="width:40%">البيان</th><th>رقم المستند</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead>
    <tbody><tr><td></td><td style="text-align:right"><b>رصيد سابق</b></td><td></td><td></td><td></td><td class="num"><b>${nf2.format(opening / 100)}</b></td></tr>${rows.map((r) => `<tr><td class="num">${fmtDate(r.at)}</td><td style="text-align:right">${esc(r.desc)}</td><td class="num">${r.no}</td><td class="num">${r.debit ? nf2.format(r.debit / 100) : ""}</td><td class="num">${r.credit ? nf2.format(r.credit / 100) : ""}</td><td class="num">${nf2.format(r.bal / 100)}</td></tr>`).join("")}${Array.from({ length: Math.max(0, 10 - rows.length) }, () => "<tr>" + "<td></td>".repeat(6) + "</tr>").join("")}</tbody>
    <tfoot><tr><th colspan="3" style="text-align:right">الإجمالي ( ${tafqeet(Math.max(0, bal)).replace("فقط ", "")} )</th><th class="num">${nf2.format(dSum / 100)}</th><th class="num">${nf2.format(cSum / 100)}</th><th class="num">${nf2.format(bal / 100)}</th></tr></tfoot></table>
    <div class="small" style="margin-top:12px;color:#0f172a"><b>ملحوظة:</b> كشف الحساب المقدم مطابق ماليًا وكميًا في حالة عدم الاعتراض عليه خلال ثلاثة أيام من توقيعكم بالاستلام.</div>
    <div class="ps-sign"><div>المستلم</div><div>${COMPANY.name}</div></div>${tplStamp(Date.now())}${sheetFoot()}</div>`;
  return `<div class="content" style="max-width:1150px">${pageHead("كشف حساب العميل", `${esc(c.name)} — بنفس شكل كشف «ك» المعتمد في المؤسسة`, `${periodPicker("/print/acct", id, pid, from, to)}${bal > 0 ? waButton(c.mobile, msgStatement(c, bal), "واتساب الرصيد") : ""}${pdfBtn()}<button class="btn primary" onclick="window.print()">${ic("print")}طباعة</button><a class="btn" href="#/customers/${id}${pid ? "?project=" + pid : ""}">رجوع</a>`)}<div class="print-wrap">${sheet}</div></div>`;
});

/* ─── الحركة الشهرية للصندوق — فرع المدينة ─── */
function monthBounds(m) {
  const [y, mo] = (m || isoDay(Date.now()).slice(0, 7)).split("-").map(Number);
  const from = Date.UTC(y, mo - 1, 1) - RIYADH,
    to = Date.UTC(y, mo, 1) - RIYADH;
  return { y, mo, from, to, key: `${y}-${String(mo).padStart(2, "0")}`, days: Math.round((to - from) / DAY) };
}
const WEEKDAY = new Intl.DateTimeFormat("ar-SA", { weekday: "long", timeZone: "Asia/Riyadh" });
function monthPicker(path, key) {
  const opts = [];
  const now = new Date(Date.now() + RIYADH);
  for (let k = 0; k < 6; k++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - k, 1));
    const v = d.toISOString().slice(0, 7);
    opts.push(`<option value="${v}" ${v === key ? "selected" : ""}>${v.replace("-", " / ")}</option>`);
  }
  return `<select class="select" style="width:150px" data-act-change="monthGo" data-path="${path}">${opts.join("")}</select>`;
}
ACTIONS.monthGo = (el) => go(`${el.dataset.path}?m=${el.value}`);

route("/monthly", ["daily"], (_, query) => {
  const M = monthBounds(query.m);
  const inM = (t) => t >= M.from && t < M.to;
  const day = (t) => dayNo(t) - dayNo(M.from);
  const reps = S.reps;
  const rows = Array.from({ length: M.days }, (_, i) => ({ t: M.from + i * DAY, sales: 0, rent: 0, fees: 0, rep: {}, pay: Object.fromEntries(PAY_COLS.map((c) => [c, 0])), cheque: 0, cash: 0 }));
  for (const p of S.payments.filter((p) => p.status !== "VOID" && inM(p.at))) {
    const r = rows[day(p.at)];
    for (const a of p.allocations) {
      const k = byId(S.invoices, a.invoiceId).kind;
      if (k === "SALE") r.sales += a.amount;
      else if (k === "RENTAL") r.rent += a.amount;
      else r.fees += a.amount;
    }
    if (p.repId) r.rep[p.repId] = (r.rep[p.repId] || 0) + p.amount;
  }
  for (const e of S.expenses.filter((e) => e.status === "APPROVED" && inM(e.postedAt))) {
    const r = rows[day(e.postedAt)];
    r.pay[expenseCol(e.cat)] += e.amount;
    if (e.accountId === "a-cash") r.cash += e.amount;
    else r.cheque += e.amount;
  }
  for (const dpt of S.deposits.filter((x) => x.kind === "REFUNDED" && inM(x.at))) {
    const r = rows[day(dpt.at)];
    r.pay["مردود إيجارات"] += dpt.amount;
    if (dpt.accountId === "a-cash") r.cash += dpt.amount;
    else r.cheque += dpt.amount;
  }
  const sum = (f) => rows.reduce((a, r) => a + f(r), 0);
  const inTotal = sum((r) => r.sales + r.rent + r.fees);
  const outTotal = sum((r) => PAY_COLS.reduce((a, c) => a + r.pay[c], 0));
  const cell = (v) => (v ? money(v) : '<span class="faint">—</span>');
  const usedReps = reps.filter((rp) => rows.some((r) => r.rep[rp.id]));
  const cats = EXPENSE_CATS.filter((c) => S.expenses.some((e) => e.status === "APPROVED" && e.cat === c && inM(e.postedAt)));
  const catTotal = (c) => S.expenses.filter((e) => e.status === "APPROVED" && e.cat === c && inM(e.postedAt)).reduce((a, e) => a + e.amount, 0);
  return `${pageHead(`الحركة الشهرية للصندوق — فرع المدينة`, `شهر ${M.key.replace("-", " / ")} — تُولَّد تلقائيًا من سندات القبض والمصروفات بنفس أعمدة ملف المؤسسة`, `${monthPicker("/monthly", M.key)}${pdfBtn("#content", "الحركة الشهرية " + M.key, true)}<button class="btn" onclick="window.print()">${ic("print")}طباعة</button>`)}
  <div class="grid g4">${kpi({ label: "إجمالي المقبوضات", value: sar(inTotal), icon: "trend", color: "#047857" })}${kpi({ label: "إجمالي المدفوعات", value: sar(outTotal), icon: "down", color: "#d1495b" })}${kpi({ label: "منها نقدًا / من البنوك", value: `${money(sum((r) => r.cash))} <small>/ ${nf2.format(sum((r) => r.cheque) / 100)}</small>`, icon: "cash" })}${kpi({ label: "صافي المبلغ", value: sar(inTotal - outTotal), icon: "wallet" })}</div>
  <div class="card" style="margin-top:14px"><div class="card-h"><h3>المقبوضات والمدفوعات اليومية</h3><span class="chip">تحصيل المندوبين تفصيل من المقبوضات وليس إضافة عليها</span></div><div class="tbl-wrap" style="max-height:640px"><table class="tbl"><thead><tr><th>اليوم</th><th>التاريخ</th><th>مبيعات</th><th>إيجارات</th><th>رسوم ونقل</th>${usedReps.map((rp) => `<th style="background:#f5f3ff">${esc(rp.name)}</th>`).join("")}${PAY_COLS.map((c) => `<th style="background:#fef2f2">${c}</th>`).join("")}</tr></thead>
  <tbody>${rows.map((r) => `<tr><td class="small">${WEEKDAY.format(new Date(r.t))}</td><td class="num">${fmtDate(r.t).slice(0, 5)}</td><td>${cell(r.sales)}</td><td>${cell(r.rent)}</td><td>${cell(r.fees)}</td>${usedReps.map((rp) => `<td>${cell(r.rep[rp.id])}</td>`).join("")}${PAY_COLS.map((c) => `<td>${cell(r.pay[c])}</td>`).join("")}</tr>`).join("")}</tbody>
  <tfoot><tr><td colspan="2">الإجمالي</td><td>${money(sum((r) => r.sales))}</td><td>${money(sum((r) => r.rent))}</td><td>${money(sum((r) => r.fees))}</td>${usedReps.map((rp) => `<td>${money(sum((r) => r.rep[rp.id] || 0))}</td>`).join("")}${PAY_COLS.map((c) => `<td>${money(sum((r) => r.pay[c]))}</td>`).join("")}</tr></tfoot></table></div>
  <div class="card-b row between small muted"><span>المحاسب: ${esc(userName("u-fin"))}</span><span>مدير الفرع: —</span><span>إيرادات ${money(inTotal)} − مصروفات ${money(outTotal)} = صافي ${money(inTotal - outTotal)}</span></div></div>
  <div class="card" style="margin-top:14px"><div class="card-h"><h3>تحليل المصروفات — شهر ${M.key.replace("-", " / ")}</h3><span class="chip">بنود المؤسسة</span></div><div class="tbl-wrap" style="max-height:520px"><table class="tbl"><thead><tr><th>اليوم</th><th>التاريخ</th>${cats.map((c) => `<th>${c}</th>`).join("")}<th>الإجمالي</th></tr></thead><tbody>${rows
    .map((r) => {
      const es = S.expenses.filter((e) => e.status === "APPROVED" && dayNo(e.postedAt) === dayNo(r.t));
      if (!es.length) return "";
      const by = (c) => es.filter((e) => e.cat === c).reduce((a, e) => a + e.amount, 0);
      return `<tr><td class="small">${WEEKDAY.format(new Date(r.t))}</td><td class="num">${fmtDate(r.t).slice(0, 5)}</td>${cats.map((c) => `<td>${cell(by(c))}</td>`).join("")}<td><b>${money(es.reduce((a, e) => a + e.amount, 0))}</b></td></tr>`;
    })
    .join("") || `<tr><td colspan="${cats.length + 3}">${emptyBox("لا مصروفات معتمدة في هذا الشهر")}</td></tr>`}</tbody><tfoot><tr><td colspan="2">الإجمالي</td>${cats.map((c) => `<td>${money(catTotal(c))}</td>`).join("")}<td>${money(cats.reduce((a, c) => a + catTotal(c), 0))}</td></tr></tfoot></table></div></div>`;
});

/* ─── دفتر الصندوق والبنوك الشهري (الحسابات الثلاثة جنبًا إلى جنب كما في ملف «الصندوق») ─── */
function ledgerDesc(t) {
  if (t.src === "PAYMENT") {
    const p = byId(S.payments, t.ref);
    const kinds = [...new Set(p.allocations.map((a) => byId(S.invoices, a.invoiceId).kind))];
    return (kinds.length === 1 ? { SALE: "إيرادات مبيعات", RENTAL: "إيرادات إيجارات", FEES: "رسوم ونقل" }[kinds[0]] : "إيرادات متنوعة") + " — " + custName(p.customerId);
  }
  if (t.src === "EXPENSE") {
    const e = byId(S.expenses, t.ref);
    return `مصروفات ${expenseGroup(e.cat)} — ${e.cat}`;
  }
  return t.desc;
}
const ledgerNo = (t) => (t.src === "PAYMENT" ? byId(S.payments, t.ref).no : t.src === "EXPENSE" ? byId(S.expenses, t.ref).no : "");
route("/cashbook", ["daily"], (_, query) => {
  const M = monthBounds(query.m);
  const accs = S.accounts;
  const blocks = accs.map((a) => {
    const open = accountBalance(a.id, M.from);
    let bal = open;
    const rows = transactions()
      .filter((t) => t.accountId === a.id && t.at >= M.from && t.at < M.to)
      .map((t) => ({ t, bal: (bal += t.dir === "IN" ? t.amount : -t.amount) }));
    return { a, open, rows, close: bal, inn: rows.filter((r) => r.t.dir === "IN").reduce((s, r) => s + r.t.amount, 0), out: rows.filter((r) => r.t.dir === "OUT").reduce((s, r) => s + r.t.amount, 0) };
  });
  return `${pageHead("دفتر الصندوق والبنوك", `شهر ${M.key.replace("-", " / ")} — رصيد افتتاحي أول الشهر ثم كل حركة برصيدها`, `${monthPicker("/cashbook", M.key)}${pdfBtn("#content", "دفتر الصندوق والبنوك " + M.key, true)}<button class="btn" onclick="window.print()">${ic("print")}طباعة</button>`)}
  <div class="grid g3">${blocks
    .map(
      (b) => `<div class="card"><div class="card-h"><h3>${b.a.type === "CASH" ? "حسابات الصندوق" : "حسابات البنك — " + esc(b.a.name)}</h3><span class="chip">${M.key.replace("-", "/")}</span></div>
    <div class="tbl-wrap" style="max-height:560px"><table class="tbl"><thead><tr><th>${b.a.type === "CASH" ? "مدين" : "إيداع"}</th><th>${b.a.type === "CASH" ? "دائن" : "سحب"}</th><th>الرصيد</th><th>البيان</th><th>رقم السند</th><th>التاريخ</th></tr></thead>
    <tbody><tr style="background:#f8fafc"><td>${money(b.open)}</td><td></td><td><b>${money(b.open)}</b></td><td>رصيد افتتاحي ${fmtDate(M.from)}</td><td></td><td></td></tr>${b.rows.map((r) => `<tr class="click" data-go="${r.t.src === "PAYMENT" ? "/payments/" + r.t.ref : r.t.src === "EXPENSE" ? "/expenses" : "/rentals/" + r.t.ref}"><td style="color:var(--green)">${r.t.dir === "IN" ? money(r.t.amount) : ""}</td><td style="color:var(--red)">${r.t.dir === "OUT" ? money(r.t.amount) : ""}</td><td><b>${money(r.bal)}</b></td><td class="small" style="white-space:normal;min-width:150px">${esc(ledgerDesc(r.t))}</td><td class="num small">${ledgerNo(r.t)}</td><td class="num small">${fmtDate(r.t.at).slice(0, 5)}</td></tr>`).join("")}</tbody>
    <tfoot><tr><td>${money(b.inn)}</td><td>${money(b.out)}</td><td>${money(b.close)}</td><td colspan="3">الرصيد آخر الشهر</td></tr></tfoot></table></div></div>`,
    )
    .join("")}</div>`;
});

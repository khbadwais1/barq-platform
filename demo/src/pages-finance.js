/* ═══════════ المالية: الفواتير، سندات القبض، الحسابات، المصروفات، الموافقات، اليومية ═══════════ */
"use strict";

function invoicesTable(id, rows, opts = {}) {
  const today = dayNo(Date.now());
  return table(
    id,
    [
      { key: "no", label: "رقم الفاتورة", text: (i) => i.no, render: (i) => `<a class="link num" href="#/invoices/${i.id}">${i.no}</a>` },
      { key: "kind", label: "النوع", text: (i) => ({ SALE: "بيع", RENTAL: "إيجار", FEES: "صيانة/تعويض" })[i.kind] },
      { key: "at", label: "التاريخ", value: (i) => i.at, text: (i) => fmtDate(i.at), render: (i) => dateNum(i.at) },
      { key: "c", label: "العميل", text: (i) => custName(i.customerId) },
      { key: "p", label: "المشروع", text: (i) => projName(i.projectId) },
      { key: "t", label: "الإجمالي", value: (i) => i.total, render: (i) => sar(i.total) },
      { key: "paid", label: "المدفوع", value: invPaid, render: (i) => sar(invPaid(i)) },
      { key: "rem", label: "المتبقي", value: invRemaining, render: (i) => (invRemaining(i) ? `<b>${sar(invRemaining(i))}</b>` : '<span class="faint">0.00</span>') },
      { key: "due", label: "الاستحقاق", value: (i) => i.due, text: (i) => fmtDate(i.due), render: (i) => dateNum(i.due) },
      { key: "late", label: "التأخير", value: (i) => (invStatus(i) === "OVERDUE" ? today - dayNo(i.due) : 0), render: (i) => (invStatus(i) === "OVERDUE" ? `<span class="badge b-red">${today - dayNo(i.due)} يوم</span>` : "—") },
      { key: "seller", label: "البائع", text: (i) => userName(i.sellerId) },
      { key: "st", label: "الحالة", text: (i) => BADGES[invStatus(i)][0], render: (i) => badge(invStatus(i)) },
      { key: "act", label: "", search: false, text: () => "", render: (i) => (can(ME, "payments.create") && invRemaining(i) > 0 ? `<button class="btn sm" data-act="pay" data-inv="${i.id}">${ic("cash")}تحصيل</button>` : "") },
    ],
    rows,
    {
      sort: "at",
      rowLink: (i) => "/invoices/" + i.id,
      hidden: ["seller", "p"],
      filters: [
        { key: "st", label: "الحالة", options: [["PAID", "مدفوعة"], ["PARTIAL", "جزئي"], ["UNPAID", "غير مدفوعة"], ["OVERDUE", "متأخرة"]], match: (i, v) => invStatus(i) === v },
        { key: "kind", label: "النوع", options: [["SALE", "بيع"], ["RENTAL", "إيجار"], ["FEES", "صيانة"]], match: (i, v) => i.kind === v },
      ],
      footer: (c, data) => (c.key === "t" ? sar(data.reduce((a, i) => a + i.total, 0)) : c.key === "paid" ? sar(data.reduce((a, i) => a + invPaid(i), 0)) : c.key === "rem" ? sar(data.reduce((a, i) => a + invRemaining(i), 0)) : c.key === "no" ? "الإجمالي (كل النتائج)" : ""),
      ...opts,
    },
  );
}
function paymentsTable(id, rows) {
  return table(
    id,
    [
      { key: "no", label: "رقم السند", text: (p) => p.no, render: (p) => `<a class="link num" href="#/payments/${p.id}">${p.no}</a>` },
      { key: "at", label: "التاريخ", value: (p) => p.at, text: (p) => fmtDate(p.at), render: (p) => `<span class="num">${fmtDT(p.at)}</span>` },
      { key: "rep", label: "المندوب", text: (p) => p.repName || "—", render: (p) => (p.repName ? `<b>${esc(p.repName)}</b>` : "—") },
      { key: "c", label: "العميل", text: (p) => custName(p.customerId) },
      { key: "p", label: "المشروع", text: (p) => projName(p.projectId) },
      { key: "amt", label: "المبلغ", value: (p) => p.amount, render: (p) => `<b>${sar(p.amount)}</b>` },
      { key: "m", label: "الطريقة", text: (p) => METHOD[p.method] },
      { key: "acc", label: "الحساب", text: (p) => accName(p.accountId) },
      { key: "inv", label: "الفواتير", text: (p) => p.allocations.map((a) => byId(S.invoices, a.invoiceId).no).join("، "), render: (p) => `<span class="num small">${p.allocations.map((a) => byId(S.invoices, a.invoiceId).no).join("، ")}</span>` },
      { key: "ref", label: "المرجع", text: (p) => p.ref || "" },
      { key: "by", label: "سجّله", text: (p) => userName(p.recordedBy) },
      { key: "pr", label: "", search: false, text: () => "", render: (p) => `<a class="btn sm" href="#/print/rv/${p.id}">${ic("print")}</a>` },
    ],
    rows,
    {
      sort: "at",
      rowLink: (p) => "/payments/" + p.id,
      hidden: ["ref", "inv"],
      filters: [
        { key: "rep", label: "المندوب", options: S.reps.map((r) => [r.id, r.name]), match: (p, v) => p.repId === v },
        { key: "acc", label: "الحساب", options: S.accounts.map((a) => [a.id, a.name]), match: (p, v) => p.accountId === v },
        { key: "m", label: "الطريقة", options: Object.entries(METHOD), match: (p, v) => p.method === v },
        { key: "d", label: "الفترة", options: [["today", "اليوم"], ["7", "آخر 7 أيام"], ["30", "آخر 30 يومًا"]], match: (p, v) => (v === "today" ? dayNo(p.at) === dayNo(Date.now()) : Date.now() - p.at < +v * DAY) },
      ],
      footer: (c, data) => (c.key === "amt" ? sar(data.reduce((a, p) => a + p.amount, 0)) : c.key === "no" ? "الإجمالي" : ""),
    },
  );
}

route("/invoices", ["invoices", "invoices.own"], (_, query) => {
  const rows = S.invoices.filter((i) => canSeeInvoice(ME, i));
  if (query.f && query.f !== "open") {
    TBL.invoices ||= { q: "", sort: "at", dir: "desc", page: 0, size: 12, hidden: new Set(["seller", "p"]), filters: {} };
    TBL.invoices.filters.st = query.f;
  }
  const list = query.f === "open" ? rows.filter((i) => invRemaining(i) > 0) : rows;
  return `${pageHead(ME.role === "SELLER" ? "فواتير عملياتي" : "الفواتير", `${list.length} فاتورة — كل عملية مؤكدة تصدر لها فاتورة ضريبية تلقائيًا${query.f === "open" ? ' · <a class="link" href="#/invoices">عرض الكل</a>' : ""}`)}${invoicesTable("invoices", list)}`;
});

route("/invoices/:id", ["invoices", "invoices.own"], ({ id }) => {
  const i = byId(S.invoices, id);
  if (!i) return emptyBox("غير موجودة");
  if (!canSeeInvoice(ME, i)) throw new DomainError("الفاتورة خارج نطاق صلاحيتك");
  const pays = S.payments.filter((p) => p.allocations.some((a) => a.invoiceId === i.id));
  const ref = i.kind === "SALE" ? byId(S.sales, i.refId) : byId(S.rentals, i.refId);
  const refLink = i.kind === "SALE" ? `#/sales/${i.refId}` : `#/rentals/${i.refId}`;
  return `${pageHead(`فاتورة ${i.no}`, `${esc(custName(i.customerId))} · ${esc(projName(i.projectId))}`, `${badge(invStatus(i))}${can(ME, "payments.create") && invRemaining(i) > 0 ? `<button class="btn primary" data-act="pay" data-inv="${i.id}">${ic("cash")}تسجيل تحصيل</button>` : ""}<a class="btn" href="#/print/invoice/${i.id}">${ic("print")}طباعة</a>`, `<a href="#/invoices">الفواتير</a> / ${i.no}`)}
  ${i.status === "CANCELLED" ? `<div class="alert danger" style="margin-bottom:14px">${ic("ban")}<div><b>فاتورة ملغاة</b> — ${esc(i.cancelNote || "")}</div></div>` : ""}<div class="grid g4">${kpi({ label: "الإجمالي", value: sar(i.total), icon: "file" })}${kpi({ label: "المدفوع", value: sar(invPaid(i)), icon: "cash", color: "#047857" })}${kpi({ label: "المتبقي", value: sar(invRemaining(i)), icon: "alert", color: "#d1495b" })}${kpi({ label: "الاستحقاق", value: dateNum(i.due), icon: "calendar", sub: invStatus(i) === "OVERDUE" ? `متأخرة ${dayNo(Date.now()) - dayNo(i.due)} يوم` : "" })}</div>
  <div class="grid g3" style="margin-top:14px">
    <div class="card span2"><div class="card-h"><h3>البنود</h3><span class="chip">ضريبة ${i.rate}% محفوظة في المستند</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>البيان</th><th>الكمية</th><th>السعر</th><th>الخصم</th><th>الصافي</th></tr></thead><tbody>${i.items.map((it) => `<tr><td>${esc(it.desc)}</td><td>${int(it.qty)}</td><td>${money(it.price)}</td><td>${money(it.disc)}</td><td>${money(it.net)}</td></tr>`).join("")}</tbody><tfoot><tr><td colspan="3">الإجمالي ${money(i.gross)} − خصم ${money(i.disc)} = وعاء ${money(i.taxable)} + ضريبة ${money(i.vat)}</td><td colspan="2">${sar(i.total)}</td></tr></tfoot></table></div></div>
    <div class="card"><div class="card-h"><h3>المرجع</h3></div><div class="card-b col" style="gap:6px"><div class="row between"><span class="muted">${i.kind === "SALE" ? "البيع" : "عقد الإيجار"}</span><a class="link num" href="${refLink}">${ref?.no}</a></div><div class="row between"><span class="muted">العميل</span><a class="link" href="#/customers/${i.customerId}?project=${i.projectId}">${esc(custName(i.customerId))}</a></div><div class="row between"><span class="muted">البائع</span><b>${esc(userName(i.sellerId))}</b></div>${i.periodFrom ? `<div class="row between"><span class="muted">فترة الإيجار</span><b class="num">${fmtDate(i.periodFrom)} ← ${fmtDate(i.periodTo)}</b></div>` : ""}<div class="row between"><span class="muted">UUID</span><span class="xs num faint">${i.uuid.slice(0, 18)}…</span></div></div></div>
    <div class="card span3"><div class="card-h"><h3>الدفعات المخصصة لهذه الفاتورة</h3></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>السند</th><th>التاريخ</th><th>المبلغ المخصص</th><th>الطريقة</th><th>الحساب</th><th>المندوب</th><th>سجّله</th></tr></thead><tbody>${pays.map((p) => `<tr class="click" data-go="/payments/${p.id}"><td class="num link">${p.no}</td><td class="num">${fmtDT(p.at)}</td><td>${sar(p.allocations.find((a) => a.invoiceId === i.id).amount)}</td><td>${METHOD[p.method]}</td><td>${esc(accName(p.accountId))}</td><td>${esc(p.repName || "—")}</td><td>${esc(userName(p.recordedBy))}</td></tr>`).join("") || `<tr><td colspan="7">${emptyBox("لا دفعات بعد", "cash")}</td></tr>`}</tbody></table></div></div>
  </div>`;
});

/* ─── نافذة تسجيل التحصيل ─── */
function payModalBody() {
  const f = UI.payf;
  const c = byId(S.customers, f.customerId);
  const open = S.invoices.filter((i) => i.customerId === c.id && invRemaining(i) > 0 && (!f.projectId || i.projectId === f.projectId)).sort((a, b) => a.due - b.due);
  const total = Object.values(f.alloc).reduce((a, b) => a + (b || 0), 0);
  return `<div class="row between" style="margin-bottom:12px"><div><b>${esc(c.name)}</b> <span class="muted small">${c.code}</span></div><span class="chip">الذمة الحالية ${sar(customerSummary(c.id).balance)}</span></div>
  <div class="form-grid">
    <div class="field"><label>المندوب * <span class="faint xs">يظهر بالاسم في السند والطباعة</span></label><select class="select" data-act-change="pfRep">${S.reps.map((r) => `<option value="${r.id}" ${f.repId === r.id ? "selected" : ""}>${esc(r.name)} — ${r.code}</option>`).join("")}</select></div>
    <div class="field"><label>طريقة الدفع</label><select class="select" data-act-change="pfMethod">${Object.entries(METHOD).map(([k, v]) => `<option value="${k}" ${f.method === k ? "selected" : ""}>${v}</option>`).join("")}</select></div>
    <div class="field"><label>الحساب المالي *</label><select class="select" data-act-change="pfAcc">${S.accounts.map((a) => `<option value="${a.id}" ${f.accountId === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select></div>
    <div class="field"><label>${f.method === "CHEQUE" ? "رقم الشيك *" : "رقم المرجع"}</label><input class="input" id="pf-ref" value="${esc(f.ref)}" data-act-input="pfRef"></div>
    <div class="field"><label>تاريخ القبض</label><input type="date" class="input" value="${f.date}" max="${isoDay(Date.now())}" data-act-change="pfDate"></div>
    <div class="field"><label>ملاحظات</label><input class="input" id="pf-notes" value="${esc(f.notes)}" data-act-input="pfNotes"></div>
  </div>
  <div class="section-title">التخصيص على الفواتير ${open.length > 1 ? '<button class="btn sm" data-act="pfAuto">توزيع تلقائي (الأقدم أولًا)</button>' : ""}</div>
  ${open.length > 1 && !f.single ? `<div class="field" style="margin-bottom:8px"><label>مبلغ السند للتوزيع</label><input class="input" style="max-width:200px" id="pf-bulk" value="${f.bulk ? (f.bulk / 100).toFixed(2) : ""}" data-act-input="pfBulk" placeholder="0.00"></div>` : ""}
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>الفاتورة</th><th>المشروع</th><th>الاستحقاق</th><th>المتبقي</th><th>المبلغ المخصص</th></tr></thead><tbody>${open
    .map((i) => `<tr><td class="num">${i.no} ${invStatus(i) === "OVERDUE" ? badge("OVERDUE") : ""}</td><td class="small">${esc(projName(i.projectId))}</td><td class="num">${fmtDate(i.due)}</td><td>${money(invRemaining(i))}</td><td><input class="input" style="width:120px;height:32px" id="pfa-${i.id}" value="${f.alloc[i.id] ? (f.alloc[i.id] / 100).toFixed(2) : ""}" placeholder="0.00" data-act-input="pfAlloc" data-i="${i.id}" inputmode="decimal"></td></tr>`)
    .join("")}</tbody><tfoot><tr><td colspan="4">مجموع السند (= مجموع التخصيصات)</td><td>${sar(total)}</td></tr></tfoot></table></div>
  <div class="alert info" style="margin-top:10px">${ic("info")}<div>بعد الحفظ: تتحدث الفاتورة، ورصيد العميل، ورصيد <b>${esc(accName(f.accountId))}</b>، ولوحات المالية والمالك والبائع — وقيد واحد فقط في الحساب. لا يُقبل مبلغ صفر أو سالب أو أكبر من المتبقي.</div></div>`;
}
function openPayModal(customerId, opts = {}) {
  const c = byId(S.customers, customerId);
  UI.payf = { customerId, projectId: opts.projectId || null, repId: c.repId || S.reps[0].id, method: "CASH", accountId: "a-cash", ref: "", notes: "", date: isoDay(Date.now()), alloc: {}, bulk: 0, single: !!opts.invoiceId, key: newKey("pay") };
  if (opts.invoiceId) UI.payf.alloc[opts.invoiceId] = invRemaining(byId(S.invoices, opts.invoiceId));
  openModal("تسجيل تحصيل — سند قبض", payModalBody, `<button class="btn success" data-act="pfSave" data-label="حفظ سند القبض">${ic("check")}حفظ سند القبض</button><button class="btn" data-act="closeModal">إلغاء</button>`, "wide");
}
function openPaymentPicker() {
  UI.pp = { q: "" };
  openModal("تحصيل جديد — اختر العميل", () => {
    const res = UI.pp.q.trim().length >= 2 ? searchCustomers(UI.pp.q) : S.customers.map((c) => ({ customer: c, key: "" })).filter((x) => customerSummary(x.customer.id).balance > 0).sort((a, b) => customerSummary(b.customer.id).balance - customerSummary(a.customer.id).balance).slice(0, 8);
    return `<div class="search" style="max-width:none"><input class="input" id="pp-q" placeholder="ابحث بالاسم أو الجوال أو الهوية أو السجل…" value="${esc(UI.pp.q)}" data-act-input="ppQ">${ic("search")}</div><div class="col" style="margin-top:10px;gap:6px">${res.map(({ customer: c }) => `<button class="btn" style="justify-content:space-between;height:auto;padding:10px" data-act="ppPick" data-c="${c.id}"><span>${esc(c.name)} <span class="xs muted">${c.code}</span></span><span>ذمة ${sar(customerSummary(c.id).balance)}</span></button>`).join("") || emptyBox("لا نتائج")}</div>`;
  });
}
Object.assign(ACTIONS, {
  pay: (el) => {
    const inv = byId(S.invoices, el.dataset.inv);
    openPayModal(inv.customerId, { invoiceId: inv.id });
  },
  payCustomer: (el) => openPayModal(el.dataset.c, { projectId: el.dataset.p || null }),
  ppQ: (el) => ((UI.pp.q = el.value), rerenderModal()),
  ppPick: (el) => openPayModal(el.dataset.c),
  pfRep: (el) => (UI.payf.repId = el.value),
  pfMethod: (el) => {
    UI.payf.method = el.value;
    if (el.value === "CASH") UI.payf.accountId = "a-cash";
    else if (UI.payf.accountId === "a-cash") UI.payf.accountId = "a-rajhi";
    rerenderModal();
  },
  pfAcc: (el) => ((UI.payf.accountId = el.value), rerenderModal()),
  pfRef: (el) => (UI.payf.ref = el.value),
  pfNotes: (el) => (UI.payf.notes = el.value),
  pfDate: (el) => (UI.payf.date = el.value),
  pfAlloc: (el) => ((UI.payf.alloc[el.dataset.i] = parseMoney(el.value)), rerenderModal()),
  pfBulk: (el) => ((UI.payf.bulk = parseMoney(el.value)), ACTIONS.pfAuto()),
  pfAuto: () => {
    const f = UI.payf;
    let left = f.bulk || 0;
    f.alloc = {};
    for (const i of S.invoices.filter((i) => i.customerId === f.customerId && invRemaining(i) > 0 && (!f.projectId || i.projectId === f.projectId)).sort((a, b) => a.due - b.due)) {
      if (left <= 0) break;
      const a = Math.min(left, invRemaining(i));
      f.alloc[i.id] = a;
      left -= a;
    }
    rerenderModal();
  },
  pfSave: (el) =>
    runAction(
      el,
      () => {
        const f = UI.payf;
        const allocations = Object.entries(f.alloc)
          .filter(([, a]) => a !== 0)
          .map(([invoiceId, amount]) => ({ invoiceId, amount }));
        if (!allocations.length) throw new DomainError("أدخل مبلغًا على فاتورة واحدة على الأقل");
        const today = isoDay(Date.now()) === f.date;
        const p = recordPayment({ customerId: f.customerId, projectId: f.projectId, allocations, method: f.method, accountId: f.accountId, ref: f.ref, repId: f.repId, notes: f.notes, at: today ? Date.now() : parseDay(f.date) + 12 * 3600000, idemKey: f.key }, ME);
        closeModal();
        return p;
      },
      (p) => (p.duplicate ? "هذا السند سُجل مسبقًا — لم يتكرر القيد" : `تم تسجيل التحصيل — سند ${p.no}`),
    ),
});

route("/payments", ["payments", "payments.own"], (_, query) => {
  const rows = S.payments.filter((p) => canSeePayment(ME, p));
  if (query.rep) {
    TBL.payments ||= { q: "", sort: "at", dir: "desc", page: 0, size: 12, hidden: new Set(["ref", "inv"]), filters: {} };
    TBL.payments.filters.rep = query.rep;
  }
  if (query.d === "today") {
    TBL.payments ||= { q: "", sort: "at", dir: "desc", page: 0, size: 12, hidden: new Set(["ref", "inv"]), filters: {} };
    TBL.payments.filters.d = "today";
  }
  return `${pageHead("سندات القبض", "ابحث باسم المندوب، وادمجه مع العميل والمشروع والفترة ورقم السند والحساب", can(ME, "payments.create") ? `<button class="btn primary" data-act="quick" data-h="@payment">${ic("plus")}تحصيل جديد</button>` : "")}${paymentsTable("payments", rows)}`;
});
route("/payments/:id", ["payments", "payments.own"], ({ id }) => {
  const p = byId(S.payments, id);
  if (!p) return emptyBox("غير موجود");
  if (!canSeePayment(ME, p)) throw new DomainError("السند خارج نطاق صلاحيتك");
  return `${pageHead(`سند قبض ${p.no}`, `${esc(custName(p.customerId))} · ${fmtDT(p.at)}`, `${badge("POSTED")}<a class="btn primary" href="#/print/rv/${p.id}">${ic("print")}طباعة السند</a>`, `<a href="#/payments">سندات القبض</a> / ${p.no}`)}
  <div class="grid g4">${kpi({ label: "المبلغ", value: sar(p.amount), icon: "cash", color: "#047857" })}${kpi({ label: "المندوب", value: esc(p.repName || "—"), icon: "user", sub: "محفوظ كما كان وقت الإصدار" })}${kpi({ label: "الحساب", value: esc(accName(p.accountId)), icon: "bank", sub: METHOD[p.method] })}${kpi({ label: "سجّله (موظف المالية)", value: esc(userName(p.recordedBy)), icon: "shield" })}</div>
  <div class="grid g2" style="margin-top:14px"><div class="card"><div class="card-h"><h3>التخصيص على الفواتير</h3></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>الفاتورة</th><th>المشروع</th><th>المبلغ المخصص</th><th>المتبقي الآن</th></tr></thead><tbody>${p.allocations.map((a) => { const i = byId(S.invoices, a.invoiceId); return `<tr class="click" data-go="/invoices/${i.id}"><td class="num link">${i.no}</td><td>${esc(projName(i.projectId))}</td><td>${sar(a.amount)}</td><td>${sar(invRemaining(i))}</td></tr>`; }).join("")}</tbody></table></div></div>
  <div class="card"><div class="card-h"><h3>البيانات</h3></div><div class="card-b col" style="gap:6px"><div class="row between"><span class="muted">العميل</span><a class="link" href="#/customers/${p.customerId}">${esc(custName(p.customerId))}</a></div><div class="row between"><span class="muted">المشروع</span><b>${esc(projName(p.projectId))}</b></div><div class="row between"><span class="muted">المرجع</span><b class="num">${esc(p.ref || "—")}</b></div><div class="row between"><span class="muted">التاريخ هجري</span><b class="num">${fmtHijri(p.at)}</b></div><div class="row between"><span class="muted">القيد المحاسبي</span><b>قيد واحد +${money(p.amount)} في ${esc(accName(p.accountId))}</b></div>${p.notes ? `<div class="muted small">${esc(p.notes)}</div>` : ""}</div></div></div>`;
});

/* ─── الحسابات ─── */
route("/accounts", ["accounts"], () => {
  const txs = transactions();
  return `${pageHead("الصندوق والبنوك", "رصيد كل حساب = الرصيد الافتتاحي (مرة واحدة) + المقبوضات − المدفوعات — قابل للمراجعة حركة بحركة", ME.role === "OWNER" ? `<button class="btn" data-act="addBank">${ic("plus")}حساب بنكي</button>` : "")}
  <div class="grid g3">${S.accounts
    .map((a) => {
      const t = txs.filter((x) => x.accountId === a.id);
      const inn = t.filter((x) => x.dir === "IN").reduce((s, x) => s + x.amount, 0);
      const out = t.filter((x) => x.dir === "OUT").reduce((s, x) => s + x.amount, 0);
      return `<div class="card kpi" data-go="/accounts/${a.id}"><div class="top"><div class="col" style="gap:0"><b>${esc(a.name)}</b><span class="xs muted">${a.type === "CASH" ? "صندوق" : esc(a.bank)}</span></div><div class="ic">${ic(a.type === "CASH" ? "cash" : "bank")}</div></div><div class="val">${sar(accountBalance(a.id))}</div>
      <div class="col small" style="margin-top:8px;gap:2px"><div class="row between"><span class="muted">الافتتاحي</span><span>${money(a.opening)}</span></div><div class="row between"><span class="muted">المقبوضات</span><span style="color:var(--green)">+${money(inn)}</span></div><div class="row between"><span class="muted">المدفوعات</span><span style="color:var(--red)">−${money(out)}</span></div><div class="row between" style="border-top:1px solid var(--border);padding-top:4px"><b>الحالي</b><b>${money(a.opening + inn - out)}</b></div></div></div>`;
    })
    .join("")}</div>
  <div class="section-title">آخر الحركات</div>${txTable("tx-all", txs)}`;
});
function txTable(id, rows) {
  return table(
    id,
    [
      { key: "at", label: "التاريخ", value: (t) => t.at, text: (t) => fmtDate(t.at), render: (t) => `<span class="num">${fmtDT(t.at)}</span>` },
      { key: "acc", label: "الحساب", text: (t) => accName(t.accountId) },
      { key: "desc", label: "البيان", text: (t) => t.desc },
      { key: "src", label: "المصدر", text: (t) => ({ PAYMENT: "سند قبض", EXPENSE: "مصروف", DEPOSIT: "تأمين" })[t.src] },
      { key: "in", label: "داخل", value: (t) => (t.dir === "IN" ? t.amount : 0), render: (t) => (t.dir === "IN" ? `<span style="color:var(--green)">${money(t.amount)}</span>` : "") },
      { key: "out", label: "خارج", value: (t) => (t.dir === "OUT" ? t.amount : 0), render: (t) => (t.dir === "OUT" ? `<span style="color:var(--red)">${money(t.amount)}</span>` : "") },
    ],
    rows,
    { sort: "at", rowLink: (t) => (t.src === "PAYMENT" ? "/payments/" + t.ref : t.src === "EXPENSE" ? "/expenses" : "/rentals/" + t.ref), filters: [{ key: "acc", label: "الحساب", options: S.accounts.map((a) => [a.id, a.name]), match: (t, v) => t.accountId === v }, { key: "src", label: "المصدر", options: [["PAYMENT", "قبض"], ["EXPENSE", "مصروف"], ["DEPOSIT", "تأمين"]], match: (t, v) => t.src === v }], footer: (c, data) => (c.key === "in" ? money(data.filter((t) => t.dir === "IN").reduce((a, t) => a + t.amount, 0)) : c.key === "out" ? money(data.filter((t) => t.dir === "OUT").reduce((a, t) => a + t.amount, 0)) : "") },
  );
}
route("/accounts/:id", ["accounts"], ({ id }) => {
  const a = byId(S.accounts, id);
  const rows = transactions().filter((t) => t.accountId === id);
  let b = a.opening;
  const withBal = rows.map((t) => ({ ...t, bal: (b += t.dir === "IN" ? t.amount : -t.amount) }));
  return `${pageHead(esc(a.name), `${a.type === "CASH" ? "صندوق" : esc(a.bank) + " · <span class='num'>" + a.iban + "</span>"}`, "", `<a href="#/accounts">الحسابات</a> / ${esc(a.name)}`)}
  <div class="grid g4">${kpi({ label: "الرصيد الافتتاحي", value: sar(a.opening), icon: "wallet" })}${kpi({ label: "المقبوضات", value: sar(rows.filter((t) => t.dir === "IN").reduce((s, t) => s + t.amount, 0)), icon: "trend", color: "#047857" })}${kpi({ label: "المدفوعات", value: sar(rows.filter((t) => t.dir === "OUT").reduce((s, t) => s + t.amount, 0)), icon: "down", color: "#d1495b" })}${kpi({ label: "الرصيد الحالي", value: sar(accountBalance(a.id)), icon: "bank" })}</div>
  <div class="section-title">دفتر الحساب</div>${table("acc-" + id, [
    { key: "at", label: "التاريخ", value: (t) => t.at, render: (t) => `<span class="num">${fmtDT(t.at)}</span>` },
    { key: "desc", label: "البيان", text: (t) => t.desc },
    { key: "in", label: "داخل", value: (t) => (t.dir === "IN" ? t.amount : 0), render: (t) => (t.dir === "IN" ? money(t.amount) : "") },
    { key: "out", label: "خارج", value: (t) => (t.dir === "OUT" ? t.amount : 0), render: (t) => (t.dir === "OUT" ? money(t.amount) : "") },
    { key: "bal", label: "الرصيد بعد الحركة", value: (t) => t.bal, render: (t) => `<b>${money(t.bal)}</b>` },
  ], withBal, { sort: "at", rowLink: (t) => (t.src === "PAYMENT" ? "/payments/" + t.ref : t.src === "EXPENSE" ? "/expenses" : "/rentals/" + t.ref) })}`;
});
ACTIONS.addBank = () => {
  UI.bk = { name: "", bank: "", iban: "", opening: 0 };
  openModal("حساب بنكي جديد", () => `<div class="form-grid"><div class="field"><label>اسم الحساب</label><input class="input" id="bk-n" data-act-input="bkSet" data-k="name"></div><div class="field"><label>البنك</label><input class="input" id="bk-b" data-act-input="bkSet" data-k="bank"></div><div class="field"><label>IBAN</label><input class="input" id="bk-i" data-act-input="bkSet" data-k="iban" dir="ltr"></div><div class="field"><label>الرصيد الافتتاحي</label><input class="input" id="bk-o" data-act-input="bkOpen"></div></div>`, `<button class="btn primary" data-act="bkSave" data-label="حفظ">حفظ</button>`);
};
ACTIONS.bkSet = (el) => (UI.bk[el.dataset.k] = el.value);
ACTIONS.bkOpen = (el) => (UI.bk.opening = parseMoney(el.value));
ACTIONS.bkSave = (el) =>
  runAction(el, () => {
    if (!UI.bk.name) throw new DomainError("اسم الحساب مطلوب");
    const a = { id: uid("acc"), type: "BANK", ...UI.bk };
    S.accounts.push(a);
    audit(ME, "ACCOUNT_CREATE", "Account", a.id, null, a);
    touch();
    closeModal();
  }, "تم إضافة الحساب البنكي");

/* ─── المصروفات ─── */
route("/expenses", ["expenses"], (_, query) => {
  if (query.f) {
    TBL.expenses ||= { q: "", sort: "at", dir: "desc", page: 0, size: 12, hidden: new Set(), filters: {} };
    TBL.expenses.filters.st = query.f;
  }
  const rows = S.expenses;
  const th = S.settings.expenseThreshold;
  return `${pageHead("المصروفات", `أقل من ${nf0.format(th / 100)} ر.س يُرحّل مباشرة · من ${nf0.format(th / 100)} فأكثر ينتظر قرار المالك ولا يُخصم قبله`, `<button class="btn primary" data-act="quick" data-h="@expense">${ic("plus")}مصروف جديد</button>`)}
  ${table(
    "expenses",
    [
      { key: "no", label: "الرقم", text: (e) => e.no, render: (e) => `<span class="num">${e.no}</span>` },
      { key: "at", label: "التاريخ", value: (e) => e.at, text: (e) => fmtDate(e.at), render: (e) => dateNum(e.at) },
      { key: "cat", label: "النوع", text: (e) => e.cat },
      { key: "desc", label: "الوصف", text: (e) => e.desc },
      { key: "amt", label: "المبلغ", value: (e) => e.amount, render: (e) => sar(e.amount) },
      { key: "acc", label: "الحساب", text: (e) => accName(e.accountId) },
      { key: "proj", label: "المشروع", text: (e) => (e.projectId ? projName(e.projectId) : "—") },
      { key: "req", label: "الطالب", text: (e) => userName(e.requestedBy) },
      { key: "rev", label: "المراجع", text: (e) => (e.reviewedBy ? userName(e.reviewedBy) : "—") },
      { key: "st", label: "الحالة", text: (e) => BADGES[e.status][0], render: (e) => badge(e.status) + (e.reason && e.status === "REJECTED" ? ` <span class="xs muted">${esc(e.reason)}</span>` : "") },
      { key: "act", label: "", search: false, text: () => "", render: (e) => (e.status === "PENDING" && ME.role === "OWNER" ? `<a class="btn sm" href="#/approvals">قرار</a>` : "") },
    ],
    rows,
    {
      sort: "at",
      filters: [
        { key: "st", label: "الحالة", options: [["APPROVED", "معتمد"], ["PENDING", "معلق"], ["REJECTED", "مرفوض"]], match: (e, v) => e.status === v },
        { key: "cat", label: "النوع", options: EXPENSE_CATS.map((c) => [c, c]), match: (e, v) => e.cat === v },
      ],
      footer: (c, data) => (c.key === "amt" ? `معتمد: ${money(data.filter((e) => e.status === "APPROVED").reduce((a, e) => a + e.amount, 0))}` : ""),
    },
  )}`;
});
function openExpenseModal() {
  UI.ef = { cat: EXPENSE_CATS[0], amount: 0, accountId: "a-cash", method: "CASH", chequeNo: "", payee: "", date: isoDay(Date.now()), desc: "", projectId: "", attach: false, key: newKey("exp") };
  openModal(
    "مصروف جديد",
    () => {
      const f = UI.ef;
      const needs = f.amount >= S.settings.expenseThreshold;
      return `<div class="form-grid"><div class="field"><label>نوع المصروف</label><select class="select" data-act-change="efCat">${EXPENSE_CATS.map((c) => `<option ${f.cat === c ? "selected" : ""}>${c}</option>`).join("")}</select></div><div class="field"><label>المبلغ *</label><input class="input" id="ef-amt" value="${f.amount ? (f.amount / 100).toFixed(2) : ""}" data-act-input="efAmt" inputmode="decimal" placeholder="0.00"></div><div class="field"><label>الحساب</label><select class="select" data-act-change="efAcc">${S.accounts.map((a) => `<option value="${a.id}" ${f.accountId === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select></div><div class="field"><label>التاريخ</label><input type="date" class="input" value="${f.date}" data-act-change="efDate"></div><div class="field"><label>المشروع</label><select class="select" data-act-change="efProj"><option value="">— عام —</option>${S.projects.map((p) => `<option value="${p.id}" ${f.projectId === p.id ? "selected" : ""}>${esc(p.name)} — ${esc(custName(p.customerId))}</option>`).join("")}</select></div><div class="field"><label>المرفق</label><label class="row small"><input type="checkbox" data-act-change="efAttach" ${f.attach ? "checked" : ""}> إرفاق فاتورة المورد</label></div><div class="field"><label>اصرفوا للمكرم (المستفيد)</label><input class="input" id="ef-payee" value="${esc(f.payee)}" placeholder="مثال: ورشة الصيانة" data-act-input="efPayee"></div><div class="field"><label>طريقة الصرف</label><select class="select" data-act-change="efMethod">${[["CASH", "نقدًا"], ["CHEQUE", "شيك"], ["TRANSFER", "تحويل بنكي"]].map(([k, v]) => `<option value="${k}" ${f.method === k ? "selected" : ""}>${v}</option>`).join("")}</select></div>${f.method === "CHEQUE" ? `<div class="field"><label>رقم الشيك *</label><input class="input" id="ef-chq" value="${esc(f.chequeNo)}" data-act-input="efChq"></div>` : ""}<div class="field full"><label>وذلك مقابل (الوصف)</label><input class="input" id="ef-desc" value="${esc(f.desc)}" data-act-input="efDesc"></div></div>
      <div class="alert ${needs ? "warn" : "ok"}" style="margin-top:10px">${ic(needs ? "clock" : "check")}<div>${needs ? `المبلغ ${nf0.format(S.settings.expenseThreshold / 100)} ر.س أو أكثر: <b>سيُنشأ طلب موافقة للمالك</b> ولن يُخصم من الحساب قبل القرار.` : "أقل من حد الاعتماد: يُرحّل مباشرة وينخفض رصيد الحساب."}</div></div>`;
    },
    `<button class="btn primary" data-act="efSave" data-label="حفظ المصروف">${ic("check")}حفظ المصروف</button><button class="btn" data-act="closeModal">إلغاء</button>`,
    "wide",
  );
}
Object.assign(ACTIONS, {
  efCat: (el) => (UI.ef.cat = el.value),
  efAmt: (el) => ((UI.ef.amount = parseMoney(el.value)), rerenderModal()),
  efAcc: (el) => (UI.ef.accountId = el.value),
  efDate: (el) => (UI.ef.date = el.value),
  efProj: (el) => (UI.ef.projectId = el.value),
  efAttach: (el) => (UI.ef.attach = el.checked),
  efDesc: (el) => (UI.ef.desc = el.value),
  efPayee: (el) => (UI.ef.payee = el.value),
  efChq: (el) => (UI.ef.chequeNo = el.value),
  efMethod: (el) => {
    UI.ef.method = el.value;
    UI.ef.accountId = el.value === "CASH" ? "a-cash" : UI.ef.accountId === "a-cash" ? "a-rajhi" : UI.ef.accountId;
    rerenderModal();
  },
  efSave: (el) =>
    runAction(
      el,
      () => {
        const f = UI.ef;
        const r = createExpense({ cat: f.cat, amount: f.amount, accountId: f.accountId, desc: f.desc, payee: f.payee, method: f.method, chequeNo: f.chequeNo, projectId: f.projectId, attachment: f.attach, at: isoDay(Date.now()) === f.date ? Date.now() : parseDay(f.date) + 12 * 3600000, idemKey: f.key }, ME);
        closeModal();
        return r;
      },
      (r) => (r.duplicate ? "المصروف مسجل مسبقًا" : r.expense.status === "PENDING" ? "أُرسل المصروف لاعتماد المالك — يصدر سند الصرف بعد الاعتماد" : `تم تسجيل المصروف وإصدار سند الصرف ${r.expense.pvNo}`),
    ),
});

/* ─── مركز الموافقات ─── */
route("/approvals", ["*"], () => {
  const pending = S.approvals.filter((a) => a.status === "PENDING").sort((a, b) => b.at - a.at);
  const done = S.approvals.filter((a) => a.status !== "PENDING").sort((a, b) => b.decidedAt - a.decidedAt);
  const TYPE = { EXPENSE: "مصروف فوق الحد", SALE_DISCOUNT: "خصم فوق صلاحية البائع" };
  const impact = (a) => {
    if (a.type === "EXPENSE") {
      const e = byId(S.expenses, a.entityId);
      return `عند الاعتماد: يُخصم ${money(e.amount)} مرة واحدة من <b>${esc(accName(e.accountId))}</b> (الرصيد الآن ${money(accountBalance(e.accountId))}). عند الرفض: لا أثر.`;
    }
    const s = byId(S.sales, a.entityId);
    return `عند الاعتماد: يُخصم المخزون وتصدر فاتورة ${money(s.total)} على ${esc(custName(s.customerId))}. عند الرفض: يُلغى البيع دون أثر.`;
  };
  return `${pageHead("مركز الموافقات", "كل قرار يحفظ الأثر قبل/بعد ومن نفّذه ومتى — ولا يتكرر أثره لو أُرسل مرتين")}
  <div class="grid g2">${pending.map((a) => `<div class="card card-b"><div class="row between"><span class="chip">${TYPE[a.type]}</span><span class="xs muted num">${fmtDT(a.at)}</span></div><div class="bold" style="margin:8px 0">${esc(a.summary)}</div><div class="small muted">طلبه: ${esc(userName(a.requestedBy))} · <a class="link" href="#/${a.type === "EXPENSE" ? "expenses" : "sales/" + a.entityId}">فتح المستند</a></div><div class="alert info" style="margin-top:8px">${ic("info")}<div>${impact(a)}</div></div><div class="field" style="margin-top:10px"><input class="input" id="apr-${a.id}" placeholder="سبب القرار (إلزامي عند الرفض)"></div><div class="row" style="margin-top:10px"><button class="btn success" data-act="decide" data-a="${a.id}" data-d="APPROVED" data-label="اعتماد">${ic("check")}اعتماد</button><button class="btn danger" data-act="decide" data-a="${a.id}" data-d="REJECTED" data-label="رفض">${ic("x")}رفض</button></div></div>`).join("") || `<div class="card span2">${emptyBox("لا طلبات معلقة", "approve")}</div>`}</div>
  <div class="section-title">القرارات السابقة</div>
  ${table("approvals-done", [
    { key: "at", label: "تاريخ القرار", value: (a) => a.decidedAt, render: (a) => `<span class="num">${fmtDT(a.decidedAt)}</span>` },
    { key: "t", label: "النوع", text: (a) => TYPE[a.type] },
    { key: "s", label: "الطلب", text: (a) => a.summary },
    { key: "req", label: "الطالب", text: (a) => userName(a.requestedBy) },
    { key: "by", label: "صاحب القرار", text: (a) => userName(a.decidedBy) },
    { key: "st", label: "القرار", text: (a) => a.status, render: (a) => badge(a.status) },
    { key: "r", label: "السبب", text: (a) => a.reason || "—" },
  ], done, { sort: "at" })}`;
});
ACTIONS.decide = (el) => {
  const reason = document.getElementById("apr-" + el.dataset.a)?.value || "";
  runAction(el, () => decideApproval(el.dataset.a, el.dataset.d, reason, ME), el.dataset.d === "APPROVED" ? "تم اعتماد العملية" : "تم رفض الطلب");
};

/* ─── يومية الصندوق (بنفس تبويب ملف Excel الحالي) ─── */
route("/daily", ["daily"], (_, query) => {
  const day = query.d || isoDay(Date.now());
  const from = parseDay(day),
    to = from + DAY;
  const txs = transactions().filter((t) => t.at >= from && t.at < to);
  const pays = S.payments.filter((p) => p.at >= from && p.at < to);
  const cashSalesIds = new Set(S.sales.filter((s) => s.term === "CASH").map((s) => s.invoiceId));
  const isCashSale = (p) => p.allocations.every((a) => cashSalesIds.has(a.invoiceId)) && p.notes?.startsWith("دفعة عند البيع");
  const rowsFor = (pred) => pays.filter(pred);
  const cashSales = rowsFor(isCashSale);
  const receipts = rowsFor((p) => !isCashSale(p));
  const deps = S.deposits.filter((d) => d.at >= from && d.at < to);
  const exps = S.expenses.filter((e) => e.status === "APPROVED" && e.postedAt >= from && e.postedAt < to);
  const col = (arr, f) => ({ cheque: arr.filter((x) => f(x) === "CHEQUE").reduce((a, x) => a + x.amount, 0), cash: arr.filter((x) => f(x) !== "CHEQUE").reduce((a, x) => a + x.amount, 0) });
  const cs = col(cashSales, (p) => p.method),
    rc = col(receipts, (p) => p.method),
    dp = col(deps.filter((d) => d.kind === "RECEIVED"), () => "CASH"),
    ex = col(exps, () => "CASH");
  const tbl = (title, list, cols) => `<div class="card"><div class="card-h"><h3>${title}</h3></div><div class="tbl-wrap"><table class="tbl"><thead><tr>${cols.map((c) => `<th>${c[0]}</th>`).join("")}</tr></thead><tbody>${list.map((x) => `<tr>${cols.map((c) => `<td>${c[1](x)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${cols.length}" class="faint" style="text-align:center">لا حركات</td></tr>`}</tbody></table></div></div>`;
  return `${pageHead("الحركة اليومية للصندوق — فرع المدينة", "تُولَّد تلقائيًا من السندات بنفس تبويب اليومية الحالية — بلا إدخال يدوي", `<input type="date" class="input" style="width:170px" value="${day}" max="${isoDay(Date.now())}" data-act-change="dailyDay"><a class="btn" href="#/print/daily/${day}">${ic("print")}طباعة اليومية</a>`)}
  <div class="grid g4">${kpi({ label: "المبيعات النقدية", value: sar(cs.cash + cs.cheque), icon: "cart" })}${kpi({ label: "مقبوضات العملاء", value: sar(rc.cash + rc.cheque), icon: "cash", color: "#047857" })}${kpi({ label: "المصروفات", value: sar(ex.cash), icon: "wallet", color: "#d1495b" })}${kpi({ label: "صافي اليوم", value: sar(cs.cash + cs.cheque + rc.cash + rc.cheque + dp.cash - ex.cash - deps.filter((d) => d.kind === "REFUNDED").reduce((a, d) => a + d.amount, 0)), icon: "repeat" })}</div>
  <div class="grid g2" style="margin-top:14px">
    ${tbl("المبيعات النقدية", cashSales, [["رقم السند", (p) => `<a class="link num" href="#/payments/${p.id}">${p.no}</a>`], ["المندوب", (p) => esc(p.repName)], ["نقدية", (p) => (p.method !== "CHEQUE" ? money(p.amount) : "")], ["شيك", (p) => (p.method === "CHEQUE" ? money(p.amount) : "")]])}
    ${tbl("مقبوضات العملاء", receipts, [["رقم السند", (p) => `<a class="link num" href="#/payments/${p.id}">${p.no}</a>`], ["العميل", (p) => esc(custName(p.customerId))], ["المندوب", (p) => esc(p.repName)], ["الحساب", (p) => esc(accName(p.accountId))], ["نقدية", (p) => (p.method !== "CHEQUE" ? money(p.amount) : "")], ["شيك", (p) => (p.method === "CHEQUE" ? money(p.amount) : "")]])}
    ${tbl("المصروفات", exps, [["السند", (e) => `<span class="num">${e.no}</span>`], ["التبويب", (e) => esc(e.cat)], ["البيان", (e) => esc(e.desc)], ["الحساب", (e) => esc(accName(e.accountId))], ["المبلغ", (e) => money(e.amount)]])}
    ${tbl("التأمينات (ليست إيرادًا)", deps, [["العقد", (d) => `<a class="link num" href="#/rentals/${d.rentalId}">${byId(S.rentals, d.rentalId).no}</a>`], ["النوع", (d) => ({ RECEIVED: "قبض", REFUNDED: "رد", FORFEITED: "حسم" })[d.kind]], ["الحساب", (d) => esc(accName(d.accountId))], ["المبلغ", (d) => money(d.amount)]])}
  </div>
  <div class="card" style="margin-top:14px"><div class="card-h"><h3>أرصدة الحسابات (عهدة مدير الفرع)</h3></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>الحساب</th><th>الرصيد السابق</th><th>قبض</th><th>صرف</th><th>الرصيد الحالي</th></tr></thead><tbody>${S.accounts
    .map((a) => {
      const t = txs.filter((x) => x.accountId === a.id);
      const inn = t.filter((x) => x.dir === "IN").reduce((s, x) => s + x.amount, 0);
      const out = t.filter((x) => x.dir === "OUT").reduce((s, x) => s + x.amount, 0);
      return `<tr class="click" data-go="/accounts/${a.id}"><td class="bold">${esc(a.name)}</td><td>${money(accountBalance(a.id, from))}</td><td style="color:var(--green)">${money(inn)}</td><td style="color:var(--red)">${money(out)}</td><td><b>${money(accountBalance(a.id, to))}</b></td></tr>`;
    })
    .join("")}</tbody></table></div><div class="card-b row between small muted"><span>محاسب الفرع: ${esc(userName("u-fin"))}</span><span>مدير الفرع: —</span><span>المدير العام: أ/ سليمان الجربوع</span></div></div>`;
});
ACTIONS.dailyDay = (el) => go("/daily?d=" + el.value);

/* ─── سندات الصرف: كل مبلغ يخرج من الصندوق أو البنك له سند برقم ─── */
route("/vouchers", ["expenses"], () => {
  const rows = paymentVouchers();
  return `${pageHead("سندات الصرف", "تصدر تلقائيًا عند ترحيل المصروف أو رد التأمين — المصروف المعلّق لا يصدر له سند قبل الاعتماد", `<button class="btn primary" data-act="quick" data-h="@expense">${ic("plus")}سند صرف جديد</button>`)}
  ${table(
    "vouchers",
    [
      { key: "no", label: "رقم السند", text: (v) => v.no, render: (v) => `<a class="link num" href="#/print/pv/${v.kind}/${v.id}">${v.no}</a>` },
      { key: "at", label: "التاريخ", value: (v) => v.at, text: (v) => fmtDate(v.at), render: (v) => dateNum(v.at) },
      { key: "payee", label: "اصرفوا للمكرم", text: (v) => v.payee },
      { key: "amt", label: "المبلغ", value: (v) => v.amount, render: (v) => `<b>${sar(v.amount)}</b>` },
      { key: "for", label: "وذلك مقابل", text: (v) => v.forWhat },
      { key: "m", label: "الطريقة", text: (v) => METHOD[v.method] + (v.chequeNo ? " " + v.chequeNo : "") },
      { key: "acc", label: "الحساب", text: (v) => accName(v.accountId) },
      { key: "proj", label: "المشروع", text: (v) => (v.projectId ? projName(v.projectId) : "—") },
      { key: "by", label: "المحاسب", text: (v) => userName(v.by) },
      { key: "ap", label: "المعتمد", text: (v) => userName(v.approvedBy) },
      { key: "src", label: "المصدر", text: (v) => (v.kind === "exp" ? "مصروف " + v.ref : "رد تأمين"), render: (v) => `<span class="chip">${v.kind === "exp" ? "مصروف" : "رد تأمين"}</span>` },
      { key: "pr", label: "", search: false, text: () => "", render: (v) => `<a class="btn sm" href="#/print/pv/${v.kind}/${v.id}">${ic("print")}</a>` },
    ],
    rows,
    {
      sort: "at",
      rowLink: (v) => `/print/pv/${v.kind}/${v.id}`,
      hidden: ["proj", "ap"],
      filters: [
        { key: "acc", label: "الحساب", options: S.accounts.map((a) => [a.id, a.name]), match: (v, x) => v.accountId === x },
        { key: "src", label: "المصدر", options: [["exp", "مصروفات"], ["dep", "رد تأمين"]], match: (v, x) => v.kind === x },
        { key: "m", label: "الطريقة", options: [["CASH", "نقدًا"], ["CHEQUE", "شيك"], ["TRANSFER", "تحويل"]], match: (v, x) => v.method === x },
      ],
      footer: (c, data) => (c.key === "amt" ? sar(data.reduce((a, v) => a + v.amount, 0)) : c.key === "no" ? "الإجمالي" : ""),
    },
  )}`;
});

route("/print/pv/:kind/:id", ["expenses"], ({ kind, id }) => {
  const v = paymentVouchers().find((x) => x.kind === kind && x.id === id);
  if (!v) throw new DomainError("لا يوجد سند صرف لهذا المستند — المصروف لم يُعتمد بعد");
  const acc = byId(S.accounts, v.accountId);
  return printWrap(
    `<div class="print-sheet" style="min-height:640px" data-doc="${v.no}">${sheetHead(v.no, "سنـد صـرف — Payment Voucher")}
    <div class="row between" style="margin-top:6px"><div class="small">التاريخ: <b class="num">${fmtHijri(v.at)}</b><br>الموافق: <b class="num">${fmtDate(v.at)}</b> م</div><div class="ps-amount"><span class="num">${nf2.format(v.amount / 100)}</span><span>ريال S.R.</span></div></div>
    <div class="ps-box">
      <div class="ps-line"><span>اصرفوا للمكرم / Pay To Mr.</span><b>${esc(v.payee)}</b></div>
      <div class="ps-line"><span>مبلغًا وقدره / Amount of S.R</span><b>${tafqeet(v.amount)}</b></div>
      <div class="ps-line"><span>نقدًا / شيك رقم</span><b>${v.method === "CHEQUE" ? "شيك رقم " + esc(v.chequeNo) : METHOD[v.method]}</b></div>
      <div class="ps-line"><span>على بنك / Bank</span><b>${acc.type === "BANK" ? esc(acc.bank || acc.name) : "—"}</b><span style="min-width:auto;color:#1e3a8a">تاريخ</span><b class="num" style="flex:0 0 auto">${fmtDate(v.at)}</b></div>
      <div class="ps-line"><span>وذلك مقابل / On Account of</span><b>${esc(v.forWhat)}${v.projectId ? " — مشروع " + esc(projName(v.projectId)) : ""}</b></div>
      <div class="ps-line"><span>من حساب</span><b>${esc(acc.name)} <span style="color:#64748b">· مرجع ${esc(v.ref)}</span></b></div>
    </div>
    <div class="ps-sign"><div>المحاسب Accountant: ${esc(userName(v.by))}</div><div>المعتمد: ${esc(userName(v.approvedBy))}</div><div>المستلم Receiver</div></div>${tplStamp(v.at)}${sheetFoot()}</div>`,
    "#/vouchers",
  );
});

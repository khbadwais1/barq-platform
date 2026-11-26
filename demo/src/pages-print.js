/* ═══════════ المطبوعات (بتصميم أوراق المؤسسة الحالية) ═══════════ */
"use strict";

/* تفقيط عربي مبسط: ريال وهللة */
function tafqeet(halalas) {
  const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
  const tens = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];
  const below1000 = (n) => {
    const parts = [];
    const h = Math.floor(n / 100),
      r = n % 100;
    if (h) parts.push(hundreds[h]);
    if (r) {
      if (r < 20) parts.push(ones[r]);
      else {
        const o = r % 10,
          t = Math.floor(r / 10);
        parts.push(o ? `${ones[o]} و${tens[t]}` : tens[t]);
      }
    }
    return parts.join(" و");
  };
  const scale = (n, one, two, few, many) => (n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${below1000(n)} ${few}` : `${below1000(n)} ${many}`);
  const words = (n) => {
    if (n === 0) return "صفر";
    const parts = [];
    const m = Math.floor(n / 1e6),
      th = Math.floor((n % 1e6) / 1000),
      rest = n % 1000;
    if (m) parts.push(scale(m, "مليون", "مليونان", "ملايين", "مليون"));
    if (th) parts.push(scale(th, "ألف", "ألفان", "آلاف", "ألف"));
    if (rest) parts.push(below1000(rest));
    return parts.join(" و");
  };
  const sarPart = Math.floor(halalas / 100),
    hl = halalas % 100;
  return `فقط ${words(sarPart)} ريال${hl ? ` و${words(hl)} هللة` : ""} لا غير`;
}

/* رمز QR لفاتورة ZATCA (المرحلة الأولى): TLV بترميز Base64 */
function zatcaTLV(inv) {
  const enc = new TextEncoder();
  const fields = [COMPANY.name, COMPANY.vat, new Date(inv.at).toISOString(), (inv.total / 100).toFixed(2), (inv.vat / 100).toFixed(2)];
  const bytes = [];
  fields.forEach((v, i) => {
    const b = enc.encode(v);
    bytes.push(i + 1, b.length, ...b);
  });
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

function sheetHead(no, title, extra = "") {
  return `<div class="ps-watermark">B</div><div class="ps-head"><div class="ar"><b>سقــالات البـــرق</b><span>${COMPANY.tagline}</span></div><div class="ps-logo">B<small>ALBARQ</small></div><div class="en"><b>Al-Barq Scaffolding</b><span>Sale - Rent - Buy</span><div class="ps-no">${no}</div></div></div>${title ? `<div class="ps-title">${title}</div>` : ""}${extra}`;
}
const sheetFoot = () => `<div class="ps-foot">${COMPANY.address} - س.ت / ${COMPANY.cr} — الرقم الضريبي ${COMPANY.vat}<br>جوال: ${COMPANY.phones}</div>`;
const tplStamp = (at) => `<div class="xs" style="margin-top:22px;color:#94a3b8">نموذج v1 · أُصدر ${fmtDT(at)} · أعيدت طباعته ${fmtDT(Date.now())} — الأرقام مطابقة للأصل</div>`;
function printWrap(sheet, back, note = "") {
  return `<div class="content" style="max-width:1150px">${pageHead("معاينة الطباعة", note || "قالب RTL مطابق لأوراق المؤسسة الحالية — يُعتمد شكله النهائي بعد مراجعة العميل", `${pdfBtn()}<button class="btn primary" onclick="window.print()">${ic("print")}طباعة</button><a class="btn" href="${back}">رجوع</a>`)}<div class="alert warn" style="margin-bottom:14px">${ic("info")}<div>بند اعتماد: «تعديل وتغير على الورق المرابيع الخ» — هذه نسخة رقمية من النموذج الحالي، والمطلوب من المؤسسة تحديد التعديلات على كل ورقة.</div></div><div class="print-wrap">${sheet}</div></div>`;
}
const box = (on) => `<span style="display:inline-block;width:16px;height:16px;border:1.5px solid #1e3a8a;vertical-align:-3px;text-align:center;line-height:14px;font-weight:800">${on ? "✓" : ""}</span>`;

route("/print/invoice/:id", ["invoices", "invoices.own"], ({ id }) => {
  const i = byId(S.invoices, id);
  if (!canSeeInvoice(ME, i)) throw new DomainError("خارج نطاق صلاحيتك");
  const c = byId(S.customers, i.customerId);
  const qr = typeof qrSvg === "function" ? qrSvg(zatcaTLV(i)) : "";
  const simplified = !c.vat;
  return printWrap(
    `<div class="print-sheet">${sheetHead(i.no, simplified ? "فاتورة ضريبية مبسطة — Simplified Tax Invoice" : "فاتورة ضريبية — Tax Invoice")}
    <div class="row between" style="align-items:flex-start;margin-top:10px"><div class="ps-fields" style="flex:1;grid-template-columns:1fr 1fr">
      <div>العميل: <b>${esc(c.name)}</b></div><div>تاريخ الإصدار: <b class="num">${fmtDate(i.at)}</b> — <b class="num">${fmtHijri(i.at)}</b></div>
      <div>المشروع: <b>${esc(projName(i.projectId))}</b></div><div>تاريخ الاستحقاق: <b class="num">${fmtDate(i.due)}</b></div>
      ${c.vat ? `<div>الرقم الضريبي للعميل: <b class="num">${c.vat}</b></div>` : `<div>جوال العميل: <b class="num">${c.mobile}</b></div>`}<div>${i.kind === "SALE" ? "رقم البيع" : "رقم العقد"}: <b class="num">${(i.kind === "SALE" ? byId(S.sales, i.refId) : byId(S.rentals, i.refId))?.no}</b></div>
      ${i.periodFrom ? `<div>فترة الإيجار: <b class="num">${fmtDate(i.periodFrom)} ← ${fmtDate(i.periodTo)}</b></div>` : ""}<div>البائع: <b>${esc(userName(i.sellerId))}</b></div>
    </div><div style="width:130px;text-align:center">${qr}<div class="xs" style="color:#64748b">رمز ZATCA</div></div></div>
    <table class="ps-table"><thead><tr><th>#</th><th style="width:45%">البيان</th><th>الكمية</th><th>سعر الوحدة</th><th>الخصم</th><th>الصافي</th></tr></thead><tbody>${i.items.map((it, k) => `<tr><td>${k + 1}</td><td style="text-align:right">${esc(it.desc)}</td><td class="num">${nf0.format(it.qty)}</td><td class="num">${nf2.format(it.price / 100)}</td><td class="num">${nf2.format(it.disc / 100)}</td><td class="num">${nf2.format(it.net / 100)}</td></tr>`).join("")}</tbody></table>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><table class="ps-table" style="width:340px"><tr><td>الإجمالي قبل الخصم</td><td class="num">${nf2.format(i.gross / 100)}</td></tr><tr><td>الخصم</td><td class="num">${nf2.format(i.disc / 100)}</td></tr><tr><td>الإجمالي الخاضع للضريبة</td><td class="num">${nf2.format(i.taxable / 100)}</td></tr><tr><td>ضريبة القيمة المضافة ${i.rate}%</td><td class="num">${nf2.format(i.vat / 100)}</td></tr><tr><th>الإجمالي المستحق</th><th class="num">${nf2.format(i.total / 100)} ر.س</th></tr><tr><td>المدفوع</td><td class="num">${nf2.format(invPaid(i) / 100)}</td></tr><tr><td>المتبقي</td><td class="num">${nf2.format(invRemaining(i) / 100)}</td></tr></table></div>
    <div class="small" style="margin-top:8px;color:#0f172a">${tafqeet(i.total)}</div>
    ${invStatus(i) === "PAID" ? '<div class="ps-stamp">مدفوعة</div>' : ""}${tplStamp(i.at)}${sheetFoot()}</div>`,
    "#/invoices/" + id,
  );
});

route("/print/dn/:id", [], ({ id }) => {
  const d = byId(S.deliveries, id);
  const ref = d.kind === "SALE" ? byId(S.sales, d.refId) : byId(S.rentals, d.refId);
  if (d.kind === "SALE" ? !canSeeSale(ME, ref) : !canSeeRental(ME, ref)) throw new DomainError("خارج نطاق صلاحيتك");
  const total = d.lines.reduce((a, l) => a + (l.price || 0) * (d.kind === "SALE" ? (byId(S.products, l.pid).pricing === "METER" ? l.meters : l.count) : l.count), 0);
  return printWrap(
    `<div class="print-sheet">${sheetHead(d.no, "سنـد إستلام مـواد")}
    <div class="ps-fields"><div>التاريخ: <b class="num">${fmtDate(d.at)}</b> م — <b class="num">${fmtHijri(d.at)}</b></div><div>نوع العملية: بيع ${box(d.kind === "SALE")} &nbsp; إيجار Rent ${box(d.kind === "RENTAL")}</div>
    <div>اسم العميل: <b>${esc(custName(d.customerId))}</b></div><div>اسم المندوب: <b>${esc(d.repName || "—")}</b></div>
    <div>اسم المشروع: <b>${esc(projName(d.projectId))}</b></div><div>المرجع: <b class="num">${ref.no}</b> (${d.kind === "SALE" ? "بيع" : "عقد إيجار"}) · ${esc(whName(d.wh))}</div></div>
    <table class="ps-table"><thead><tr><th>العدد<br><small>QUAT.</small></th><th>الكمية (م)<br><small>Qty</small></th><th>السعر<br><small>Price</small></th><th style="width:50%">البيـــــان<br><small>Description</small></th></tr></thead><tbody>${d.lines.map((l) => `<tr><td class="num">${nf0.format(l.count)}</td><td class="num">${l.meters ? nf2.format(l.meters) : ""}</td><td class="num">${l.price ? nf2.format(l.price / 100) + (d.kind === "RENTAL" ? ` / ${BASIS_UNIT[ref.basis]}` : "") : ""}</td><td style="text-align:right">${esc(l.name)}</td></tr>`).join("")}${Array.from({ length: Math.max(0, 12 - d.lines.length) }, () => "<tr><td></td><td></td><td></td><td></td></tr>").join("")}</tbody></table>
    <div class="ps-line"><span>الإجمالي Total</span><b>${d.kind === "SALE" ? nf2.format(total / 100) + " ر.س (قبل الضريبة)" : `${nf0.format(d.lines.reduce((a, l) => a + l.count, 0))} قطعة`}</b></div>
    <div class="ps-sign"><div>المستلم: ${esc(d.receiver || "")}</div><div>محرر الفاتورة: ${esc(userName(d.createdBy))}</div><div>اسم السائق: ${esc(d.driver || "")}</div></div>
    <div style="text-align:center;margin-top:16px;font-weight:700">استلمت البضاعة الموضحة أعلاه وبحالة جيدة على سبيل الأمانة</div>${tplStamp(d.at)}${sheetFoot()}</div>`,
    d.kind === "SALE" ? "#/sales/" + d.refId : "#/rentals/" + d.refId,
  );
});

/* كشف دخول حديد/أخشاب: مصفوفة صنف × طول كما في النموذج */
route("/print/rn/:id", [], ({ id }) => {
  const rn = byId(S.returns, id);
  const r = byId(S.rentals, rn.rentalId);
  if (!canSeeRental(ME, r)) throw new DomainError("خارج نطاق صلاحيتك");
  const c = byId(S.customers, rn.customerId);
  const fams = [...new Set(S.products.filter((p) => p.len).map((p) => p.family))];
  const lens = [...new Set(S.products.filter((p) => p.len).map((p) => p.len))].sort((a, b) => a - b);
  const cell = (fam, len) => {
    const qs = rn.lines.filter((l) => {
      const p = byId(S.products, l.pid);
      return p.family === fam && p.len === len;
    });
    if (!qs.length) return "";
    return qs.map((l) => `${l.qty}${l.cond !== "GOOD" ? `<sup style="color:#b91c1c">${COND_LABEL[l.cond][0]}</sup>` : ""}`).join("+");
  };
  const singles = rn.lines.filter((l) => !byId(S.products, l.pid).len);
  return printWrap(
    `<div class="print-sheet land">${sheetHead(rn.no, "كشف دخول حديد / أخشاب")}
    <div class="ps-fields"><div>اسم العميل: <b>${esc(c.name)}</b></div><div>التاريخ: <b class="num">${fmtHijri(rn.at)}</b> — الموافق <b class="num">${fmtDate(rn.at)}</b> م</div><div>الكفيل الغارم: <b>${esc(c.guarantor || "—")}</b>${c.guarantorId ? ` · <span class="num">${c.guarantorId}</span>` : ""}</div><div>اسم المندوب: <b>${esc(byId(S.reps, r.repId)?.name || "—")}</b></div><div>المشروع: <b>${esc(projName(rn.projectId))}</b> · العقد <b class="num">${r.no}</b></div><div>شراء ${box(false)} &nbsp; إيجار ${box(true)}</div></div>
    <table class="ps-table"><thead><tr><th>صنف / طول</th>${lens.map((l) => `<th class="num">${l.toFixed(2)}</th>`).join("")}<th>ملاحظات</th></tr></thead><tbody>${fams.map((f) => `<tr><td style="font-weight:700;text-align:right">${esc(f)}</td>${lens.map((l) => `<td class="num">${cell(f, l)}</td>`).join("")}<td></td></tr>`).join("")}</tbody></table>
    ${singles.length ? `<table class="ps-table" style="margin-top:8px"><tr>${singles.map((l) => `<th>${esc(l.name)}</th>`).join("")}</tr><tr>${singles.map((l) => `<td class="num">${l.qty} ${l.cond !== "GOOD" ? `(${COND_LABEL[l.cond]})` : ""}</td>`).join("")}</tr></table>` : ""}
    <div class="xs" style="margin-top:6px;color:#475569">الرموز: ي = يحتاج صيانة، ت = تالف، م = مفقود. الإجمالي: ${nf0.format(rn.lines.reduce((a, l) => a + l.qty, 0))} قطعة.</div>
    <div class="ps-sign"><div>مسؤول العدد: ${esc(rn.counter || "")}</div><div>مسؤول البوابة: ${esc(rn.gate || "")}</div><div>السائق: ${esc(rn.driver || "")}<br>مبلغ الصيانة: <b class="num">${nf2.format(rn.fee / 100)}</b> ريال</div></div>${tplStamp(rn.at)}${sheetFoot()}</div>`,
    "#/rentals/" + r.id,
  );
});

route("/print/rv/:id", ["payments", "payments.own"], ({ id }) => {
  const p = byId(S.payments, id);
  if (!canSeePayment(ME, p)) throw new DomainError("خارج نطاق صلاحيتك");
  const bank = byId(S.accounts, p.accountId);
  return printWrap(
    `<div class="print-sheet" style="min-height:640px">${sheetHead(p.no, "سنـد قبـض — Receipt Voucher")}
    <div class="row between" style="margin-top:6px"><div class="small">التاريخ: <b class="num">${fmtHijri(p.at)}</b><br>الموافق: <b class="num">${fmtDate(p.at)}</b> م</div><div class="ps-amount"><span class="num">${nf2.format(p.amount / 100)}</span><span>ريال S.R.</span></div></div>
    <div class="ps-box">
      <div class="ps-line"><span>استلمنا من المكرم /</span><b>${esc(custName(p.customerId))}</b></div>
      <div class="ps-line"><span>مبلغًا وقدره</span><b>${tafqeet(p.amount)}</b></div>
      <div class="ps-line"><span>وذلك مقابل</span><b>سداد ${p.allocations.map((a) => "الفاتورة " + byId(S.invoices, a.invoiceId).no).join(" و")} — مشروع ${esc(projName(p.projectId))}</b></div>
      <div class="ps-line"><span>نقدًا / شيك رقم</span><b>${p.method === "CHEQUE" ? "شيك رقم " + esc(p.ref) : METHOD[p.method]}${p.method !== "CASH" && p.ref && p.method !== "CHEQUE" ? " — مرجع " + esc(p.ref) : ""}</b></div>
      <div class="ps-line"><span>على بنك / الحساب</span><b>${esc(bank.name)}</b></div>
      <div class="ps-line" style="background:#eef2ff;border-radius:6px;padding:7px 8px"><span>اسم المندوب</span><b style="font-size:17px">${esc(p.repName || "—")}</b></div>
    </div>
    <div class="ps-sign"><div>المدير</div><div>المحاسب: ${esc(userName(p.recordedBy))}</div><div>أمين الصندوق</div><div>المستلم</div></div>${tplStamp(p.at)}${sheetFoot()}</div>`,
    "#/payments/" + id,
  );
});

route("/print/pn/:id", ["promissory", "dash.seller", "customers.viewAll"], ({ id }) => {
  const n = byId(S.promissory, id);
  const c = byId(S.customers, n.customerId);
  if (!canSeeCustomer(ME, c)) throw new DomainError("خارج نطاق صلاحيتك");
  return `${pageHead(`سند لأمر ${esc(n.no)}`, `${esc(c.name)}${n.projectId ? " · مشروع " + esc(projName(n.projectId)) : ""}`, `${pdfBtn("#content", "سند لأمر " + n.no)}<a class="btn" href="#/customers/${c.id}${n.projectId ? "?project=" + n.projectId : ""}">العودة للمشروع</a>`, `<a href="#/customers/${c.id}">${esc(c.name)}</a> / سند لأمر`)}
  <div class="grid g4">${kpi({ label: "المبلغ", value: sar(n.amount), icon: "doc" })}${kpi({ label: "تاريخ السند", value: dateNum(n.at), icon: "calendar", sub: fmtHijri(n.at) })}${kpi({ label: "تاريخ الاستحقاق", value: n.due ? dateNum(n.due) : "—", icon: "clock", color: "#e0902a" })}${kpi({ label: "الحالة", value: n.status === "ACTIVE" ? "قائم" : "مسدد", icon: "checkc" })}</div>
  <div class="grid g2" style="margin-top:14px"><div class="card card-b"><b>بيانات الفهرسة</b><div class="col small" style="gap:6px;margin-top:10px"><div class="row between"><span class="muted">الرقم</span><b class="num">${esc(n.no)}</b></div><div class="row between"><span class="muted">العميل</span><b>${esc(c.name)}</b></div><div class="row between"><span class="muted">المشروع</span><b>${n.projectId ? esc(projName(n.projectId)) : "—"}</b></div><div class="row between"><span class="muted">سجّله</span><b>${esc(userName(n.by))}</b></div><div class="row between"><span class="muted">ملاحظات</span><b>${esc(n.notes || "—")}</b></div></div><div class="alert info" style="margin-top:10px">${ic("info")}<div>وجود السند لأمر لا يغيّر رصيد الصندوق ولا يُحسب قبضًا. أي سداد مرتبط به يُسجّل بسند قبض على الفاتورة.</div></div></div>
  <div class="card card-b"><b>النسخة المرفقة</b>${n.attachment ? `<div class="print-wrap" style="margin-top:10px;padding:12px"><div style="background:#fff;border:2px dashed #94a3b8;border-radius:10px;padding:28px;text-align:center;color:#475569">${ic("doc").replace("<svg", '<svg style="width:40px;height:40px"')}<div>صورة السند لأمر ${esc(n.no)}.pdf</div><div class="xs">يُعرض بعد التحقق من صلاحية المستخدم</div></div></div>` : `<div class="alert warn" style="margin-top:10px">${ic("alert")}<div>لا يوجد مرفق لهذا السند.</div></div>`}</div></div>`;
});

route("/print/statement/:id", [], ({ id }, query) => {
  const c = byId(S.customers, id);
  if (!canSeeCustomer(ME, c)) throw new DomainError("خارج نطاق صلاحيتك");
  const pid = query.project || null;
  const rows = statementRows(id, pid).reverse();
  // أعمدة الأصناف كما في الكرت الورقي: العائلات التي تعامل بها العميل
  const famOf = (pidd) => byId(S.products, pidd).family;
  const famSet = new Set();
  const famQty = {};
  for (const d of S.deliveries.filter((d) => d.customerId === id && d.kind === "RENTAL" && (!pid || d.projectId === pid))) for (const l of d.lines) famSet.add(famOf(l.pid));
  const fams = [...famSet].slice(0, 6);
  const rowFam = (r) => {
    const out = {};
    if (r.link.startsWith("/print/dn/")) for (const l of byId(S.deliveries, r.link.split("/").pop()).lines) out[famOf(l.pid)] = (out[famOf(l.pid)] || 0) + l.count;
    if (r.link.startsWith("/print/rn/")) for (const l of byId(S.returns, r.link.split("/").pop()).lines) out[famOf(l.pid)] = (out[famOf(l.pid)] || 0) - l.qty;
    for (const k in out) famQty[k] = (famQty[k] || 0) + out[k];
    return out;
  };
  return printWrap(
    `<div class="print-sheet land">${sheetHead(c.fileNo ? "ملف " + c.fileNo : c.code, "كرت حساب العميل — معدات ومبالغ")}
    <div class="ps-fields"><div>رقم الملف: <b class="num">${esc(c.fileNo || c.code)}</b></div><div>اسم المندوب: <b>${esc(byId(S.reps, c.repId)?.name || "—")}</b></div><div>اسم العميل: <b>${esc(c.name)}</b></div><div>تليفون: <b class="num">${c.mobile}</b></div><div>الكفيل الغارم: <b>${esc(c.guarantor || "—")}</b>${c.guarantorId ? ` · <span class="num">${c.guarantorId}</span>` : ""}</div><div>المشروع: <b>${pid ? esc(projName(pid)) : "كل المشاريع"}</b></div></div>
    <table class="ps-table"><thead><tr>${fams.map((f) => `<th>${esc(f)}</th>`).join("")}<th style="width:28%">البيــان</th><th>التاريخ</th><th>رقم السند</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody>${rows
      .map((r) => {
        const fq = rowFam(r);
        return `<tr>${fams.map((f) => `<td class="num">${fq[f] ? (fq[f] > 0 ? "+" : "") + fq[f] : ""}</td>`).join("")}<td style="text-align:right">${esc(r.desc)} <span style="color:#64748b">— ${esc(projName(r.projectId))}</span></td><td class="num">${fmtDate(r.at)}</td><td class="num">${r.no}</td><td class="num">${r.debit ? nf2.format(r.debit / 100) : ""}</td><td class="num">${r.credit ? nf2.format(r.credit / 100) : ""}</td><td class="num"><b>${nf2.format(r.balance / 100)}</b></td></tr>`;
      })
      .join("")}</tbody><tfoot><tr>${fams.map((f) => `<th class="num">${famQty[f] || 0}</th>`).join("")}<th colspan="3">الرصيد: المعدات بالعهدة (أعلاه) / المبلغ المستحق ←</th><th colspan="3" class="num">${nf2.format(customerSummary(id, pid).balance / 100)} ر.س</th></tr></tfoot></table>${tplStamp(Date.now())}${sheetFoot()}</div>`,
    "#/customers/" + id + (pid ? "?project=" + pid : ""),
    "كرت العميل المزدوج: أعمدة كميات الأصناف (كما في الكرت الورقي) بجانب المدين والدائن والرصيد",
  );
});

route("/print/daily/:d", ["daily"], ({ d }) => {
  const html = ROUTES.find((r) => r.re.test("/daily")).fn({}, { d });
  return `<div class="content">${pageHead("طباعة اليومية", "", `${pdfBtn()}<button class="btn primary" onclick="window.print()">${ic("print")}طباعة</button><a class="btn" href="#/daily?d=${d}">رجوع</a>`)}<div class="print-wrap"><div class="print-sheet land" style="color:var(--text)">${sheetHead(d, "الحركة اليومية للصندوق — فرع المدينة")}<style>.print-sheet .page-head{display:none}</style>${html}</div></div></div>`;
});

/* ═══════════ العملاء: القائمة، البروفايل (لوحة العميل ومشاريعه)، النماذج ═══════════ */
"use strict";

route("/customers", [], () => {
  const u = ME;
  const rows = S.customers.filter((c) => canSeeCustomer(u, c)).sort((a, b) => (isFav(b.id) ? 1 : 0) - (isFav(a.id) ? 1 : 0));
  return `${pageHead(u.role === "SELLER" ? "عملائي" : "العملاء", `${rows.length} عميل — ابحث بأي من المفاتيح الخمسة: الهوية، الإقامة، السجل التجاري، العلامة التجارية، الجوال`, can(u, "customers.create") || u.role === "OWNER" ? `<button class="btn primary" data-act="quick" data-h="@customer">${ic("plus")}عميل جديد</button>` : "")}
  ${table(
    "customers",
    [
      { key: "fav", label: "★", search: false, value: (c) => (isFav(c.id) ? 1 : 0), text: (c) => (isFav(c.id) ? "مفضل" : ""), render: (c) => `<button class="star sm ${isFav(c.id) ? "on" : ""}" data-act="fav" data-c="${c.id}" title="المفضلة" aria-pressed="${isFav(c.id)}">${ic("star")}</button>` },
      { key: "code", label: "الكود", text: (c) => c.code, render: (c) => `<span class="num">${c.code}</span>` },
      { key: "name", label: "العميل", text: (c) => c.name + " " + (c.tradeName || ""), render: (c) => `<a class="link" href="#/customers/${c.id}">${esc(c.name)}</a>${blacklistState(c.id) ? ' <span class="badge b-red">قائمة سوداء</span>' : ""}` },
      { key: "type", label: "النوع", text: (c) => (c.type === "COMPANY" ? "منشأة" : "فرد") },
      { key: "mobile", label: "الجوال", text: (c) => c.mobile, render: (c) => `<span class="num">${c.mobile}</span>` },
      { key: "id", label: "رقم التعريف", text: (c) => c.cr || c.nationalId || c.iqama || "", render: (c) => `<span class="xs muted">${c.cr ? "سجل" : c.nationalId ? "هوية" : "إقامة"}</span> <span class="num">${c.cr || c.nationalId || c.iqama}</span>` },
      { key: "proj", label: "المشاريع", value: (c) => S.projects.filter((p) => p.customerId === c.id).length, render: (c) => int(S.projects.filter((p) => p.customerId === c.id).length) },
      { key: "site", label: "قطع بالمواقع", value: (c) => customerSummary(c.id).onSite, render: (c) => int(customerSummary(c.id).onSite) },
      { key: "bal", label: "الذمة", value: (c) => customerSummary(c.id).balance, render: (c) => { const b = customerSummary(c.id).balance; return b > 0 ? `<b>${sar(b)}</b>` : '<span class="faint">0.00</span>'; } },
      { key: "od", label: "متأخرة", value: (c) => customerSummary(c.id).overdue.length, render: (c) => { const n = customerSummary(c.id).overdue.length; return n ? `<span class="badge b-red">${n}</span>` : "—"; } },
      { key: "rep", label: "المندوب", text: (c) => byId(S.reps, c.repId)?.name || "—" },
      { key: "file", label: "رقم الملف", text: (c) => c.fileNo || "" },
    ],
    rows,
    {
      sort: "bal",
      pinFirst: (c) => isFav(c.id),
      rowLink: (c) => "/customers/" + c.id,
      hidden: ["file"],
      filters: [
        { key: "fav", label: "المفضلة", options: [["1", "المفضلون فقط"]], match: (c) => isFav(c.id) },
        { key: "type", label: "النوع", options: [["COMPANY", "منشأة"], ["INDIVIDUAL", "فرد"]], match: (c, v) => c.type === v },
        { key: "rep", label: "المندوب", options: S.reps.map((r) => [r.id, r.name]), match: (c, v) => c.repId === v },
        { key: "debt", label: "المديونية", options: [["debt", "عليه ذمة"], ["od", "متأخر"], ["site", "لديه معدات"]], match: (c, v) => (v === "debt" ? customerSummary(c.id).balance > 0 : v === "od" ? customerSummary(c.id).overdue.length > 0 : customerSummary(c.id).onSite > 0) },
      ],
    },
  )}`;
});

/* ─── بروفايل العميل ─── */
route("/customers/:id", [], ({ id }, query) => {
  const u = ME;
  const c = byId(S.customers, id);
  if (!c) return emptyBox("العميل غير موجود");
  if (!canSeeCustomer(u, c)) throw new DomainError("هذا العميل مسجل لدى بائع آخر — لا تملك صلاحية عرض ملفه الكامل");
  const projects = S.projects.filter((p) => p.customerId === c.id);
  const pid = query.project && projects.some((p) => p.id === query.project) ? query.project : null;
  const cs = customerSummary(c.id, pid);
  const all = customerSummary(c.id);
  const bl = blacklistState(c.id);
  const ratings = S.ratings.filter((r) => r.customerId === c.id).sort((a, b) => b.at - a.at);
  const blEvents = S.blacklist.filter((b) => b.customerId === c.id).sort((a, b) => b.at - a.at);
  const tab = UI.tab[c.id] || "overview";
  const docs = customerDocuments(c.id, pid);
  const custody = custodyRows(c.id, pid);
  const notes = S.promissory.filter((n) => n.customerId === c.id && (!pid || n.projectId === pid));
  const proj = pid ? byId(S.projects, pid) : null;
  const qs = pid ? `&project=${pid}` : "";
  const sellerScope = u.role === "SELLER";
  const idRow = (label, v) => (v ? `<div class="row between small"><span class="muted">${label}</span><span class="row" style="gap:4px"><b class="num">${v}</b><button class="btn sm ghost icon-only" data-act="copy" data-v="${v}" title="نسخ">${ic("copy")}</button></span></div>` : "");

  const projCards = projects
    .map((p) => {
      const s = customerSummary(c.id, p.id);
      return `<div class="card proj ${pid === p.id ? "sel" : ""}" data-go="/customers/${c.id}?project=${p.id}"><div class="row between"><b>${esc(p.name)}</b><span class="row" style="gap:2px"><button class="btn sm ghost icon-only" data-act="pinNote" data-kind="project" data-id="${p.id}" title="ملاحظة مثبتة على المشروع">${ic("pin")}</button><span class="xs faint num">${p.code}</span></span></div>${p.pinnedNote ? `<div class="xs proj-note">${ic("pin")} ${esc(p.pinnedNote.text)}</div>` : ""}<div class="xs muted">${ic("map").replace("<svg", '<svg style="width:12px;height:12px;vertical-align:-2px"')} ${esc(p.location || "—")}</div>
      <div class="mini-stats"><div><b class="num">${nf0.format(s.onSite)}</b><span>قطعة بالموقع</span></div><div><b class="num">${nf2.format(s.balance / 100)}</b><span>ذمة (ر.س)</span></div><div><b class="num">${nf2.format(s.accrued / 100)}</b><span>إيجار مستحق حتى اليوم</span></div><div><b class="num">${s.activeRentals.length}</b><span>عقود نشطة</span></div></div></div>`;
    })
    .join("");

  const tabs = [
    ["overview", "نظرة عامة"],
    ["custody", "رصيد الكميات", custody.length],
    ["sales", "المبيعات", S.sales.filter((s) => s.customerId === c.id && (!pid || s.projectId === pid)).length],
    ["rentals", "الإيجارات", S.rentals.filter((r) => r.customerId === c.id && (!pid || r.projectId === pid)).length],
    ["invoices", "الفواتير", S.invoices.filter((i) => i.customerId === c.id && (!pid || i.projectId === pid)).length],
    ["payments", "الدفعات", S.payments.filter((p) => p.customerId === c.id && (!pid || p.projectId === pid)).length],
    ["docs", "جميع السندات", docs.length],
    ["files", "الوثائق والمرفقات", S.documents.filter((d) => d.customerId === c.id).length],
    ["activity", "النشاط والتقييم"],
  ];
  let body = "";
  if (tab === "overview") {
    body = `<div class="grid g3">
      <div class="card span2"><div class="card-h"><h3>كشف الحساب المزدوج — ${proj ? "مشروع " + esc(proj.name) : "كل المشاريع"}</h3><a class="btn sm" href="#/print/statement/${c.id}${pid ? "?project=" + pid : ""}">${ic("print")}طباعة الكرت</a></div><div class="tbl-wrap" style="max-height:380px"><table class="tbl"><thead><tr><th>التاريخ</th><th>البيان</th><th>رقم السند</th><th>المشروع</th><th>قطع (+ تسليم / − رد)</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead><tbody>${statementRows(c.id, pid)
        .map((r) => `<tr class="click" data-go="${r.link}"><td>${dateNum(r.at)}</td><td>${esc(r.desc)}</td><td class="num link">${r.no}</td><td class="small">${esc(projName(r.projectId))}</td><td class="num">${r.pieces ? (r.pieces > 0 ? "+" : "") + r.pieces : ""}</td><td>${r.debit ? money(r.debit) : ""}</td><td>${r.credit ? money(r.credit) : ""}</td><td><b>${money(r.balance)}</b></td></tr>`)
        .join("")}</tbody></table></div></div>
      <div class="col" style="gap:14px">
        ${notes.length ? notes.map((n) => `<div class="card card-b" style="cursor:pointer;border-color:#c7d2fe;background:linear-gradient(135deg,#fff,#f5f7ff)" data-act="openPN" data-n="${n.id}"><div class="row between"><span class="chip">${ic("doc")}سند لأمر <span class="num">${n.no}</span></span>${badge(n.status === "ACTIVE" ? "ACTIVE" : "SETTLED", n.status === "ACTIVE" ? "قائم" : "مسدد")}</div><div class="big-num" style="margin-top:8px">${sar(n.amount)}</div><div class="row between small" style="margin-top:4px"><span class="muted">تاريخ السند <b class="num">${fmtDate(n.at)}</b></span>${n.due ? `<span style="color:var(--amber)">يستحق <b class="num">${fmtDate(n.due)}</b></span>` : '<span class="faint">بدون تاريخ استحقاق</span>'}</div><div class="xs faint" style="margin-top:4px">${n.projectId ? "مشروع " + esc(projName(n.projectId)) + " · " : ""}لا يغيّر رصيد الصندوق ولا يُحسب قبضًا</div></div>`).join("") : ""}
        <div class="card"><div class="card-h"><h3>آخر السندات</h3><button class="btn sm ghost" data-act="custTab" data-c="${c.id}" data-t="docs">الكل</button></div><div class="card-b">${docs.slice(0, 6).map((d) => `<a class="row between" style="padding:5px 0" href="${docLink(d)}"><span class="small">${d.type} <span class="num link">${d.no}</span></span><span class="xs muted">${dateNum(d.at)}</span></a>`).join("") || emptyBox("لا سندات")}</div></div>
      </div></div>`;
  } else if (tab === "custody") {
    const rows = custody;
    const sold = S.sales.filter((s) => s.customerId === c.id && (!pid || s.projectId === pid) && s.status === "CONFIRMED").flatMap((s) => s.lines.map((l) => ({ ...l, projectId: s.projectId, at: s.at, saleId: s.id })));
    body = `<div class="alert info" style="margin-bottom:12px">${ic("info")}<div>الكميات المؤجرة (عهدة يجب أن تعود) منفصلة عن الكميات المباعة (ملك العميل). المتبقي بالعهدة = المسلّم − المرتجع، ويُحسب من سندات التسليم وكشوف الدخول مباشرة. اضغط على الصنف لفتح حركاته.</div></div>
    <div class="card"><div class="card-h"><h3>المعدات المؤجرة — بالمشروع والصنف</h3><span class="chip">قطع</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>المشروع</th><th>الصنف</th><th>المسلّم</th><th>المسترجع سليم</th><th>صيانة</th><th>تالف</th><th>مفقود</th><th>المتبقي بالعهدة</th><th>قرار التسوية</th></tr></thead><tbody>${rows
      .sort((a, b) => b.onSite - a.onSite)
      .map((r) => `<tr class="click" data-go="/inventory/${r.pid}?customer=${c.id}&project=${r.projectId}"><td>${esc(projName(r.projectId))}</td><td class="bold">${esc(prodName(r.pid))}</td><td>${int(r.delivered)}</td><td>${int(r.good)}</td><td>${r.maint ? int(r.maint) : "—"}</td><td>${r.damaged ? `<span style="color:var(--red)">${int(r.damaged)}</span>` : "—"}</td><td>${r.lost ? `<span style="color:var(--red)">${int(r.lost)}</span>` : "—"}</td><td><b style="font-size:15px">${int(r.onSite)}</b></td><td class="small">${r.damaged || r.lost ? '<span class="badge b-amber">بانتظار قرار المالك</span>' : r.maint ? '<span class="badge b-gray">رسوم صيانة مفوترة</span>' : "—"}</td></tr>`)
      .join("") || `<tr><td colspan="9">${emptyBox("لا توجد معدات مؤجرة")}</td></tr>`}</tbody><tfoot><tr><td colspan="2">الإجمالي ${pid ? "" : "(مجموع المشاريع)"}</td><td>${int(rows.reduce((a, r) => a + r.delivered, 0))}</td><td>${int(rows.reduce((a, r) => a + r.good, 0))}</td><td>${int(rows.reduce((a, r) => a + r.maint, 0))}</td><td>${int(rows.reduce((a, r) => a + r.damaged, 0))}</td><td>${int(rows.reduce((a, r) => a + r.lost, 0))}</td><td>${int(rows.reduce((a, r) => a + r.onSite, 0))}</td><td></td></tr></tfoot></table></div></div>
    <div class="card" style="margin-top:14px"><div class="card-h"><h3>الكميات المباعة (ليست عهدة)</h3></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>التاريخ</th><th>المشروع</th><th>الصنف</th><th>العدد</th><th>الكمية (م)</th><th>البيع</th></tr></thead><tbody>${sold.map((l) => `<tr class="click" data-go="/sales/${l.saleId}"><td>${dateNum(l.at)}</td><td>${esc(projName(l.projectId))}</td><td>${esc(l.name)}</td><td>${int(l.count)}</td><td>${l.len ? nf2.format(l.len * l.count) : "—"}</td><td class="num link">${byId(S.sales, l.saleId).no}</td></tr>`).join("") || `<tr><td colspan="6">${emptyBox("لا مبيعات")}</td></tr>`}</tbody></table></div></div>`;
  } else if (tab === "sales") {
    body = table("c-sales-" + c.id, [
      { key: "no", label: "رقم البيع", text: (s) => s.no, render: (s) => `<a class="link num" href="#/sales/${s.id}">${s.no}</a>` },
      { key: "at", label: "التاريخ", value: (s) => s.at, render: (s) => dateNum(s.at) },
      { key: "p", label: "المشروع", text: (s) => projName(s.projectId) },
      { key: "t", label: "الإجمالي", value: (s) => s.total, render: (s) => sar(s.total) },
      { key: "st", label: "الحالة", text: (s) => s.status, render: saleBadge },
    ], S.sales.filter((s) => s.customerId === c.id && (!pid || s.projectId === pid)), { sort: "at", rowLink: (s) => "/sales/" + s.id });
  } else if (tab === "rentals") {
    body = table("c-rent-" + c.id, [
      { key: "no", label: "رقم العقد", text: (r) => r.no, render: (r) => `<a class="link num" href="#/rentals/${r.id}">${r.no}</a>` },
      { key: "at", label: "التاريخ", value: (r) => r.at, render: (r) => dateNum(r.at) },
      { key: "p", label: "المشروع", text: (r) => projName(r.projectId) },
      { key: "site", label: "بالموقع", value: (r) => r.lines.reduce((a, l) => a + l.delivered - l.returned, 0), render: (r) => int(r.lines.reduce((a, l) => a + l.delivered - l.returned, 0)) },
      { key: "acc", label: "المستحق حتى اليوم", value: rentalAccruedToDate, render: (r) => sar(rentalAccruedToDate(r)) },
      { key: "inv", label: "المفوتر", value: rentalInvoiced, render: (r) => sar(rentalInvoiced(r)) },
      { key: "st", label: "الحالة", text: (r) => rentalStatusCalc(r), render: rentalBadge },
    ], S.rentals.filter((r) => r.customerId === c.id && (!pid || r.projectId === pid)), { sort: "at", rowLink: (r) => "/rentals/" + r.id });
  } else if (tab === "invoices") {
    body = invoicesTable("c-inv-" + c.id, S.invoices.filter((i) => i.customerId === c.id && (!pid || i.projectId === pid)));
  } else if (tab === "payments") {
    body = paymentsTable("c-pay-" + c.id, S.payments.filter((p) => p.customerId === c.id && (!pid || p.projectId === pid)));
  } else if (tab === "docs") {
    body = table("c-docs-" + c.id, [
      { key: "type", label: "النوع", text: (d) => d.type, render: (d) => `<span class="chip">${esc(d.type)}</span>` },
      { key: "no", label: "الرقم", text: (d) => d.no, render: (d) => `<a class="link num" href="${docLink(d)}">${d.no}</a>` },
      { key: "at", label: "التاريخ", value: (d) => d.at, render: (d) => dateNum(d.at) },
      { key: "amt", label: "المبلغ / الكمية", value: (d) => d.amount ?? d.qty, render: (d) => (d.amount !== undefined ? sar(d.amount) : `${int(d.qty)} قطعة`) },
      { key: "p", label: "المشروع", text: (d) => projName(d.projectId) },
      { key: "rep", label: "المندوب", text: (d) => d.rep || "" },
      { key: "st", label: "الحالة", text: (d) => d.status, render: (d) => badge(d.status) },
      { key: "pr", label: "", search: false, text: () => "", render: (d) => (printKind(d) ? `<a class="btn sm" href="#/print/${printKind(d)}/${d.id}">${ic("print")}طباعة</a>` : "") },
    ], docs, { sort: "at", rowLink: docLink, filters: [{ key: "type", label: "النوع", options: [...new Set(docs.map((d) => d.type))].map((t) => [t, t]), match: (d, v) => d.type === v }] });
  } else if (tab === "files") {
    const files = S.documents.filter((d) => d.customerId === c.id);
    body = `<div class="card"><div class="card-h"><h3>الوثائق والمرفقات</h3><button class="btn sm" data-act="addFile" data-c="${c.id}">${ic("clip")}إرفاق ملف</button></div><div class="card-b">${files.map((f) => `<div class="row between" style="padding:8px 0;border-bottom:1px dashed var(--border)"><span class="row">${ic("doc").replace("<svg", '<svg style="width:20px;height:20px;color:var(--brand)"')}<span class="col" style="gap:0"><b class="small">${esc(f.title)}</b><span class="xs muted">${esc(f.fileName)} · ${(f.size / 1024).toFixed(0)} KB · ${f.projectId ? "مشروع " + esc(projName(f.projectId)) : "عام"} · رفعه ${esc(userName(f.by))}</span></span></span><button class="btn sm" data-act="viewFile">${ic("eye")}عرض</button></div>`).join("") || emptyBox("لا مرفقات", "clip")}</div></div>`;
  } else if (tab === "activity") {
    const fus = S.followups.filter((f) => f.customerId === c.id).sort((a, b) => b.at - a.at);
    const auditEv = S.audit.filter((a) => a.entityId === c.id || docs.some((d) => d.id === a.entityId)).sort((a, b) => b.at - a.at).slice(0, 30);
    body = `<div class="grid g3"><div class="card"><div class="card-h"><h3>سجل التقييمات</h3>${can(u, "rate") ? `<button class="btn sm" data-act="rate" data-c="${c.id}">${ic("star")}تقييم</button>` : ""}</div><div class="card-b timeline">${ratings.map((r) => `<div class="tl ${r.rating <= 2 ? "red" : r.rating >= 4 ? "green" : "amber"}"><b>${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</b> <span class="xs muted num">${fmtDate(r.at)}</span><div class="small">${esc(r.reason)}</div><div class="xs faint">المقيّم: ${esc(userName(r.by))}</div></div>`).join("") || emptyBox("لا تقييمات", "star")}</div></div>
    <div class="card"><div class="card-h"><h3>القائمة السوداء — السجل الكامل</h3>${u.role === "OWNER" ? `<button class="btn sm ${bl ? "" : "danger"}" data-act="blacklist" data-c="${c.id}">${bl ? "رفع الحظر" : "حظر"}</button>` : ""}</div><div class="card-b timeline">${blEvents.map((b) => `<div class="tl ${b.action === "BLACKLIST" ? "red" : "green"}"><b>${b.action === "BLACKLIST" ? "إضافة للقائمة السوداء" : "رفع الحظر"}</b> <span class="xs muted num">${fmtDate(b.at)}</span><div class="small">${esc(b.reason)}</div><div class="xs faint">النطاق: ${b.scope === "CREDIT" ? "الآجل فقط" : "كل العمليات الجديدة"} · القرار: ${esc(userName(b.by))}</div></div>`).join("") || emptyBox("لم يُدرج في القائمة السوداء", "shield")}</div></div>
    <div class="card"><div class="card-h"><h3>المتابعات</h3>${can(u, "followups") ? `<button class="btn sm" data-act="followup" data-c="${c.id}">${ic("phone")}تسجيل متابعة</button>` : ""}</div><div class="card-b timeline">${fus.map((f) => `<div class="tl"><b class="small">${esc(f.outcome)}</b> <span class="xs muted num">${fmtDate(f.at)}</span><div class="xs faint">المندوب: ${esc(byId(S.reps, f.repId)?.name || "—")} · سجّلها ${esc(userName(f.userId))}${f.next ? ` · الموعد القادم <span class="num">${fmtDate(f.next)}</span>` : ""}</div></div>`).join("") || emptyBox("لا متابعات", "phone")}</div></div>
    <div class="card span3"><div class="card-h"><h3>تسلسل النشاط</h3></div><div class="card-b timeline">${auditEv.map((a) => `<div class="tl"><b class="small">${esc(a.action)}</b> <span class="xs muted">${esc(userName(a.userId))} · <span class="num">${fmtDT(a.at)}</span></span>${a.after ? `<span class="xs faint num" style="direction:ltr"> ${esc(JSON.stringify(a.after))}</span>` : ""}</div>`).join("")}</div></div></div>`;
  }

  return `${pageHead(`<button class="star ${isFav(c.id) ? "on" : ""}" data-act="fav" data-c="${c.id}" title="${isFav(c.id) ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}" aria-pressed="${isFav(c.id)}">${ic("star")}</button>${esc(c.name)}`, `${c.code}${c.fileNo ? " · ملف " + c.fileNo : ""} · ${c.type === "COMPANY" ? "منشأة" : "فرد"} · ${esc(c.city)}`, `${can(u, "sales.create") ? `<a class="btn primary" href="#/sales/new?customer=${c.id}${qs}">${ic("cart")}بيع</a>` : ""}${can(u, "rentals.create") ? `<a class="btn primary" href="#/rentals/new?customer=${c.id}${qs}">${ic("key")}إيجار</a>` : ""}${can(u, "payments.create") && all.balance > 0 ? `<button class="btn" data-act="payCustomer" data-c="${c.id}" data-p="${pid || ""}">${ic("cash")}تحصيل</button>` : ""}${can(u, "promissory") ? `<button class="btn" data-act="addPN" data-c="${c.id}" data-p="${pid || ""}">${ic("doc")}سند لأمر</button>` : ""}<a class="btn" href="#/print/rentbill/${c.id}${pid ? "?project=" + pid : ""}">${ic("file")}فاتورة إيجارات الفترة</a><a class="btn" href="#/print/acct/${c.id}${pid ? "?project=" + pid : ""}">${ic("receipt")}كشف حساب</a><a class="btn" href="#/print/statement/${c.id}${pid ? "?project=" + pid : ""}">${ic("print")}كرت العميل</a>${all.balance > 0 && can(u, "payments.create") ? waButton(c.mobile, msgStatement(c, all.balance), "واتساب الرصيد") : ""}<button class="btn" data-act="pinNote" data-kind="customer" data-id="${c.id}">${ic("pin")}ملاحظة مثبتة</button>`, `<a href="#/customers">العملاء</a> / ${esc(c.name)}`)}
  ${c.pinnedNote ? `<div class="alert warn pinned" style="margin-bottom:14px">${ic("pin")}<div class="grow"><b>${esc(c.pinnedNote.text)}</b><div class="xs">ملاحظة مثبتة — ${esc(userName(c.pinnedNote.by))} · ${fmtDate(c.pinnedNote.at)}</div></div><button class="btn sm ghost" data-act="pinNote" data-kind="customer" data-id="${c.id}">تعديل</button></div>` : ""}${proj && proj.pinnedNote ? `<div class="alert info pinned" style="margin-bottom:14px">${ic("pin")}<div class="grow"><b>مشروع ${esc(proj.name)}: ${esc(proj.pinnedNote.text)}</b><div class="xs">${esc(userName(proj.pinnedNote.by))} · ${fmtDate(proj.pinnedNote.at)}</div></div><button class="btn sm ghost" data-act="pinNote" data-kind="project" data-id="${proj.id}">تعديل</button></div>` : ""}${bl ? `<div class="alert danger" style="margin-bottom:14px">${ic("ban")}<div><b>في القائمة السوداء (${bl.scope === "CREDIT" ? "الآجل فقط" : "كل العمليات الجديدة"})</b> — ${esc(bl.reason)} · قرار ${esc(userName(bl.by))} في ${fmtDate(bl.at)}. تسوية المستحقات ورد المعدات تبقى ممكنة.</div></div>` : ""}
  <div class="grid cust-top">
    <div class="card card-b col" style="gap:8px">
      <div class="row"><div class="avatar" style="width:44px;height:44px;font-size:20px">${esc(c.name[0])}</div><div class="col" style="gap:0"><b>${esc(c.name)}</b>${c.tradeName ? `<span class="small muted">العلامة التجارية: ${esc(c.tradeName)}</span>` : ""}</div></div>
      <div class="row between small"><span class="muted">الجوال</span><span class="row" style="gap:4px"><b class="num">${c.mobile}</b><button class="btn sm ghost icon-only" data-act="copy" data-v="${c.mobile}" title="نسخ">${ic("copy")}</button></span></div>
      ${idRow("الهوية الوطنية", c.nationalId)}${idRow("الإقامة", c.iqama)}${idRow("السجل التجاري", c.cr)}${idRow("الرقم الضريبي", c.vat)}
      <div style="border-top:1px dashed var(--border);padding-top:8px;margin-top:2px"><div class="row between small"><b>الكفيل الغارم</b>${can(u, "customers.create") || canAny(u, "customers.viewAll") ? `<button class="btn sm ghost" data-act="editGuarantor" data-c="${c.id}">${ic(c.guarantor ? "edit" : "plus")}${c.guarantor ? "تعديل" : "إضافة"}</button>` : ""}</div>${c.guarantor ? `<div class="row between small"><span class="muted">الاسم</span><b>${esc(c.guarantor)}</b></div>${c.guarantorId ? `<div class="row between small"><span class="muted">الهوية / الإقامة</span><b class="num">${c.guarantorId}</b></div>` : ""}${c.guarantorMobile ? `<div class="row between small"><span class="muted">الجوال</span><b class="num">${c.guarantorMobile}</b></div>` : ""}` : '<div class="xs faint">لا يوجد كفيل — اختياري</div>'}</div>
      <div class="row between small"><span class="muted">المندوب</span><b>${esc(byId(S.reps, c.repId)?.name || "—")}</b></div>
      <div class="row between small"><span class="muted">التقييم</span><b style="color:var(--amber)">${ratings[0] ? "★".repeat(ratings[0].rating) + "☆".repeat(5 - ratings[0].rating) : "—"}</b></div>
      <div class="row between small"><span class="muted">الحالة الائتمانية</span>${bl ? badge("OVERDUE", "محظور") : all.overdue.length ? badge("PARTIAL", "متأخر بالسداد") : badge("PAID", "جيدة")}</div>
      <div class="row between small"><span class="muted">آخر عملية</span><b class="num">${all.lastOp ? fmtDate(all.lastOp.at) : "—"}</b></div>
      ${sellerScope ? "" : `<div class="xs faint">أنشأه ${esc(userName(c.createdBy))} في ${fmtDate(c.at)}</div>`}
    </div>
    <div class="col" style="gap:14px">
      <div class="split-box">
        <div class="card card-b" style="border-top:3px solid var(--c1)"><div class="row between"><b>المعدات لدى العميل ${proj ? "— " + esc(proj.name) : "— كل المشاريع"}</b><button class="btn sm ghost" data-act="custTab" data-c="${c.id}" data-t="custody">التفاصيل ←</button></div>
          <div class="row" style="gap:24px;margin-top:8px;flex-wrap:wrap"><div><div class="big-num num" style="color:var(--brand)">${nf0.format(cs.onSite)}</div><div class="small muted">قطعة بالعهدة الآن</div></div><div class="col small" style="gap:2px"><span>مسلّم <b class="num">${nf0.format(cs.delivered)}</b></span><span>مرتجع <b class="num">${nf0.format(cs.returned)}</b></span><span>تالف/مفقود <b class="num">${cs.damaged}/${cs.lost}</b></span><span>مباع (ملك العميل) <b class="num">${nf0.format(cs.soldPieces)}</b></span></div></div></div>
        <div class="card card-b" style="border-top:3px solid var(--c5)"><div class="row between"><b>المبالغ ${proj ? "— " + esc(proj.name) : "— كل المشاريع"}</b><button class="btn sm ghost" data-act="custTab" data-c="${c.id}" data-t="invoices">الفواتير ←</button></div>
          <div class="row" style="gap:24px;margin-top:8px;flex-wrap:wrap"><div><div class="big-num num" style="color:var(--red)">${nf2.format(cs.balance / 100)}</div><div class="small muted">ر.س متبقي على الفواتير</div></div><div class="col small" style="gap:2px"><span>إجمالي المفوتر <b class="num">${nf2.format(cs.invoiced / 100)}</b></span><span>المدفوع <b class="num">${nf2.format(cs.allocatedPaid / 100)}</b></span><span>متأخر <b class="num" style="color:var(--red)">${nf2.format(cs.overdueAmount / 100)}</b> (${cs.overdue.length} فاتورة)</span><span>إيجار مستحق لم يُفوتر <b class="num">${nf2.format(cs.unbilledWithVat / 100)}</b></span></div></div></div>
      </div>
      <div class="grid g4">
        ${kpi({ label: "إجمالي المبيعات", value: sar(cs.salesTotal), icon: "cart", sub: `${cs.salesCount} عملية` })}
        ${kpi({ label: "إجمالي الإيجارات المفوترة", value: sar(cs.rentalInvoiced), icon: "key", sub: `${cs.rentalsCount} عقد` })}
        ${kpi({ label: "الإيجار المستحق حتى اليوم", value: sar(cs.accrued), icon: "clock", sub: "قبل الضريبة · قطعة × يوم" })}
        ${kpi({ label: "المدفوع", value: sar(cs.allocatedPaid), icon: "cash", color: "#047857" })}
      </div>
    </div>
  </div>
  <div class="section-title">المشاريع (${projects.length}) — اختر مشروعًا لعرض عملياته وعهدته ومديونيته وحده${pid ? ` · <a class="link" href="#/customers/${c.id}">عرض إجمالي العميل</a>` : ""}<button class="btn sm" data-act="newProject" data-c="${c.id}">${ic("plus")}مشروع</button></div>
  <div class="grid g4">${projCards}</div>
  <div class="tabs" style="margin-top:18px">${tabs.map(([k, l, n]) => `<button class="${tab === k ? "on" : ""}" data-act="custTab" data-c="${c.id}" data-t="${k}">${l}${n !== undefined ? `<span class="cnt">${n}</span>` : ""}</button>`).join("")}</div>
  ${body}`;
});
ACTIONS.custTab = (el) => ((UI.tab[el.dataset.c] = el.dataset.t), render());

function docLink(d) {
  return { sale: "#/sales/", rental: "#/rentals/", invoice: "#/invoices/", payment: "#/payments/", dn: "#/print/dn/", rn: "#/print/rn/", promissory: "#/print/pn/" }[d.kind] + d.id;
}
const printKind = (d) => ({ invoice: "invoice", payment: "rv", dn: "dn", rn: "rn", promissory: "pn" })[d.kind];

/** كشف حساب العميل: مدين (فواتير) ودائن (قبض) مع حركة القطع */
function statementRows(cid, pid) {
  const inP = (x) => x.customerId === cid && (!pid || x.projectId === pid);
  const rows = [];
  for (const i of S.invoices.filter((i) => inP(i) && i.status !== "CANCELLED")) rows.push({ at: i.at, desc: i.kind === "SALE" ? "فاتورة بيع" : i.kind === "FEES" ? "فاتورة صيانة/تعويض" : "فاتورة إيجار", no: i.no, projectId: i.projectId, debit: i.total, credit: 0, link: "/invoices/" + i.id });
  for (const p of S.payments.filter((p) => p.customerId === cid)) {
    const amt = p.allocations.filter((a) => !pid || byId(S.invoices, a.invoiceId).projectId === pid).reduce((a, x) => a + x.amount, 0);
    if (amt) rows.push({ at: p.at, desc: `سند قبض ${METHOD[p.method]}${p.repName ? " — المندوب " + p.repName : ""}`, no: p.no, projectId: p.projectId, debit: 0, credit: amt, link: "/payments/" + p.id });
  }
  for (const d of S.deliveries.filter((d) => inP(d) && d.kind === "RENTAL")) rows.push({ at: d.at, desc: "تسليم معدات (إيجار)", no: d.no, projectId: d.projectId, pieces: d.lines.reduce((a, l) => a + l.count, 0), debit: 0, credit: 0, link: "/print/dn/" + d.id });
  for (const r of S.returns.filter(inP)) rows.push({ at: r.at, desc: "كشف دخول (مرتجع)", no: r.no, projectId: r.projectId, pieces: -r.lines.reduce((a, l) => a + l.qty, 0), debit: 0, credit: 0, link: "/print/rn/" + r.id });
  rows.sort((a, b) => a.at - b.at);
  let b = 0;
  for (const r of rows) r.balance = b += r.debit - r.credit;
  return rows.reverse();
}

/* ─── نماذج العميل والمشروع ─── */
function openCustomerModal() {
  UI.cf = { type: "COMPANY", repId: ME.repId || "" };
  openModal("عميل جديد", customerForm, `<button class="btn primary" data-act="saveCustomer" data-label="حفظ العميل">${ic("check")}حفظ العميل</button><button class="btn" data-act="closeModal">إلغاء</button>`, "wide");
}
function customerForm() {
  const f = UI.cf;
  const fld = (k, label, ph = "", hint = "", attrs = "") => `<div class="field"><label>${label}</label><input class="input" id="cf-${k}" value="${esc(f[k] || "")}" placeholder="${ph}" data-act-input="cfSet" data-k="${k}" ${attrs}>${hint ? `<span class="hint">${hint}</span>` : ""}</div>`;
  return `<div class="field" style="margin-bottom:12px"><label>نوع العميل</label><div class="seg"><button class="${f.type === "COMPANY" ? "on" : ""}" data-act="cfType" data-k="COMPANY">منشأة / شركة</button><button class="${f.type === "INDIVIDUAL" ? "on" : ""}" data-act="cfType" data-k="INDIVIDUAL">فرد</button></div><span class="hint">تظهر فقط الحقول المنطبقة على النوع — لا تُملأ حقول غير منطبقة</span></div>
  <div class="form-grid">
    ${fld("name", f.type === "COMPANY" ? "اسم المنشأة *" : "الاسم الكامل *")}
    ${f.type === "COMPANY" ? fld("tradeName", "اسم العلامة التجارية") + fld("cr", "السجل التجاري *", "4650xxxxxx", "يُحفظ نصًا مع الأصفار البادئة", 'inputmode="numeric"') + fld("vat", "الرقم الضريبي", "3xxxxxxxxxxxxx3", "مطلوب لفاتورة ضريبية B2B", 'inputmode="numeric"') : fld("nationalId", "الهوية الوطنية", "1xxxxxxxxx", "للمواطن", 'inputmode="numeric"') + fld("iqama", "الإقامة", "2xxxxxxxxx", "للمقيم", 'inputmode="numeric"')}
    ${fld("mobile", "الجوال *", "05XXXXXXXX", "يقبل +966 والأرقام العربية", 'inputmode="tel"')}
    ${fld("city", "المدينة", "المدينة المنورة")}
    ${fld("fileNo", "رقم الملف (الكرت الورقي)")}
    <div class="field"><label>المندوب</label><select class="select" data-act-change="cfRep"><option value="">—</option>${S.reps.map((r) => `<option value="${r.id}" ${f.repId === r.id ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select></div>
    ${fld("projectName", "المشروع الأول", "مثال: فيلا حي العزيزية")}
    ${fld("projectLocation", "موقع المشروع")}
  </div>
  <div class="section-title">الكفيل الغارم <span class="faint xs">(اختياري)</span></div>
  <div class="form-grid">${fld("guarantor", "اسم الكفيل الغارم")}${fld("guarantorId", "رقم الهوية / الإقامة", "1xxxxxxxxx", "", 'inputmode="numeric"')}${fld("guarantorMobile", "جوال الكفيل", "05XXXXXXXX", "", 'inputmode="tel"')}</div>`;
}
Object.assign(ACTIONS, {
  cfType: (el) => {
    UI.cf.type = el.dataset.k;
    rerenderModal();
  },
  cfSet: (el) => (UI.cf[el.dataset.k] = el.value),
  cfRep: (el) => (UI.cf.repId = el.value),
  saveCustomer: (el) =>
    runAction(
      el,
      () => {
        const c = addCustomer(UI.cf, ME);
        closeModal();
        if (UI.pos && location.hash.startsWith("#/sales/new")) {
          UI.pos.customerId = c.id;
          UI.pos.projectId = S.projects.find((p) => p.customerId === c.id)?.id || null;
        } else if (UI.rent && location.hash.startsWith("#/rentals/new")) {
          UI.rent.customerId = c.id;
          UI.rent.projectId = S.projects.find((p) => p.customerId === c.id)?.id || null;
        } else location.hash = "#/customers/" + c.id;
        return c;
      },
      (c) => `تم إضافة العميل ${c.code}`,
    ),
  newProject: (el) => {
    UI.pf = { customerId: el.dataset.c, for: el.dataset.for };
    openModal(
      "مشروع جديد — " + esc(custName(el.dataset.c)),
      () => `<div class="form-grid"><div class="field full"><label>اسم المشروع *</label><input class="input" id="pf-name" data-act-input="pfSet" data-k="name" value="${esc(UI.pf.name || "")}"><span class="hint">يمكن تكرار الاسم — لكل مشروع معرّف ثابت</span></div><div class="field full"><label>الموقع</label><input class="input" id="pf-loc" data-act-input="pfSet" data-k="location" value="${esc(UI.pf.location || "")}"></div><div class="field full"><label>التفاصيل</label><textarea class="input" id="pf-det" data-act-input="pfSet" data-k="details">${esc(UI.pf.details || "")}</textarea></div></div>`,
      `<button class="btn primary" data-act="saveProject" data-label="حفظ">${ic("check")}حفظ المشروع</button><button class="btn" data-act="closeModal">إلغاء</button>`,
    );
  },
  pfSet: (el) => (UI.pf[el.dataset.k] = el.value),
  saveProject: (el) =>
    runAction(
      el,
      () => {
        const p = addProject(UI.pf, ME);
        closeModal();
        if (UI.pf.for === "pos" && UI.pos) UI.pos.projectId = p.id;
        if (UI.pf.for === "rent" && UI.rent) UI.rent.projectId = p.id;
        return p;
      },
      (p) => `تم إنشاء المشروع ${p.code}`,
    ),
  rate: (el) => {
    UI.rf = { c: el.dataset.c, rating: 4, reason: "" };
    openModal("تقييم العميل", () => `<div class="field"><label>التقييم</label><div class="seg">${[1, 2, 3, 4, 5].map((n) => `<button class="${UI.rf.rating === n ? "on" : ""}" data-act="rfStar" data-n="${n}">${"★".repeat(n)}</button>`).join("")}</div></div><div class="field" style="margin-top:10px"><label>السبب *</label><textarea class="input" id="rf-reason" data-act-input="rfReason">${esc(UI.rf.reason)}</textarea></div><div class="hint">يُحفظ بالتاريخ واسم المقيّم ولا يُحذف التقييم السابق</div>`, `<button class="btn primary" data-act="rfSave" data-label="حفظ">حفظ التقييم</button>`);
  },
  rfStar: (el) => ((UI.rf.rating = +el.dataset.n), rerenderModal()),
  rfReason: (el) => (UI.rf.reason = el.value),
  rfSave: (el) =>
    runAction(el, () => {
      if (!UI.rf.reason.trim()) throw new DomainError("اكتب سبب التقييم");
      S.ratings.push({ id: uid("rt"), customerId: UI.rf.c, rating: UI.rf.rating, reason: UI.rf.reason, by: ME.id, at: Date.now() });
      audit(ME, "CUSTOMER_RATE", "Customer", UI.rf.c, null, { rating: UI.rf.rating });
      touch();
      closeModal();
    }, "تم تحديث العميل — أضيف التقييم"),
  blacklist: (el) => {
    const c = byId(S.customers, el.dataset.c);
    const bl = blacklistState(c.id);
    UI.bf = { c: c.id, scope: bl?.scope || "CREDIT", reason: "", action: bl ? "UNBLACKLIST" : "BLACKLIST" };
    openModal(bl ? "رفع الحظر" : "إضافة للقائمة السوداء", () => `${UI.bf.action === "BLACKLIST" ? `<div class="field"><label>النطاق (أثر القرار)</label><div class="seg"><button class="${UI.bf.scope === "CREDIT" ? "on" : ""}" data-act="bfScope" data-k="CREDIT">منع الآجل فقط</button><button class="${UI.bf.scope === "ALL" ? "on" : ""}" data-act="bfScope" data-k="ALL">منع كل العمليات الجديدة</button></div><span class="hint">في الحالتين تبقى تسوية المستحقات ورد المعدات ممكنة</span></div>` : ""}<div class="field" style="margin-top:10px"><label>السبب *</label><textarea class="input" id="bf-reason" data-act-input="bfReason">${esc(UI.bf.reason)}</textarea></div><div class="hint">يُحفظ القرار وتاريخه وصاحبه، ويبقى السجل السابق كاملًا</div>`, `<button class="btn ${UI.bf.action === "BLACKLIST" ? "danger" : "primary"}" data-act="bfSave" data-label="تأكيد">تأكيد القرار</button>`);
  },
  bfScope: (el) => ((UI.bf.scope = el.dataset.k), rerenderModal()),
  bfReason: (el) => (UI.bf.reason = el.value),
  bfSave: (el) =>
    runAction(el, () => {
      if (!UI.bf.reason.trim()) throw new DomainError("اكتب سبب القرار");
      S.blacklist.push({ id: uid("bl"), customerId: UI.bf.c, action: UI.bf.action, scope: UI.bf.scope, reason: UI.bf.reason, by: ME.id, at: Date.now() });
      audit(ME, UI.bf.action, "Customer", UI.bf.c, null, { scope: UI.bf.scope, reason: UI.bf.reason });
      touch();
      closeModal();
    }, "تم تحديث العميل — سُجّل القرار"),
  followup: (el) => {
    const c = byId(S.customers, el.dataset.c);
    UI.ff = { c: c.id, repId: c.repId, outcome: "", next: isoDay(Date.now() + 3 * DAY), projectId: "" };
    openModal("تسجيل متابعة — " + esc(c.name), () => `<div class="form-grid"><div class="field"><label>المندوب</label><select class="select" data-act-change="ffRep">${S.reps.map((r) => `<option value="${r.id}" ${UI.ff.repId === r.id ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select></div><div class="field"><label>المشروع</label><select class="select" data-act-change="ffProj"><option value="">—</option>${S.projects.filter((p) => p.customerId === c.id).map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></div><div class="field full"><label>نتيجة المتابعة *</label><input class="input" id="ff-out" data-act-input="ffOut" value="${esc(UI.ff.outcome)}" placeholder="مثال: وعد بالسداد الأحد"></div><div class="field"><label>الموعد القادم</label><input type="date" class="input" value="${UI.ff.next}" data-act-change="ffNext"></div></div>`, `<button class="btn primary" data-act="ffSave" data-label="حفظ">حفظ</button>`);
  },
  ffRep: (el) => (UI.ff.repId = el.value),
  ffProj: (el) => (UI.ff.projectId = el.value),
  ffOut: (el) => (UI.ff.outcome = el.value),
  ffNext: (el) => (UI.ff.next = el.value),
  ffSave: (el) =>
    runAction(el, () => {
      if (!UI.ff.outcome.trim()) throw new DomainError("اكتب نتيجة المتابعة");
      S.followups.push({ id: uid("fu"), customerId: UI.ff.c, projectId: UI.ff.projectId || null, repId: UI.ff.repId, userId: ME.id, outcome: UI.ff.outcome, at: Date.now(), next: UI.ff.next ? parseDay(UI.ff.next) + 9 * 3600000 : null, done: false });
      touch();
      closeModal();
    }, "تم تسجيل المتابعة"),
  addPN: (el) => {
    UI.pnf = { c: el.dataset.c, projectId: el.dataset.p || "", no: "", amount: 0, issue: isoDay(Date.now()), due: "", attach: false };
    openModal("سند لأمر — فهرسة ومتابعة", () => `<div class="alert info" style="margin-bottom:10px">${ic("info")}<div>تسجيل السند لأمر لا يغيّر رصيد الصندوق ولا يُحسب قبضًا. السداد المرتبط به يُسجّل كسند قبض عادي.</div></div><div class="form-grid"><div class="field"><label>رقم السند *</label><input class="input" id="pn-no" data-act-input="pnSet" data-k="no" value="${esc(UI.pnf.no)}"></div><div class="field"><label>المبلغ *</label><input class="input" id="pn-amt" data-act-input="pnAmt" value="${UI.pnf.amount ? UI.pnf.amount / 100 : ""}"></div><div class="field"><label>تاريخ السند</label><input type="date" class="input" value="${UI.pnf.issue}" data-act-change="pnIssue"></div><div class="field"><label>تاريخ الاستحقاق (إن وجد)</label><input type="date" class="input" value="${UI.pnf.due}" data-act-change="pnDue"></div><div class="field"><label>المشروع</label><select class="select" data-act-change="pnProj"><option value="">—</option>${S.projects.filter((p) => p.customerId === UI.pnf.c).map((p) => `<option value="${p.id}" ${UI.pnf.projectId === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div><div class="field"><label>النسخة المرفقة</label><label class="row small"><input type="checkbox" data-act-change="pnAttach" ${UI.pnf.attach ? "checked" : ""}> أرفقت صورة السند</label></div></div>`, `<button class="btn primary" data-act="pnSave" data-label="حفظ">حفظ</button>`);
  },
  pnSet: (el) => (UI.pnf[el.dataset.k] = el.value),
  pnAmt: (el) => (UI.pnf.amount = parseMoney(el.value)),
  pnIssue: (el) => (UI.pnf.issue = el.value),
  pnDue: (el) => (UI.pnf.due = el.value),
  pnProj: (el) => (UI.pnf.projectId = el.value),
  pnAttach: (el) => (UI.pnf.attach = el.checked),
  pnSave: (el) =>
    runAction(el, () => {
      const f = UI.pnf;
      if (!f.no.trim() || !(f.amount > 0)) throw new DomainError("أدخل رقم السند والمبلغ");
      const n = { id: uid("pn"), no: f.no.trim(), customerId: f.c, projectId: f.projectId || null, amount: f.amount, at: parseDay(f.issue) + 9 * 3600000, due: f.due ? parseDay(f.due) : null, status: "ACTIVE", attachment: f.attach, by: ME.id };
      S.promissory.push(n);
      audit(ME, "PROMISSORY_CREATE", "PromissoryNote", n.id, null, { no: n.no, amount: n.amount });
      touch();
      closeModal();
    }, "تم حفظ السند لأمر في بروفايل العميل"),
  editGuarantor: (el) => {
    const c = byId(S.customers, el.dataset.c);
    UI.gf = { c: c.id, guarantor: c.guarantor || "", guarantorId: c.guarantorId || "", guarantorMobile: c.guarantorMobile || "" };
    openModal("الكفيل الغارم — " + esc(c.name), () => `<div class="form-grid"><div class="field full"><label>الاسم</label><input class="input" id="gf-n" value="${esc(UI.gf.guarantor)}" data-act-input="gfSet" data-k="guarantor"></div><div class="field"><label>رقم الهوية / الإقامة</label><input class="input" id="gf-i" value="${esc(UI.gf.guarantorId)}" inputmode="numeric" placeholder="1xxxxxxxxx" data-act-input="gfSet" data-k="guarantorId"></div><div class="field"><label>رقم الجوال</label><input class="input" id="gf-m" value="${esc(UI.gf.guarantorMobile)}" inputmode="tel" placeholder="05XXXXXXXX" data-act-input="gfSet" data-k="guarantorMobile"></div></div><div class="hint" style="margin-top:8px">الكفيل اختياري. لحذفه امسح الحقول الثلاثة واحفظ. يُسجّل التعديل في التدقيق.</div>`, `<button class="btn primary" data-act="gfSave" data-label="حفظ">${ic("check")}حفظ</button><button class="btn" data-act="closeModal">إلغاء</button>`);
  },
  gfSet: (el) => (UI.gf[el.dataset.k] = el.value),
  gfSave: (el) => runAction(el, () => { const c = updateGuarantor(UI.gf.c, UI.gf, ME); closeModal(); return c; }, "تم تحديث العميل — بيانات الكفيل الغارم"),
  openPN: (el) => go("/print/pn/" + el.dataset.n),
  addFile: (el) => {
    S.documents.push({ id: uid("doc"), customerId: el.dataset.c, projectId: null, title: "مستند مرفوع", fileName: "scan-" + isoDay(Date.now()) + ".pdf", size: 120000, at: Date.now(), by: ME.id });
    touch();
    toast("تم إرفاق الملف (محاكاة في نسخة العرض)");
    render();
  },
  viewFile: () => toast("في النظام الفعلي يُفتح الملف بعد التحقق من الصلاحية"),
});

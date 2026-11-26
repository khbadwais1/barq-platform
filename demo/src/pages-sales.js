/* ═══════════ البيع: نقطة البيع، القائمة، التفاصيل ═══════════ */
"use strict";

const newKey = (p) => p + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function customerPicker(stateObj, prefix) {
  const u = ME;
  if (stateObj.customerId) {
    const c = byId(S.customers, stateObj.customerId);
    const bl = blacklistState(c.id);
    const projects = S.projects.filter((p) => p.customerId === c.id);
    const cs = customerSummary(c.id);
    return `<div class="card card-b">
      <div class="row between"><div class="row"><div class="avatar">${esc(c.name[0])}</div><div class="col" style="gap:0"><b>${esc(c.name)}</b><span class="xs muted">${c.code} · ${c.type === "COMPANY" ? "منشأة" : "فرد"} · <span class="num">${c.mobile}</span></span></div></div><button class="btn sm" data-act="${prefix}ClearCustomer">تغيير</button></div>
      ${bl ? `<div class="alert danger" style="margin-top:10px">${ic("ban")}<div><b>العميل في القائمة السوداء ${bl.scope === "CREDIT" ? "(للآجل فقط)" : "(كل العمليات)"}</b> — ${esc(bl.reason)}. قرار ${esc(userName(bl.by))} بتاريخ ${fmtDate(bl.at)}. ${bl.scope === "CREDIT" ? "المسموح: بيع نقدي فقط." : "لن يقبل النظام عملية جديدة."}</div></div>` : ""}
      ${cs.overdue.length ? `<div class="alert warn" style="margin-top:10px">${ic("alert")}<div>على العميل ${cs.overdue.length} فاتورة متأخرة بمبلغ ${nf2.format(cs.overdueAmount / 100)} ر.س</div></div>` : ""}
      <div class="form-grid" style="margin-top:12px">
        <div class="field"><label>المشروع *</label><select class="select" data-act-change="${prefix}Project"><option value="">اختر المشروع…</option>${projects.map((p) => `<option value="${p.id}" ${stateObj.projectId === p.id ? "selected" : ""}>${esc(p.name)} — ${esc(p.location || "")} (${p.code})</option>`).join("")}</select></div>
        <div class="field"><label>&nbsp;</label><button class="btn" data-act="newProject" data-c="${c.id}" data-for="${prefix}">${ic("plus")}مشروع جديد لهذا العميل</button></div>
      </div></div>`;
  }
  const q = stateObj.cq || "";
  const res = q.trim().length >= 2 ? searchCustomers(q).slice(0, 8) : [];
  return `<div class="card card-b"><div class="field"><label>العميل * <span class="faint xs">ابحث بالاسم أو العلامة التجارية أو الجوال أو الهوية أو الإقامة أو السجل التجاري — تقبل الأرقام العربية</span></label>
    <div class="search" style="max-width:none"><input class="input" id="${prefix}-cq" placeholder="مثال: 0501234567 أو ٠٥٠١٢٣٤٥٦٧ أو الأفق" value="${esc(q)}" data-act-input="${prefix}Cq" autocomplete="off">${ic("search")}</div></div>
    ${res.length ? `<div class="col" style="margin-top:8px;gap:4px">${res.map(({ customer: c, key }) => {
      const full = canSeeCustomer(u, c);
      return `<button class="btn" style="justify-content:space-between;height:auto;padding:8px 12px" data-act="${prefix}PickCustomer" data-c="${c.id}"><span class="col" style="gap:0;align-items:flex-start"><b>${esc(full ? c.name : c.name.split(" ")[0] + " •••")}</b><span class="xs muted">${c.code} · ${full ? `<span class="num">${c.mobile}</span>` : "مسجل لدى بائع آخر — يُعرض الحد الأدنى من البيانات"}</span></span><span class="chip">طابق: ${key}</span></button>`;
    }).join("")}</div>` : q.trim().length >= 2 ? `<div class="empty small">لا يوجد عميل مطابق. <button class="btn sm primary" data-act="quick" data-h="@customer">${ic("plus")}إضافة عميل جديد</button></div>` : ""}
    <div class="row" style="margin-top:10px"><button class="btn sm" data-act="quick" data-h="@customer">${ic("plus")}عميل جديد</button></div></div>`;
}

/* ─── نقطة البيع ─── */
function posState(query) {
  if (!UI.pos) UI.pos = { cart: [], cat: "all", q: "", wh: "w1", term: "CREDIT", docDisc: 0, paid: 0, accountId: "a-cash", method: "CASH", repId: null, notes: "", driver: "", due: isoDay(Date.now() + S.settings.creditDays * DAY), key: newKey("sale") };
  if (query.customer && UI.pos._qc !== query.customer) {
    UI.pos._qc = query.customer;
    UI.pos.customerId = query.customer;
    UI.pos.projectId = query.project || null;
  }
  return UI.pos;
}
function posTotals(P) {
  return saleTotals(
    P.cart.map((l) => ({ pid: l.pid, count: l.count, price: l.price, disc: l.disc })),
    P.docDisc,
    S.settings.vatRate,
  );
}
route("/sales/new", ["sales.create"], (_, query) => {
  const P = posState(query);
  const t = posTotals(P);
  const limit = ME.role === "OWNER" ? 100 : ME.maxDisc ?? S.settings.sellerMaxDiscountPct;
  const overLimit = t.discPct > limit + 1e-9;
  const cats = [["all", "الكل"], ...S.categories.map((c) => [c.id, c.name])];
  const q = normText(P.q);
  const prods = S.products.filter((p) => p.status === "ACTIVE" && (P.cat === "all" || p.cat === P.cat) && (!q || normText(p.name + " " + p.sku).includes(q)));
  const fams = [];
  for (const p of prods) {
    let f = fams.find((x) => x.name === p.family);
    if (!f) fams.push((f = { name: p.family, items: [] }));
    f.items.push(p);
  }
  const inCart = (pid) => P.cart.filter((l) => l.pid === pid).reduce((a, l) => a + l.count, 0);
  const grid = fams
    .map(
      (f) => `<div class="fam"><div class="fam-h"><span class="t">${esc(f.name)}</span><span class="xs muted">${f.items[0].pricing === "METER" ? "السعر بالمتر الطولي" : "السعر بالقطعة"}</span></div><div class="sizes">${f.items
        .map((p) => {
          const av = bal(p.id, P.wh).AVAILABLE;
          const n = inCart(p.id);
          return `<div class="size ${n ? "in" : ""}" data-act="posAdd" data-p="${p.id}" title="${esc(p.name)} — ${p.sku}">${n ? `<span class="q">${n}</span>` : ""}<div class="s">${p.len ? (p.len < 1 ? Math.round(p.len * 100) + " سم" : p.len.toFixed(2) + " م") : esc(p.name)}</div><div class="p">${money(p.price)} ${p.pricing === "METER" ? "/م" : ""}</div><div class="st ${av === 0 ? "out" : av <= p.min ? "low" : ""}">متاح ${nf0.format(av)}</div></div>`;
        })
        .join("")}</div></div>`,
    )
    .join("");
  const cart = P.cart.length
    ? P.cart
        .map((l, i) => {
          const p = byId(S.products, l.pid);
          const c = t.calc[i];
          const av = bal(p.id, P.wh).AVAILABLE;
          return `<div class="cart-line"><div class="col" style="gap:2px"><b class="small">${esc(p.name)}</b><span class="xs muted">${p.sku}${c.meters ? ` · الكمية ${nf2.format(c.meters)} م` : ""}${inCart(p.id) > av ? ` · <span style="color:var(--red)">يتجاوز المتاح (${av})</span>` : ""}</span>
            <div class="row" style="margin-top:4px;flex-wrap:wrap"><span class="qty"><button data-act="posQty" data-i="${i}" data-d="-1">−</button><input id="pq-${i}" value="${l.count}" inputmode="numeric" data-act-input="posQtyIn" data-i="${i}"><button data-act="posQty" data-i="${i}" data-d="1">+</button></span>
            <span class="xs muted">×</span><input class="input" style="width:84px;height:30px" id="pp-${i}" value="${(l.price / 100).toFixed(2)}" ${ME.role === "OWNER" ? "" : 'readonly title="تعديل السعر يحتاج صلاحية — استخدم الخصم"'} data-act-input="posPrice" data-i="${i}" inputmode="decimal">
            <span class="xs muted">خصم</span><input class="input" style="width:70px;height:30px" id="pd-${i}" value="${l.disc ? (l.disc / 100).toFixed(2) : ""}" placeholder="0" data-act-input="posDisc" data-i="${i}" inputmode="decimal"></div></div>
            <div class="col" style="align-items:flex-end;gap:4px"><b>${money(c.net)}</b><button class="btn sm ghost danger" data-act="posDel" data-i="${i}" title="حذف">${ic("x")}</button></div></div>`;
        })
        .join("")
    : emptyBox("اختر الأصناف من القائمة — كل ضغطة تضيف قطعة", "cart");
  const accounts = S.accounts;
  const summary = (cls) => `<div class="card pos-summary ${cls}"><div class="card-h"><h3>ملخص العملية</h3><span class="chip">${P.cart.length} بند · ${nf0.format(P.cart.reduce((a, l) => a + l.count, 0))} قطعة</span></div><div class="card-b">
    <div style="max-height:330px;overflow:auto;margin:-6px 0 8px">${cart}</div>
    <div class="sum-row"><span class="muted">الإجمالي قبل الخصم</span><span>${money(t.gross)}</span></div>
    <div class="sum-row"><span class="muted">خصم البنود</span><span>${money(t.itemsDisc)}</span></div>
    <div class="sum-row"><span class="muted">خصم المستند</span><input class="input" style="width:110px;height:30px" id="pdoc" value="${P.docDisc ? (P.docDisc / 100).toFixed(2) : ""}" placeholder="0.00" data-act-input="posDoc" inputmode="decimal"></div>
    <div class="sum-row"><span class="muted">الوعاء الضريبي</span><span>${money(t.taxable)}</span></div>
    <div class="sum-row"><span class="muted">ضريبة القيمة المضافة ${S.settings.vatRate}%</span><span>${money(t.vat)}</span></div>
    <div class="sum-row total"><span>الإجمالي</span><span>${sar(t.total)}</span></div>
    ${t.totalDisc ? `<div class="alert ${overLimit ? "warn" : "info"}" style="margin-top:8px">${ic(overLimit ? "alert" : "info")}<div>الخصم ${t.discPct.toFixed(1)}% — حدك ${limit}%. ${overLimit ? "<b>سيُرسل البيع لموافقة المالك قبل التأكيد ولن يُخصم المخزون حتى الاعتماد.</b>" : "ضمن صلاحيتك."}</div></div>` : ""}
    <div class="field" style="margin-top:12px"><label>أجل السداد</label><div class="seg">${["CASH", "PARTIAL", "CREDIT"].map((k) => `<button class="${P.term === k ? "on" : ""}" data-act="posTerm" data-k="${k}">${TERM[k]}</button>`).join("")}</div></div>
    ${P.term !== "CREDIT" ? `<div class="form-grid" style="margin-top:10px">
      ${P.term === "PARTIAL" ? `<div class="field"><label>المدفوع الآن</label><input class="input" id="ppaid" value="${P.paid ? (P.paid / 100).toFixed(2) : ""}" data-act-input="posPaid" inputmode="decimal" placeholder="0.00"></div>` : ""}
      <div class="field"><label>وسيلة القبض</label><select class="select" data-act-change="posMethod">${Object.entries(METHOD).map(([k, v]) => `<option value="${k}" ${P.method === k ? "selected" : ""}>${v}</option>`).join("")}</select></div>
      <div class="field"><label>حساب القبض</label><select class="select" data-act-change="posAccount">${accounts.map((a) => `<option value="${a.id}" ${P.accountId === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select></div></div>` : ""}
    ${P.term !== "CASH" ? `<div class="field" style="margin-top:10px"><label>تاريخ الاستحقاق</label><input type="date" class="input" value="${P.due}" data-act-change="posDue"></div>` : ""}
    <div class="sum-row" style="margin-top:8px"><span class="muted">المدفوع</span><span>${money(P.term === "CASH" ? t.total : P.term === "PARTIAL" ? P.paid : 0)}</span></div>
    <div class="sum-row"><span class="bold">المتبقي (ذمة)</span><b>${money(t.total - (P.term === "CASH" ? t.total : P.term === "PARTIAL" ? Math.min(P.paid, t.total) : 0))}</b></div>
    <button class="btn primary lg" style="width:100%;margin-top:12px" data-act="posConfirm" data-label="تأكيد البيع">${ic("check")}تأكيد البيع</button>
    <div class="xs faint" style="margin-top:8px;text-align:center">عند التأكيد يُنشأ: البيع + سند استلام المواد + حركة خروج المخزون + الفاتورة الضريبية${P.term !== "CREDIT" ? " + سند القبض" : ""} — في عملية واحدة.</div>
  </div></div>`;
  return `${pageHead("بيع جديد", "اختر العميل والمشروع ثم الأصناف — الحساب لحظي ويُعاد التحقق منه عند الحفظ", `<button class="btn" data-act="posReset">${ic("refresh")}بدء من جديد</button>`)}
  <div class="pos"><div class="col" style="gap:14px">
    ${customerPicker(P, "pos")}
    <div class="card card-b"><div class="form-grid">
      <div class="field"><label>المستودع</label><select class="select" data-act-change="posWh">${S.warehouses.map((w) => `<option value="${w.id}" ${P.wh === w.id ? "selected" : ""}>${esc(w.name)}</option>`).join("")}</select></div>
      <div class="field"><label>المندوب</label><select class="select" data-act-change="posRep"><option value="">مندوب العميل الافتراضي</option>${S.reps.map((r) => `<option value="${r.id}" ${P.repId === r.id ? "selected" : ""}>${esc(r.name)} (${r.code})</option>`).join("")}</select></div>
      <div class="field"><label>اسم السائق</label><input class="input" id="pdrv" value="${esc(P.driver)}" data-act-input="posDriver" placeholder="اختياري"></div>
      <div class="field"><label>ملاحظات / الموقع</label><input class="input" id="pnotes" value="${esc(P.notes)}" data-act-input="posNotes" placeholder="اختياري"></div>
    </div></div>
    <div class="card card-b"><div class="row wrap" style="margin-bottom:10px"><div class="search" style="max-width:280px;flex:1"><input class="input" id="pq" placeholder="ابحث عن صنف أو كود…" value="${esc(P.q)}" data-act-input="posQ">${ic("search")}</div></div>
      <div class="cats" style="margin-bottom:12px">${cats.map(([k, l]) => `<button class="${P.cat === k ? "on" : ""}" data-act="posCat" data-k="${k}">${l}</button>`).join("")}</div>
      ${grid || emptyBox("لا أصناف مطابقة")}</div>
  </div>${summary("desk")}</div>
  <div class="mobile-bar"><div class="col grow" style="gap:0"><span class="xs muted">${P.cart.length} بند</span><b style="font-size:17px">${sar(t.total)}</b></div><button class="btn" data-act="posSheet">الملخص</button><button class="btn primary" data-act="posConfirm" data-label="تأكيد">${ic("check")}تأكيد</button></div>`;
});
const parseMoney = (v) => Math.round(parseFloat(toLatin(String(v)).replace(/[^0-9.]/g, "") || "0") * 100);
Object.assign(ACTIONS, {
  posCq: (el) => ((UI.pos.cq = el.value), render()),
  posPickCustomer: (el) => {
    const c = byId(S.customers, el.dataset.c);
    UI.pos.customerId = c.id;
    const ps = S.projects.filter((p) => p.customerId === c.id);
    UI.pos.projectId = ps.length === 1 ? ps[0].id : null;
    UI.pos.cq = "";
    render();
  },
  posClearCustomer: () => ((UI.pos.customerId = null), (UI.pos.projectId = null), render()),
  posProject: (el) => ((UI.pos.projectId = el.value || null), render()),
  posWh: (el) => ((UI.pos.wh = el.value), render()),
  posRep: (el) => (UI.pos.repId = el.value || null),
  posDriver: (el) => (UI.pos.driver = el.value),
  posNotes: (el) => (UI.pos.notes = el.value),
  posQ: (el) => ((UI.pos.q = el.value), render()),
  posCat: (el) => ((UI.pos.cat = el.dataset.k), render()),
  posAdd: (el) => {
    const p = byId(S.products, el.dataset.p);
    const l = UI.pos.cart.find((x) => x.pid === p.id);
    if (l) l.count++;
    else UI.pos.cart.push({ pid: p.id, count: 1, price: p.price, disc: 0 });
    render();
  },
  posQty: (el) => {
    const l = UI.pos.cart[+el.dataset.i];
    l.count = Math.max(1, l.count + +el.dataset.d);
    render();
  },
  posQtyIn: (el) => {
    const v = parseInt(toLatin(el.value).replace(/[^0-9]/g, ""), 10);
    UI.pos.cart[+el.dataset.i].count = v > 0 ? v : 1;
    render();
  },
  posPrice: (el) => ((UI.pos.cart[+el.dataset.i].price = parseMoney(el.value)), render()),
  posDisc: (el) => ((UI.pos.cart[+el.dataset.i].disc = parseMoney(el.value)), render()),
  posDel: (el) => (UI.pos.cart.splice(+el.dataset.i, 1), render()),
  posDoc: (el) => ((UI.pos.docDisc = parseMoney(el.value)), render()),
  posTerm: (el) => ((UI.pos.term = el.dataset.k), render()),
  posPaid: (el) => ((UI.pos.paid = parseMoney(el.value)), render()),
  posMethod: (el) => ((UI.pos.method = el.value), (UI.pos.accountId = el.value === "CASH" ? "a-cash" : UI.pos.accountId === "a-cash" ? "a-rajhi" : UI.pos.accountId), render()),
  posAccount: (el) => (UI.pos.accountId = el.value),
  posDue: (el) => (UI.pos.due = el.value),
  posReset: () => confirmDialog("بدء بيع جديد", "سيتم تفريغ السلة والبيانات المدخلة.", () => ((UI.pos = null), render()), { danger: false }),
  posSheet: () => {
    const html = document.querySelector(".pos-summary.desk").outerHTML.replace("pos-summary desk", "pos-summary");
    openModal("ملخص العملية", html, "", "wide");
  },
  posConfirm: (el) => {
    const P = UI.pos;
    const t = posTotals(P);
    runAction(
      el,
      () => {
        const res = createSale(
          {
            customerId: P.customerId,
            projectId: P.projectId,
            wh: P.wh,
            lines: P.cart.map((l) => ({ pid: l.pid, count: l.count, price: l.price, disc: l.disc })),
            docDisc: P.docDisc,
            term: P.term,
            paid: P.term === "CASH" ? t.total : P.paid,
            accountId: P.accountId,
            method: P.method,
            due: parseDay(P.due) + 12 * 3600000,
            repId: P.repId,
            notes: P.notes,
            driver: P.driver,
            idemKey: P.key,
          },
          ME,
        );
        UI.pos = null;
        closeModal();
        location.hash = "#/sales/" + res.sale.id;
        return res;
      },
      (res) => (res.duplicate ? "هذا الطلب سُجل مسبقًا — لم يتكرر" : res.pending ? "أُرسل البيع لموافقة المالك على الخصم" : "تم تسجيل البيع بنجاح"),
    );
  },
});

ACTIONS.cancelSale = (el) => {
  const s = byId(S.sales, el.dataset.s);
  UI.cancelS = { id: s.id, reason: "" };
  openModal("إلغاء البيع " + s.no, () => `<div class="alert danger">${ic("alert")}<div>تعود الكميات (${s.lines.reduce((a, l) => a + l.count, 0)} قطعة) إلى «${esc(whName(s.wh))}» وتُلغى الفاتورة بإشعار دائن. يُسجّل القرار في التدقيق ولا يُحذف البيع.</div></div><div class="field" style="margin-top:10px"><label>سبب الإلغاء *</label><input class="input" id="cs-reason" data-act-input="csReason" value="${esc(UI.cancelS.reason)}"></div>`, `<button class="btn danger" data-act="csSave" data-label="تأكيد الإلغاء">تأكيد الإلغاء</button><button class="btn" data-act="closeModal">تراجع</button>`);
};
ACTIONS.csReason = (el) => (UI.cancelS.reason = el.value);
ACTIONS.csSave = (el) => runAction(el, () => { const s = cancelSale(UI.cancelS.id, UI.cancelS.reason.trim(), ME); closeModal(); return s; }, "تم إلغاء البيع وإرجاع الكميات للمخزون");

/* ─── قائمة المبيعات ─── */
route("/sales", ["sales.viewAll", "sales.create"], (_, query) => {
  const u = ME;
  let rows = S.sales.filter((s) => canSeeSale(u, s));
  if (query.seller && can(u, "sales.viewAll")) rows = rows.filter((s) => s.sellerId === query.seller);
  rows = rows.map((s) => ({ ...s, _inv: byId(S.invoices, s.invoiceId) }));
  const tot = rows.filter((s) => s.status === "CONFIRMED");
  return `${pageHead(u.role === "SELLER" ? "مبيعاتي" : "المبيعات", `${query.seller ? "البائع: " + esc(userName(query.seller)) + " · " : ""}${rows.length} عملية — إجمالي المؤكد ${nf2.format(tot.reduce((a, s) => a + s.total, 0) / 100)} ر.س`, can(u, "sales.create") ? `<a class="btn primary" href="#/sales/new">${ic("plus")}بيع جديد</a>` : "")}
  ${table(
    "sales",
    [
      { key: "no", label: "رقم البيع", text: (s) => s.no, render: (s) => `<a class="link num" href="#/sales/${s.id}">${s.no}</a>` },
      { key: "at", label: "التاريخ", value: (s) => s.at, text: (s) => fmtDate(s.at), render: (s) => dateNum(s.at) },
      { key: "c", label: "العميل", text: (s) => custName(s.customerId) },
      { key: "p", label: "المشروع", text: (s) => projName(s.projectId) },
      { key: "seller", label: "البائع", text: (s) => userName(s.sellerId) },
      { key: "rep", label: "المندوب", text: (s) => byId(S.reps, s.repId)?.name || "—" },
      { key: "term", label: "الأجل", text: (s) => TERM[s.term] },
      { key: "total", label: "الإجمالي", value: (s) => s.total, render: (s) => sar(s.total) },
      { key: "paid", label: "المدفوع", value: (s) => (s._inv ? invPaid(s._inv) : 0), render: (s) => sar(s._inv ? invPaid(s._inv) : 0) },
      { key: "rem", label: "المتبقي", value: (s) => (s._inv ? invRemaining(s._inv) : 0), render: (s) => sar(s._inv ? invRemaining(s._inv) : 0) },
      { key: "st", label: "الحالة", text: (s) => (s._inv ? BADGES[invStatus(s._inv)][0] : BADGES[s.status][0]), render: saleBadge },
    ],
    rows,
    {
      sort: "at",
      rowLink: (s) => "/sales/" + s.id,
      hidden: ["rep"],
      filters: [
        { key: "st", label: "الحالة", options: [["PAID", "مدفوعة"], ["PARTIAL", "جزئي"], ["UNPAID", "غير مدفوعة"], ["OVERDUE", "متأخرة"], ["PENDING_APPROVAL", "بانتظار الموافقة"], ["CANCELLED", "ملغاة"]], match: (s, v) => (s._inv ? invStatus(s._inv) : s.status) === v },
        { key: "term", label: "الأجل", options: Object.entries(TERM), match: (s, v) => s.term === v },
        ...(can(u, "sales.viewAll") ? [{ key: "seller", label: "البائع", options: S.users.filter((x) => x.role === "SELLER").map((x) => [x.id, x.name]), match: (s, v) => s.sellerId === v }] : []),
      ],
      footer: (c, data) => (c.key === "total" ? sar(data.reduce((a, s) => a + (s.status === "CONFIRMED" ? s.total : 0), 0)) : c.key === "rem" ? sar(data.reduce((a, s) => a + (s._inv ? invRemaining(s._inv) : 0), 0)) : c.key === "no" ? "الإجمالي (كل الصفحات)" : ""),
    },
  )}`;
});

/* ─── تفاصيل البيع ─── */
function timelineFor(entityIds) {
  const ev = S.audit.filter((a) => entityIds.includes(a.entityId)).sort((a, b) => a.at - b.at);
  const LBL = { SALE_CREATE: "إنشاء البيع", PAYMENT_CREATE: "تسجيل قبض", APPROVAL_APPROVED: "اعتماد", APPROVAL_REJECTED: "رفض", RENTAL_CREATE: "إنشاء العقد", RENTAL_DELIVER: "تسليم معدات", RENTAL_RETURN: "كشف دخول (مرتجع)", RENTAL_BILL: "فوترة إيجار", DEPOSIT_RECEIVED: "قبض تأمين", DEPOSIT_REFUNDED: "رد تأمين", DEPOSIT_FORFEITED: "حسم تأمين", SALE_CANCEL: "إلغاء" };
  return `<div class="timeline">${ev.map((a) => `<div class="tl ${a.action.includes("REJECT") || a.action.includes("CANCEL") ? "red" : a.action.includes("PAY") || a.action.includes("APPROVED") ? "green" : ""}"><b class="small">${LBL[a.action] || a.action}</b> <span class="xs muted">${esc(userName(a.userId))} (${ROLE_LABEL[a.role] || ""}) · <span class="num">${fmtDT(a.at)}</span></span>${a.after ? `<div class="xs faint num" style="direction:ltr;text-align:right">${esc(JSON.stringify(a.after))}</div>` : ""}</div>`).join("") || emptyBox("لا أحداث")}</div>`;
}
route("/sales/:id", ["sales.viewAll", "sales.create"], ({ id }) => {
  const s = byId(S.sales, id);
  if (!s) return emptyBox("البيع غير موجود");
  if (!canSeeSale(ME, s)) throw new DomainError("هذا البيع خارج نطاق صلاحيتك (بائع آخر)");
  const inv = byId(S.invoices, s.invoiceId);
  const dn = byId(S.deliveries, s.dnId);
  const pays = inv ? S.payments.filter((p) => p.allocations.some((a) => a.invoiceId === inv.id)) : [];
  const mvs = S.movements.filter((m) => m.saleId === s.id);
  const ap = S.approvals.find((a) => a.entityId === s.id);
  return `${pageHead(`بيع ${s.no}`, `${esc(custName(s.customerId))} · مشروع ${esc(projName(s.projectId))}`, `${saleBadge(s)}${s.status === "CONFIRMED" && ME.role === "OWNER" && (!inv || invPaid(inv) === 0) ? `<button class="btn danger" data-act="cancelSale" data-s="${s.id}">${ic("ban")}إلغاء البيع</button>` : ""}${inv && inv.status !== "CANCELLED" && can(ME, "payments.create") && invRemaining(inv) > 0 ? `<button class="btn primary" data-act="pay" data-inv="${inv.id}">${ic("cash")}تسجيل تحصيل</button>` : ""}${inv ? `<a class="btn" href="#/print/invoice/${inv.id}">${ic("print")}الفاتورة</a>` : ""}${dn ? `<a class="btn" href="#/print/dn/${dn.id}">${ic("print")}سند الاستلام</a>` : ""}`, `<a href="#/sales">المبيعات</a> / ${s.no}`)}
  ${s.status === "PENDING_APPROVAL" ? `<div class="alert warn" style="margin-bottom:14px">${ic("clock")}<div><b>بانتظار موافقة المالك على الخصم</b> — ${esc(ap?.summary || "")}. لم يُخصم المخزون ولم تصدر فاتورة بعد.${ME.role === "OWNER" ? ` <a class="link" href="#/approvals">افتح مركز الموافقات</a>` : ""}</div></div>` : ""}
  ${s.status === "CANCELLED" ? `<div class="alert danger" style="margin-bottom:14px">${ic("ban")}<div>تم رفض/إلغاء البيع: ${esc(s.cancelReason || "")}</div></div>` : ""}
  <div class="grid g4">
    ${kpi({ label: "الإجمالي", value: sar(s.total), icon: "receipt" })}
    ${kpi({ label: "المدفوع", value: sar(inv ? invPaid(inv) : 0), icon: "cash", color: "#047857" })}
    ${kpi({ label: "المتبقي", value: sar(inv ? invRemaining(inv) : s.total), icon: "file", color: "#d1495b" })}
    ${kpi({ label: "القطع المباعة", value: int(s.lines.reduce((a, l) => a + l.count, 0)), icon: "box", sub: whName(s.wh) })}
  </div>
  <div class="grid g3" style="margin-top:16px">
    <div class="card span2"><div class="card-h"><h3>البنود (بالأسعار كما بيعت)</h3></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>الصنف</th><th>العدد</th><th>الكمية (م)</th><th>السعر</th><th>الإجمالي</th><th>الخصم</th><th>الصافي</th></tr></thead><tbody>${s.lines
      .map((l) => {
        const c = lineCalc(byId(S.products, l.pid), l);
        return `<tr><td><b>${esc(l.name)}</b> <span class="xs muted">${l.sku}</span></td><td>${int(l.count)}</td><td>${c.meters ? money(c.meters * 100) : "—"}</td><td>${money(l.price)}${l.pricing === "METER" ? " /م" : ""}</td><td>${money(c.gross)}</td><td>${money(c.disc)}</td><td><b>${money(c.net)}</b></td></tr>`;
      })
      .join("")}</tbody><tfoot><tr><td colspan="4">الإجمالي ${money(s.gross)} − خصم ${money(s.itemsDisc + s.docDisc)} = وعاء ${money(s.taxable)} + ضريبة ${s.rate}% ${money(s.vat)}</td><td colspan="3">${sar(s.total)}</td></tr></tfoot></table></div></div>
    <div class="card"><div class="card-h"><h3>البيانات</h3></div><div class="card-b col" style="gap:8px">
      <div class="row between"><span class="muted">العميل</span><a class="link" href="#/customers/${s.customerId}">${esc(custName(s.customerId))}</a></div>
      <div class="row between"><span class="muted">المشروع</span><a class="link" href="#/customers/${s.customerId}?project=${s.projectId}">${esc(projName(s.projectId))}</a></div>
      <div class="row between"><span class="muted">البائع (منشئ البيع)</span><b>${esc(userName(s.sellerId))}</b></div>
      <div class="row between"><span class="muted">المندوب</span><b>${esc(byId(S.reps, s.repId)?.name || "—")}</b></div>
      <div class="row between"><span class="muted">الأجل</span><b>${TERM[s.term]}</b></div>
      <div class="row between"><span class="muted">الاستحقاق</span><b>${dateNum(s.due)}</b></div>
      <div class="row between"><span class="muted">المستودع</span><b>${esc(whName(s.wh))}</b></div>
      <div class="row between"><span class="muted">التاريخ</span><b class="num">${fmtDT(s.at)}</b></div>
      ${s.notes ? `<div class="muted small">${esc(s.notes)}</div>` : ""}</div></div>
    <div class="card"><div class="card-h"><h3>الفاتورة</h3></div><div class="card-b">${inv ? `<a class="row between" href="#/invoices/${inv.id}"><span class="link num">${inv.no}</span>${badge(invStatus(inv))}</a><div class="muted small" style="margin-top:6px">تستحق ${fmtDate(inv.due)}</div>` : emptyBox("لا فاتورة بعد")}</div></div>
    <div class="card"><div class="card-h"><h3>الدفعات</h3></div><div class="card-b">${pays.length ? pays.map((p) => `<a class="row between" style="padding:5px 0" href="#/payments/${p.id}"><span class="link num">${p.no}</span><span>${sar(p.allocations.find((a) => a.invoiceId === inv.id).amount)}</span></a><div class="xs muted">${METHOD[p.method]} · ${esc(accName(p.accountId))} · مندوب: ${esc(p.repName || "—")} · سجّله ${esc(userName(p.recordedBy))}</div>`).join("") : emptyBox("لا دفعات", "cash")}</div></div>
    <div class="card"><div class="card-h"><h3>حركات المخزون المرتبطة</h3></div><div class="card-b">${mvs.length ? mvs.map((m) => `<div class="row between small" style="padding:4px 0"><span>${esc(prodName(m.pid))}</span><span>خروج <b class="num">${m.qty}</b> من ${esc(whName(m.wh))}</span></div>`).join("") + (dn ? `<a class="link small" href="#/print/dn/${dn.id}">سند استلام المواد ${dn.no} (مصنّف «بيع»)</a>` : "") : emptyBox("لا حركات — البيع غير مؤكد")}</div></div>
    <div class="card span3"><div class="card-h"><h3>الخط الزمني وسجل التدقيق</h3></div><div class="card-b">${timelineFor([s.id, ...pays.map((p) => p.id), ap?.entityId].filter(Boolean))}</div></div>
  </div>`;
});

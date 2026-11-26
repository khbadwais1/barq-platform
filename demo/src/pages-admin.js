/* ═══════════ المخزون، المناديب، المستخدمون، الإعدادات، التدقيق، الملف الشخصي ═══════════ */
"use strict";

route("/inventory", ["inventory"], (_, query) => {
  const u = ME;
  const seller = u.role === "SELLER";
  let rows = S.products.map((p) => ({ p, b: balAll(p.id) }));
  if (query.f === "low") rows = rows.filter((r) => r.b.AVAILABLE <= r.p.min);
  if (query.f === "damaged") rows = rows.filter((r) => r.b.DAMAGED + r.b.LOST > 0);
  if (query.f === "maint") rows = rows.filter((r) => r.b.MAINTENANCE > 0);
  const stCls = (r) => (r.b.AVAILABLE === 0 ? "b-red" : r.b.AVAILABLE <= r.p.min ? "b-amber" : "b-green");
  const stLbl = (r) => (r.b.AVAILABLE === 0 ? "نفد" : r.b.AVAILABLE <= r.p.min ? "منخفض" : "متوفر");
  const low = S.products.filter((p) => balAll(p.id).AVAILABLE <= p.min);
  return `${pageHead("المخزون", `${seller ? "المتاح للبيع والتأجير" : "الرصيد لكل حالة — مشتق من دفتر الحركات ويطابقه دائمًا"}${query.f ? ' · <a class="link" href="#/inventory">إزالة الفلتر</a>' : ""}`, u.role === "OWNER" ? `<button class="btn" data-act="adjust">${ic("edit")}تسوية مخزون</button><button class="btn primary" data-act="productForm">${ic("plus")}صنف جديد</button>` : "")}
  ${low.length && !seller ? `<div class="alert warn" style="margin-bottom:14px">${ic("alert")}<div><b>تنبيه مخزون منخفض:</b> ${low.slice(0, 6).map((p) => esc(p.name)).join("، ")}${low.length > 6 ? ` و${low.length - 6} أخرى` : ""} — <a class="link" href="#/inventory?f=low">عرضها</a></div></div>` : ""}
  ${table(
    "inventory",
    [
      { key: "sku", label: "الكود", text: (r) => r.p.sku, render: (r) => `<span class="num">${r.p.sku}</span>` },
      { key: "name", label: "الصنف", text: (r) => r.p.name, render: (r) => `<a class="link" href="#/inventory/${r.p.id}">${esc(r.p.name)}</a>` },
      { key: "cat", label: "الفئة", text: (r) => byId(S.categories, r.p.cat).name },
      { key: "av", label: "المتاح", value: (r) => r.b.AVAILABLE, render: (r) => `<b>${int(r.b.AVAILABLE)}</b>` },
      { key: "res", label: "المحجوز", value: (r) => r.b.RESERVED, render: (r) => int(r.b.RESERVED) },
      { key: "rent", label: "المؤجر", value: (r) => r.b.RENTED, render: (r) => `<span style="color:var(--blue)">${int(r.b.RENTED)}</span>` },
      { key: "sold", label: "المباع", value: (r) => r.b.SOLD, render: (r) => int(r.b.SOLD) },
      { key: "dmg", label: "التالف", value: (r) => r.b.DAMAGED, render: (r) => (r.b.DAMAGED ? `<span style="color:var(--red)">${int(r.b.DAMAGED)}</span>` : "—") },
      { key: "lost", label: "المفقود", value: (r) => r.b.LOST, render: (r) => (r.b.LOST ? `<span style="color:var(--red)">${int(r.b.LOST)}</span>` : "—") },
      { key: "mnt", label: "تحت الصيانة", value: (r) => r.b.MAINTENANCE, render: (r) => (r.b.MAINTENANCE ? `<span style="color:var(--amber)">${int(r.b.MAINTENANCE)}</span>` : "—") },
      { key: "min", label: "الحد الأدنى", value: (r) => r.p.min, render: (r) => int(r.p.min) },
      { key: "price", label: "سعر البيع", value: (r) => r.p.price, render: (r) => money(r.p.price) + (r.p.pricing === "METER" ? " /م" : "") },
      { key: "rd", label: "إيجار يومي/شهري", value: (r) => r.p.rentD, render: (r) => `${money(r.p.rentD)} / ${money(r.p.rentM)}` },
      { key: "st", label: "الحالة", text: stLbl, render: (r) => `<span class="badge ${stCls(r)}">${stLbl(r)}</span>` },
    ],
    rows,
    { sort: "av", dir: "asc", size: 15, rowLink: (r) => "/inventory/" + r.p.id, hidden: seller ? ["dmg", "lost", "mnt", "sold", "min"] : ["rd"], filters: [{ key: "cat", label: "الفئة", options: S.categories.map((c) => [c.id, c.name]), match: (r, v) => r.p.cat === v }, { key: "st", label: "الحالة", options: [["متوفر", "متوفر"], ["منخفض", "منخفض"], ["نفد", "نفد"]], match: (r, v) => stLbl(r) === v }], footer: (c, data) => (["av", "res", "rent", "sold", "dmg", "lost", "mnt"].includes(c.key) ? int(data.reduce((a, r) => a + r.b[{ av: "AVAILABLE", res: "RESERVED", rent: "RENTED", sold: "SOLD", dmg: "DAMAGED", lost: "LOST", mnt: "MAINTENANCE" }[c.key]], 0)) : c.key === "sku" ? "الإجمالي" : "") },
  )}`;
});

const MV_LABEL = { OPENING: "رصيد افتتاحي", PURCHASE_IN: "شراء", SALE_OUT: "بيع", RESERVE: "حجز لعقد", UNRESERVE: "فك حجز", RENTAL_OUT: "تسليم إيجار", RENTAL_RETURN: "مرتجع إيجار", STATE_CHANGE: "تغيير حالة", ADJUSTMENT: "تسوية", SALE_RETURN: "إلغاء بيع (إرجاع للمخزون)" };
route("/inventory/:id", ["inventory"], ({ id }, query) => {
  const p = byId(S.products, id);
  if (!p) return emptyBox("الصنف غير موجود");
  let mvs = S.movements.filter((m) => m.pid === id);
  if (query.customer) mvs = mvs.filter((m) => m.customerId === query.customer && (!query.project || m.projectId === query.project));
  const docLinkOf = (m) => (m.saleId ? `<a class="link num" href="#/sales/${m.saleId}">${byId(S.sales, m.saleId)?.no}</a>` : m.rentalId ? `<a class="link num" href="#/rentals/${m.rentalId}">${byId(S.rentals, m.rentalId)?.no}</a>` : "—");
  const noteOf = (m) => (m.dnId ? `<a class="link num" href="#/print/dn/${m.dnId}">${byId(S.deliveries, m.dnId)?.no}</a>` : m.rnId ? `<a class="link num" href="#/print/rn/${m.rnId}">${byId(S.returns, m.rnId)?.no}</a>` : "");
  return `${pageHead(esc(p.name), `<span class="num">${p.sku}</span> · ${esc(byId(S.categories, p.cat).name)} · ${p.len ? "الطول " + p.len + " م · " : ""}${p.pricing === "METER" ? "يُسعّر بالمتر" : "يُسعّر بالقطعة"}${query.customer ? ` · <b>حركات ${esc(custName(query.customer))}${query.project ? " / " + esc(projName(query.project)) : ""} فقط</b> <a class="link" href="#/inventory/${id}">عرض الكل</a>` : ""}`, ME.role === "OWNER" ? `<button class="btn" data-act="productForm" data-p="${p.id}">${ic("edit")}تعديل الصنف والسعر</button>` : "", `<a href="#/inventory">المخزون</a> / ${esc(p.name)}`)}
  <div class="grid g4">${S.warehouses.map((w) => { const b = bal(p.id, w.id); return `<div class="card card-b"><b>${esc(w.name)}</b><div class="grid g3" style="margin-top:8px;gap:8px">${["AVAILABLE", "RESERVED", "RENTED", "MAINTENANCE", "DAMAGED", "LOST"].map((k) => `<div><div class="xs muted">${STATE_LABEL[k]}</div><b class="num">${nf0.format(b[k])}</b></div>`).join("")}</div></div>`; }).join("")}
  <div class="card card-b"><b>الأسعار الحالية</b><div class="col small" style="gap:3px;margin-top:8px"><div class="row between"><span class="muted">بيع</span><b>${money(p.price)}</b></div><div class="row between"><span class="muted">تكلفة</span><b>${money(p.cost)}</b></div><div class="row between"><span class="muted">إيجار يومي/أسبوعي/شهري</span><b>${money(p.rentD)} / ${money(p.rentW)} / ${money(p.rentM)}</b></div><div class="xs faint">تعديل السعر لا يغيّر أسعار الفواتير السابقة</div></div></div></div>
  <div class="section-title">بطاقة الصنف — الحركات</div>
  ${table("mv-" + id + (query.customer || ""), [
    { key: "at", label: "التاريخ", value: (m) => m.at, render: (m) => `<span class="num">${fmtDT(m.at)}</span>` },
    { key: "type", label: "الحركة", text: (m) => MV_LABEL[m.type] },
    { key: "q", label: "الكمية", value: (m) => m.qty, render: (m) => `<b class="num">${m.qty}</b>` },
    { key: "fromto", label: "من ← إلى", text: (m) => `${m.from ? STATE_LABEL[m.from] : "خارج"} ← ${m.to ? STATE_LABEL[m.to] : "العميل (مباع)"}` },
    { key: "wh", label: "المستودع", text: (m) => whName(m.wh) },
    { key: "c", label: "العميل / المشروع", text: (m) => (m.customerId ? custName(m.customerId) + " / " + projName(m.projectId) : "—") },
    { key: "doc", label: "المستند", search: false, text: () => "", render: docLinkOf },
    { key: "note", label: "السند", search: false, text: () => "", render: noteOf },
    { key: "by", label: "الموظف", text: (m) => userName(m.by) },
    { key: "r", label: "السبب", text: (m) => m.reason || (m.cond ? COND_LABEL[m.cond] : "") },
  ], mvs, { sort: "at" })}`;
});
ACTIONS.productForm = (el) => {
  const p = el.dataset.p ? byId(S.products, el.dataset.p) : null;
  UI.prf = p ? { ...p } : { name: "", family: "", cat: "c1", len: "", pricing: "PIECE", price: 0, cost: 0, rentD: 0, rentW: 0, rentM: 0, min: 0 };
  UI.prf._id = p?.id;
  const mf = (k, label) => `<div class="field"><label>${label}</label><input class="input" id="prf-${k}" value="${UI.prf[k] ? (UI.prf[k] / 100).toFixed(2) : ""}" data-act-input="prfMoney" data-k="${k}"></div>`;
  openModal(p ? "تعديل الصنف — " + esc(p.name) : "صنف جديد", `<div class="form-grid"><div class="field"><label>الاسم *</label><input class="input" id="prf-name" value="${esc(UI.prf.name)}" data-act-input="prfSet" data-k="name"></div><div class="field"><label>العائلة</label><input class="input" id="prf-fam" value="${esc(UI.prf.family)}" data-act-input="prfSet" data-k="family" placeholder="قائم، مرابيع…"></div><div class="field"><label>الفئة</label><select class="select" data-act-change="prfCat">${S.categories.map((c) => `<option value="${c.id}" ${UI.prf.cat === c.id ? "selected" : ""}>${c.name}</option>`).join("")}</select></div><div class="field"><label>الطول (م)</label><input class="input" id="prf-len" value="${UI.prf.len || ""}" data-act-input="prfSet" data-k="len"></div>${mf("price", "سعر البيع")}${mf("cost", "تكلفة الشراء")}${mf("rentD", "إيجار يومي")}${mf("rentW", "إيجار أسبوعي")}${mf("rentM", "إيجار شهري")}<div class="field"><label>الحد الأدنى</label><input class="input" id="prf-min" value="${UI.prf.min}" data-act-input="prfSet" data-k="min"></div></div><div class="alert info" style="margin-top:10px">${ic("info")}<div>صلاحية إضافة/تعديل الأصناف مستقلة عن صلاحية البيع. كود SKU يُولّد فريدًا. الصنف الجديد يبدأ برصيد صفر حتى يُسجَّل له رصيد.</div></div>`, `<button class="btn primary" data-act="prfSave" data-label="حفظ">حفظ</button>`, "wide");
};
ACTIONS.prfSet = (el) => (UI.prf[el.dataset.k] = el.value);
ACTIONS.prfMoney = (el) => (UI.prf[el.dataset.k] = parseMoney(el.value));
ACTIONS.prfCat = (el) => (UI.prf.cat = el.value);
ACTIONS.prfSave = (el) =>
  runAction(el, () => {
    const f = UI.prf;
    if (!f.name.trim()) throw new DomainError("اسم الصنف مطلوب");
    if (f._id) {
      const p = byId(S.products, f._id);
      const before = { price: p.price, rentD: p.rentD, rentM: p.rentM };
      Object.assign(p, { name: f.name, family: f.family || f.name, cat: f.cat, len: f.len ? +f.len : null, price: f.price, cost: f.cost, rentD: f.rentD, rentW: f.rentW, rentM: f.rentM, min: +f.min || 0 });
      audit(ME, "PRODUCT_UPDATE", "Product", p.id, before, { price: p.price, rentD: p.rentD, rentM: p.rentM });
    } else {
      const n = S.products.length + 1;
      const p = { id: uid("p"), sku: `BRQ-${String(n).padStart(3, "0")}`, family: f.family || f.name, cat: f.cat, len: f.len ? +f.len : null, name: f.name, unit: "قطعة", pricing: "PIECE", price: f.price, cost: f.cost, rentD: f.rentD, rentW: f.rentW, rentM: f.rentM, min: +f.min || 0, status: "ACTIVE" };
      S.products.push(p);
      audit(ME, "PRODUCT_CREATE", "Product", p.id, null, { sku: p.sku, name: p.name });
    }
    touch();
    closeModal();
  }, "تم حفظ الصنف");
ACTIONS.adjust = () => {
  UI.adj = { pid: S.products[0].id, wh: "w1", qty: 0, from: "AVAILABLE", to: "", reason: "" };
  openModal("تسوية مخزون", () => `<div class="form-grid"><div class="field"><label>الصنف</label><select class="select" data-act-change="adjSet" data-k="pid">${S.products.map((p) => `<option value="${p.id}" ${UI.adj.pid === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div><div class="field"><label>المستودع</label><select class="select" data-act-change="adjSet" data-k="wh">${S.warehouses.map((w) => `<option value="${w.id}">${esc(w.name)}</option>`).join("")}</select></div><div class="field"><label>من حالة</label><select class="select" data-act-change="adjSet" data-k="from"><option value="">خارج (زيادة رصيد)</option>${STATES.filter((s) => s !== "RENTED" && s !== "RESERVED").map((s) => `<option value="${s}" ${UI.adj.from === s ? "selected" : ""}>${STATE_LABEL[s]} (${bal(UI.adj.pid, UI.adj.wh)[s]})</option>`).join("")}</select></div><div class="field"><label>إلى حالة</label><select class="select" data-act-change="adjSet" data-k="to"><option value="">خارج (نقص/شطب)</option>${STATES.filter((s) => s !== "RENTED" && s !== "RESERVED").map((s) => `<option value="${s}" ${UI.adj.to === s ? "selected" : ""}>${STATE_LABEL[s]}</option>`).join("")}</select></div><div class="field"><label>الكمية</label><input class="input" id="adj-q" data-act-input="adjSet" data-k="qty"></div><div class="field"><label>السبب *</label><input class="input" id="adj-r" data-act-input="adjSet" data-k="reason"></div></div>`, `<button class="btn primary" data-act="adjConfirm">متابعة</button>`);
};
ACTIONS.adjSet = (el) => {
  UI.adj[el.dataset.k] = el.value;
  if (el.tagName === "SELECT") rerenderModal();
};
ACTIONS.adjConfirm = () => {
  const a = UI.adj;
  const q = parseInt(toLatin(a.qty), 10);
  try {
    if (!(q > 0)) throw new DomainError("الكمية غير صالحة");
    if (!a.reason.trim()) throw new DomainError("السبب مطلوب");
    if (a.from === a.to) throw new DomainError("اختر حالتين مختلفتين");
    if (a.from && bal(a.pid, a.wh)[a.from] < q) throw new DomainError("الكمية أكبر من الرصيد — لا يُسمح بمخزون سالب");
  } catch (e) {
    return toast(e.message, "err");
  }
  confirmDialog("تأكيد تسوية المخزون", `سيتم نقل ${q} من «${a.from ? STATE_LABEL[a.from] : "خارج"}» إلى «${a.to ? STATE_LABEL[a.to] : "خارج"}» للصنف ${esc(prodName(a.pid))}. تُسجّل الحركة في الدفتر والتدقيق ولا تُحذف.`, () => {
    move({ type: a.from && a.to ? "STATE_CHANGE" : "ADJUSTMENT", pid: a.pid, wh: a.wh, qty: q, from: a.from || null, to: a.to || null, at: Date.now(), by: ME.id, reason: a.reason });
    audit(ME, "INVENTORY_ADJUST", "Product", a.pid, null, { qty: q, from: a.from, to: a.to, reason: a.reason });
    touch();
    toast("تمت تسوية المخزون");
    render();
  });
};

/* ─── المناديب والمتابعة ─── */
route("/reps", ["reps"], () => {
  const u = ME;
  const mine = u.role === "SELLER" ? S.reps.filter((r) => r.followers.includes(u.id)) : S.reps;
  return `${pageHead(u.role === "SELLER" ? "مناديبي ومتابعاتي" : "دليل المناديب والمتابعة", "المندوب موظف يجلب العملاء — له معرّف مستقل، ويُسند لموظف أو أكثر للمتابعة. يبقى سجل المتابعات والسندات مرتبطًا بمن سجّلها عند النقل.", u.role === "OWNER" ? `<button class="btn primary" data-act="addRep">${ic("plus")}مندوب</button>` : "")}
  <div class="grid g2">${mine
    .map((r) => {
      const custs = S.customers.filter((c) => c.repId === r.id);
      const fus = S.followups.filter((f) => f.repId === r.id).sort((a, b) => b.at - a.at);
      const last = fus[0];
      const next = fus.filter((f) => f.next && !f.done).sort((a, b) => a.next - b.next)[0];
      const coll = S.payments.filter((p) => p.repId === r.id).reduce((a, p) => a + p.amount, 0);
      return `<div class="card"><div class="card-h"><div class="row"><div class="avatar">${esc(r.name[0])}</div><div class="col" style="gap:0"><b>${esc(r.name)}</b><span class="xs muted"><span class="num">${r.code}</span> · <span class="num">${r.mobile}</span> · ${r.userId ? "مرتبط بحساب " + esc(byId(S.users, r.userId).username) : "بدون حساب دخول"}</span></div></div><a class="btn sm" href="#/payments?rep=${r.id}">سنداته</a></div><div class="card-b">
      <div class="grid g3" style="gap:8px"><div><div class="xs muted">العملاء</div><b>${custs.length}</b></div><div><div class="xs muted">تحصيلات باسمه</div><b>${money(coll)}</b></div><div><div class="xs muted">يتابعه</div><b class="small">${r.followers.map((id) => esc(userName(id))).join("، ")}</b></div></div>
      <div class="row between small" style="margin-top:10px"><span class="muted">آخر تواصل</span><b>${last ? `${fmtDate(last.at)} — ${esc(last.outcome)}` : "—"}</b></div>
      <div class="row between small"><span class="muted">الموعد القادم</span><b class="${next && dayNo(next.next) <= dayNo(Date.now()) ? "" : ""}">${next ? `${fmtDate(next.next)} — ${esc(custName(next.customerId))}` : "—"}</b></div>
      <div class="section-title" style="margin:12px 0 6px">العملاء والمشاريع</div>${custs.slice(0, 5).map((c) => `<a class="row between small" style="padding:3px 0" href="#/customers/${c.id}"><span class="link">${esc(c.name)}</span><span class="muted">${S.projects.filter((p) => p.customerId === c.id).map((p) => esc(p.name)).join("، ")}</span></a>`).join("")}${custs.length > 5 ? `<div class="xs muted">و${custs.length - 5} آخرين</div>` : ""}</div></div>`;
    })
    .join("")}</div>`;
});
ACTIONS.addRep = () => {
  UI.rp = { name: "", mobile: "", followers: [] };
  openModal("مندوب جديد", () => `<div class="form-grid"><div class="field"><label>الاسم *</label><input class="input" id="rp-n" data-act-input="rpSet" data-k="name"></div><div class="field"><label>الجوال</label><input class="input" id="rp-m" data-act-input="rpSet" data-k="mobile"></div><div class="field full"><label>موظفو المتابعة</label>${S.users.filter((u) => u.role !== "WAREHOUSE").map((u) => `<label class="row small"><input type="checkbox" data-act-change="rpF" value="${u.id}"> ${esc(u.name)} (${ROLE_LABEL[u.role]})</label>`).join("")}</div></div><div class="hint">لاحظ: يمكن وجود مندوبين بأسماء متشابهة — يُميّزان بالكود والجوال.</div>`, `<button class="btn primary" data-act="rpSave" data-label="حفظ">حفظ</button>`);
};
ACTIONS.rpSet = (el) => (UI.rp[el.dataset.k] = el.value);
ACTIONS.rpF = (el) => (el.checked ? UI.rp.followers.push(el.value) : (UI.rp.followers = UI.rp.followers.filter((x) => x !== el.value)));
ACTIONS.rpSave = (el) =>
  runAction(el, () => {
    if (!UI.rp.name.trim()) throw new DomainError("الاسم مطلوب");
    const r = { id: uid("rep"), code: "REP-" + String(S.reps.length + 1).padStart(2, "0"), name: UI.rp.name.trim(), mobile: normalizeMobile(UI.rp.mobile), userId: null, followers: UI.rp.followers };
    S.reps.push(r);
    audit(ME, "REP_CREATE", "Representative", r.id, null, r);
    touch();
    closeModal();
  }, "تم إضافة المندوب");

/* ─── المستخدمون ─── */
route("/users", ["*"], () => {
  const logins = [...S.logins].sort((a, b) => b.at - a.at).slice(0, 30);
  return `${pageHead("المستخدمون والصلاحيات", "إضافة المستخدمين، إعادة تعيين كلمة المرور، التعطيل، وسجل محاولات الدخول", `<button class="btn primary" data-act="addUser">${ic("plus")}مستخدم</button>`)}
  <div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>الاسم</th><th>اسم المستخدم</th><th>الدور</th><th>آخر دخول</th><th>الحالة</th><th></th></tr></thead><tbody>${S.users.map((u) => `<tr><td class="bold">${esc(u.name)}</td><td class="num">${u.username}</td><td>${ROLE_LABEL[u.role]}</td><td class="num">${fmtDT(u.lastLogin)}</td><td>${u.active ? badge("APPROVED", "نشط") : badge("REJECTED", "معطّل")}</td><td class="row">${u.id !== ME.id ? `<button class="btn sm" data-act="resetPw" data-u="${u.id}">${ic("key")}إعادة تعيين كلمة المرور</button><button class="btn sm ${u.active ? "danger" : ""}" data-act="toggleUser" data-u="${u.id}">${u.active ? "تعطيل" : "تفعيل"}</button>` : '<span class="xs muted">أنت</span>'}</td></tr>`).join("")}</tbody></table></div></div>
  <div class="section-title">سجل محاولات الدخول</div>
  <div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>الوقت</th><th>المستخدم</th><th>النتيجة</th><th>السبب</th><th>IP</th></tr></thead><tbody>${logins.map((l) => `<tr><td class="num">${fmtDT(l.at)}</td><td class="num">${l.username}</td><td>${l.ok ? badge("APPROVED", "ناجح") : badge("REJECTED", "فاشل")}</td><td>${esc(l.reason || "")}</td><td class="num">${l.ip}</td></tr>`).join("")}</tbody></table></div></div>
  <div class="card card-b" style="margin-top:14px"><b>مصفوفة الصلاحيات</b><div class="tbl-wrap" style="margin-top:8px"><table class="tbl"><thead><tr><th>الصلاحية</th>${Object.keys(PERMS).map((r) => `<th>${ROLE_LABEL[r]}</th>`).join("")}</tr></thead><tbody>${[["dash.finance", "لوحة المالية"], ["sales.create", "إنشاء بيع/إيجار"], ["sales.viewAll", "رؤية مبيعات كل البائعين"], ["payments.create", "تسجيل تحصيل"], ["accounts", "أرصدة الصندوق والبنوك"], ["expenses", "المصروفات"], ["rentals.return", "تسجيل كشف دخول"], ["customers.viewAll", "رؤية كل العملاء"]].map(([p, l]) => `<tr><td>${l}</td>${Object.keys(PERMS).map((r) => `<td>${can({ role: r }, p) ? "✔" : "—"}</td>`).join("")}</tr>`).join("")}<tr><td>إدارة الأصناف والأسعار</td><td>✔</td><td>—</td><td>—</td><td>—</td></tr><tr><td>الموافقات والمستخدمون والإعدادات</td><td>✔</td><td>—</td><td>—</td><td>—</td></tr></tbody></table></div></div>`;
});
ACTIONS.resetPw = (el) => {
  const u = byId(S.users, el.dataset.u);
  const pw = String(Math.floor(100000 + Math.random() * 900000));
  confirmDialog("إعادة تعيين كلمة المرور", `ستُنشأ كلمة مرور مؤقتة لـ ${esc(u.name)} ويُطلب منه تغييرها عند الدخول. تنتهي جلساته الحالية.`, () => {
    u.password = pw;
    audit(ME, "PASSWORD_RESET", "User", u.id);
    touch();
    openModal("كلمة المرور المؤقتة", `<div class="alert ok">${ic("key")}<div>كلمة المرور المؤقتة لـ <b>${esc(u.username)}</b>: <b class="num" style="font-size:18px">${pw}</b><br><span class="xs">تُعرض مرة واحدة — في النظام الفعلي تُرسل للموظف بشكل آمن.</span></div></div>`, `<button class="btn" data-act="closeModal">تم</button>`);
  }, { danger: false });
};
ACTIONS.toggleUser = (el) => {
  const u = byId(S.users, el.dataset.u);
  confirmDialog(u.active ? "تعطيل المستخدم" : "تفعيل المستخدم", u.active ? `لن يتمكن ${esc(u.name)} من الدخول وتنتهي جلساته فورًا. سجلاته تبقى كما هي.` : `سيتمكن ${esc(u.name)} من الدخول مجددًا.`, () => {
    u.active = !u.active;
    audit(ME, u.active ? "USER_ENABLE" : "USER_DISABLE", "User", u.id);
    touch();
    toast(u.active ? "تم تفعيل المستخدم" : "تم تعطيل المستخدم");
    render();
  });
};
ACTIONS.addUser = () => {
  UI.nu = { name: "", username: "", role: "SELLER" };
  openModal("مستخدم جديد", () => `<div class="form-grid"><div class="field"><label>الاسم</label><input class="input" id="nu-n" data-act-input="nuSet" data-k="name"></div><div class="field"><label>اسم المستخدم</label><input class="input" id="nu-u" dir="ltr" data-act-input="nuSet" data-k="username"></div><div class="field"><label>الدور</label><select class="select" data-act-change="nuSet" data-k="role">${Object.entries(ROLE_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div></div><div class="hint">تُولّد كلمة مرور مؤقتة ويُطلب تغييرها عند أول دخول.</div>`, `<button class="btn primary" data-act="nuSave" data-label="حفظ">حفظ</button>`);
};
ACTIONS.nuSet = (el) => (UI.nu[el.dataset.k] = el.value);
ACTIONS.nuSave = (el) =>
  runAction(el, () => {
    const f = UI.nu;
    if (!f.name || !/^[a-z0-9_.]{3,}$/.test(f.username)) throw new DomainError("أدخل الاسم واسم مستخدم إنجليزي (3 أحرف على الأقل)");
    if (S.users.some((u) => u.username === f.username)) throw new DomainError("اسم المستخدم مستخدم مسبقًا");
    const pw = String(Math.floor(100000 + Math.random() * 900000));
    const u = { id: uid("u"), username: f.username, name: f.name, role: f.role, active: true, password: pw, lastLogin: null, maxDisc: 5, commission: 2 };
    S.users.push(u);
    audit(ME, "USER_CREATE", "User", u.id, null, { username: u.username, role: u.role });
    touch();
    closeModal();
    setTimeout(() => openModal("تم إنشاء المستخدم", `<div class="alert ok">${ic("key")}<div>كلمة المرور المؤقتة لـ <b>${esc(u.username)}</b>: <b class="num" style="font-size:18px">${pw}</b></div></div>`), 450);
  }, "تم إنشاء المستخدم");

/* ─── الإعدادات ─── */
route("/settings", ["*"], () => {
  const s = S.settings;
  return `${pageHead("الإعدادات", "قيم بداية قابلة للتعديل — تُحفظ النسبة في كل مستند وقت إصداره")}
  <div class="grid g2"><div class="card card-b"><div class="form-grid">
    <div class="field"><label>نسبة ضريبة القيمة المضافة %</label><input class="input" id="st-vat" value="${s.vatRate}" data-act-input="stSet" data-k="vatRate"></div>
    <div class="field"><label>حد اعتماد المصروف (ر.س)</label><input class="input" id="st-exp" value="${s.expenseThreshold / 100}" data-act-input="stMoney" data-k="expenseThreshold"><span class="hint">قيمة بداية مقترحة 5,000</span></div>
    <div class="field"><label>حد خصم البائع %</label><input class="input" id="st-disc" value="${s.sellerMaxDiscountPct}" data-act-input="stSet" data-k="sellerMaxDiscountPct"></div>
    <div class="field"><label>أيام الاستحقاق الافتراضية للآجل</label><input class="input" id="st-cd" value="${s.creditDays}" data-act-input="stSet" data-k="creditDays"></div>
    <div class="field"><label>التنبيه قبل الاستحقاق (أيام)</label><input class="input" id="st-ds" value="${s.dueSoonDays}" data-act-input="stSet" data-k="dueSoonDays"></div>
  </div><button class="btn primary" style="margin-top:14px" data-act="stSave">حفظ الإعدادات</button></div>
  <div class="card card-b"><b>بنود تنتظر اعتماد المؤسسة</b><ul class="small" style="line-height:2">
    <li>تعريف الربح المعروض في لوحة المالك</li><li>سياسة القائمة السوداء ونطاق المنع</li><li>حدود الخصم لكل بائع</li><li>تسعير المدد غير الكاملة (الحالي: بالقطعة × اليوم)</li><li>أثر التلف على التأمين ومن يقرر قيمة التعويض</li><li>شكل المطبوعات النهائي «تعديل وتغير على الورق المرابيع الخ»</li><li>بوابة قراءة للعميل (اختيارية)</li><li>الربط مع منصة فاتورة ZATCA المرحلة الثانية</li></ul></div></div>`;
});
ACTIONS.stSet = (el) => ((UI.stf ||= { ...S.settings })[el.dataset.k] = +toLatin(el.value) || 0);
ACTIONS.stMoney = (el) => ((UI.stf ||= { ...S.settings })[el.dataset.k] = parseMoney(el.value));
ACTIONS.stSave = () => {
  const before = { ...S.settings };
  Object.assign(S.settings, UI.stf || {});
  audit(ME, "SETTINGS_UPDATE", "Setting", "app", before, S.settings);
  UI.stf = null;
  touch();
  toast("تم حفظ الإعدادات");
  render();
};

/* ─── سجل التدقيق ─── */
route("/audit", ["*"], () =>
  `${pageHead("سجل التدقيق", "كل عملية حساسة: المستخدم، الدور، الإجراء، التاريخ، الكيان، قبل/بعد")}${table("audit", [
    { key: "at", label: "الوقت", value: (a) => a.at, render: (a) => `<span class="num">${fmtDT(a.at)}</span>` },
    { key: "u", label: "المستخدم", text: (a) => userName(a.userId) },
    { key: "r", label: "الدور", text: (a) => ROLE_LABEL[a.role] || "" },
    { key: "a", label: "الإجراء", text: (a) => a.action },
    { key: "e", label: "الكيان", text: (a) => a.entity },
    { key: "b", label: "قبل", text: (a) => (a.before ? JSON.stringify(a.before) : ""), render: (a) => `<span class="xs num faint" style="direction:ltr">${esc(a.before ? JSON.stringify(a.before).slice(0, 60) : "")}</span>` },
    { key: "af", label: "بعد", text: (a) => (a.after ? JSON.stringify(a.after) : ""), render: (a) => `<span class="xs num" style="direction:ltr">${esc(a.after ? JSON.stringify(a.after).slice(0, 80) : "")}</span>` },
  ], S.audit, { sort: "at", size: 25, filters: [{ key: "u", label: "المستخدم", options: S.users.map((u) => [u.id, u.name]), match: (a, v) => a.userId === v }] })}`,
);

/* ─── الملف الشخصي ─── */
route("/profile", [], () => {
  const u = ME;
  return `${pageHead("الملف الشخصي", `${esc(u.name)} · ${ROLE_LABEL[u.role]}`)}<div class="grid g2"><div class="card card-b"><b>تغيير كلمة المرور</b><div class="form-grid" style="margin-top:10px"><div class="field full"><label>كلمة المرور الحالية</label><input type="password" class="input" id="pw-old"></div><div class="field"><label>الجديدة (8 أحرف على الأقل)</label><input type="password" class="input" id="pw-new"></div><div class="field"><label>تأكيد</label><input type="password" class="input" id="pw-new2"></div></div><button class="btn primary" style="margin-top:12px" data-act="changePw">تغيير</button></div>
  <div class="card card-b"><b>الجلسة</b><div class="small muted" style="margin-top:8px;line-height:2">آخر دخول: <span class="num">${fmtDT(u.lastLogin)}</span><br>تنتهي الجلسة تلقائيًا بعد 30 دقيقة من عدم النشاط.<br>كلمات المرور تُخزن مجزأة (bcrypt) في النظام الفعلي.</div><button class="btn danger" style="margin-top:12px" data-act="logout">${ic("logout")}تسجيل خروج آمن</button></div></div>`;
});
ACTIONS.changePw = () => {
  const u = ME;
  const o = $("#pw-old").value,
    n = $("#pw-new").value,
    n2 = $("#pw-new2").value;
  if (o !== (u.password || "2026")) return toast("كلمة المرور الحالية غير صحيحة", "err");
  if (n.length < 8) return toast("كلمة المرور الجديدة 8 أحرف على الأقل", "err");
  if (n !== n2) return toast("التأكيد غير مطابق", "err");
  u.password = n;
  audit(u, "PASSWORD_CHANGE", "User", u.id);
  touch();
  toast("تم تغيير كلمة المرور");
  render();
};

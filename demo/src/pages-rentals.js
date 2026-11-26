/* ═══════════ الإيجار: عقد جديد، القائمة، التفاصيل (تسليم / كشف دخول / فوترة / تأمين) ═══════════ */
"use strict";

function rentState(query) {
  if (!UI.rent) UI.rent = { lines: [], wh: "w1", basis: "MONTHLY", periods: 1, mode: "FIXED", discount: 0, deposit: 0, start: isoDay(Date.now()), repId: null, notes: "", q: "", cat: "all", key: newKey("rent") };
  if (query.customer && UI.rent._qc !== query.customer) {
    UI.rent._qc = query.customer;
    UI.rent.customerId = query.customer;
    UI.rent.projectId = query.project || null;
  }
  return UI.rent;
}
route("/rentals/new", ["rentals.create"], (_, query) => {
  const R = rentState(query);
  const lines = R.lines.map((l) => ({ ...l, rate: l.rate ?? rateFor(byId(S.products, l.pid), R.basis) }));
  const est = rentalEstimate(lines, Math.max(1, R.periods), R.discount, S.settings.vatRate);
  const days = R.periods * BASIS_DAYS[R.basis];
  const q = normText(R.q);
  const prods = S.products.filter((p) => p.status === "ACTIVE" && (R.cat === "all" || p.cat === R.cat) && (!q || normText(p.name + " " + p.sku).includes(q)));
  return `${pageHead("إيجار جديد", "عقد بمعدات متعددة — اختر أساس التسعير والمدة؛ يُعرض المبلغ قبل الاعتماد", `<button class="btn" data-act="rentReset">${ic("refresh")}بدء من جديد</button>`)}
  <div class="pos"><div class="col" style="gap:14px">
    ${customerPicker(R, "rent")}
    <div class="card card-b"><div class="form-grid">
      <div class="field"><label>أساس التسعير</label><div class="seg">${["DAILY", "WEEKLY", "MONTHLY"].map((k) => `<button class="${R.basis === k ? "on" : ""}" data-act="rentBasis" data-k="${k}">${BASIS_LABEL[k]}</button>`).join("")}</div><span class="hint">الأسبوع = 7 أيام، الشهر = 30 يومًا. ما زاد عن المدة يُحسب بالقطعة × اليوم.</span></div>
      <div class="field"><label>المدة (${BASIS_UNIT[R.basis]})</label><div class="qty" style="width:max-content"><button data-act="rentPer" data-d="-1">−</button><input id="rper" value="${R.periods}" data-act-input="rentPerIn"><button data-act="rentPer" data-d="1">+</button></div><span class="hint">= ${days} يوم · ينتهي ${fmtDate(parseDay(R.start) + days * DAY)}</span></div>
      <div class="field"><label>نمط الفوترة</label><div class="seg"><button class="${R.mode === "FIXED" ? "on" : ""}" data-act="rentMode" data-k="FIXED">مدة محددة (فاتورة عند العقد)</button><button class="${R.mode === "OPEN" ? "on" : ""}" data-act="rentMode" data-k="OPEN">مفتوح (فوترة دورية)</button></div></div>
      <div class="field"><label>تاريخ البداية</label><input type="date" class="input" value="${R.start}" data-act-change="rentStart"></div>
      <div class="field"><label>المستودع</label><select class="select" data-act-change="rentWh">${S.warehouses.map((w) => `<option value="${w.id}" ${R.wh === w.id ? "selected" : ""}>${esc(w.name)}</option>`).join("")}</select></div>
      <div class="field"><label>المندوب</label><select class="select" data-act-change="rentRep"><option value="">مندوب العميل الافتراضي</option>${S.reps.map((r) => `<option value="${r.id}" ${R.repId === r.id ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select></div>
      <div class="field"><label>التأمين المطلوب (ر.س)</label><input class="input" id="rdep" value="${R.deposit ? (R.deposit / 100).toFixed(2) : ""}" data-act-input="rentDep" placeholder="0.00" inputmode="decimal"><span class="hint">التأمين منفصل عن الإيراد ويُرد أو يُحسم عند الانتهاء</span></div>
      <div class="field"><label>ملاحظات</label><input class="input" id="rnotes" value="${esc(R.notes)}" data-act-input="rentNotes"></div>
    </div></div>
    <div class="card card-b"><div class="row wrap" style="margin-bottom:10px"><div class="search" style="max-width:280px;flex:1"><input class="input" id="rq" placeholder="ابحث عن صنف…" value="${esc(R.q)}" data-act-input="rentQ">${ic("search")}</div></div>
      <div class="cats" style="margin-bottom:12px">${[["all", "الكل"], ...S.categories.map((c) => [c.id, c.name])].map(([k, l]) => `<button class="${R.cat === k ? "on" : ""}" data-act="rentCat" data-k="${k}">${l}</button>`).join("")}</div>
      <div class="sizes" style="padding:0">${prods
        .map((p) => {
          const av = bal(p.id, R.wh).AVAILABLE;
          const n = R.lines.find((l) => l.pid === p.id)?.qty;
          return `<div class="size ${n ? "in" : ""}" data-act="rentAdd" data-p="${p.id}">${n ? `<span class="q">${n}</span>` : ""}<div class="s small">${esc(p.name)}</div><div class="p">${money(rateFor(p, R.basis))} / ${BASIS_UNIT[R.basis]}</div><div class="st ${av === 0 ? "out" : av <= p.min ? "low" : ""}">متاح ${nf0.format(av)}</div></div>`;
        })
        .join("")}</div></div>
  </div>
  <div class="card pos-summary"><div class="card-h"><h3>ملخص العقد</h3><span class="chip">${BASIS_LABEL[R.basis]} · ${R.periods} ${BASIS_UNIT[R.basis]}</span></div><div class="card-b">
    ${lines.length ? lines.map((l, i) => { const p = byId(S.products, l.pid); const av = bal(p.id, R.wh).AVAILABLE; return `<div class="cart-line"><div class="col" style="gap:2px"><b class="small">${esc(p.name)}</b><span class="xs muted row" style="gap:4px">السعر/${BASIS_UNIT[R.basis]} <input class="input" style="width:78px;height:28px" id="rrate-${i}" value="${(l.rate / 100).toFixed(2)}" inputmode="decimal" data-act-input="rentRate" data-i="${i}" title="صفر للأصناف المرافقة المجانية"> × ${R.periods}${l.qty > av ? ` · <span style="color:var(--red)">يتجاوز المتاح (${av})</span>` : ""}</span><span class="qty" style="margin-top:4px"><button data-act="rentQty" data-i="${i}" data-d="-10">−10</button><button data-act="rentQty" data-i="${i}" data-d="-1">−</button><input id="rqty-${i}" value="${l.qty}" data-act-input="rentQtyIn" data-i="${i}"><button data-act="rentQty" data-i="${i}" data-d="1">+</button><button data-act="rentQty" data-i="${i}" data-d="10">+10</button></span></div><div class="col" style="align-items:flex-end"><b>${money(est.lineTotals[i])}</b><button class="btn sm ghost danger" data-act="rentDel" data-i="${i}">${ic("x")}</button></div></div>`; }).join("") : emptyBox("أضف المعدات من القائمة", "key")}
    <div class="sum-row" style="margin-top:8px"><span class="muted">الإجمالي (${R.periods} ${BASIS_UNIT[R.basis]})</span><span>${money(est.gross)}</span></div>
    <div class="sum-row"><span class="muted">خصم</span><input class="input" style="width:110px;height:30px" id="rdisc" value="${R.discount ? (R.discount / 100).toFixed(2) : ""}" placeholder="0.00" data-act-input="rentDisc"></div>
    <div class="sum-row"><span class="muted">الوعاء الضريبي</span><span>${money(est.taxable)}</span></div>
    <div class="sum-row"><span class="muted">ضريبة ${S.settings.vatRate}%</span><span>${money(est.vat)}</span></div>
    <div class="sum-row total"><span>قيمة العقد</span><span>${sar(est.total)}</span></div>
    ${R.deposit ? `<div class="sum-row"><span class="muted">+ تأمين مسترد (ليس إيرادًا)</span><span>${money(R.deposit)}</span></div>` : ""}
    <div class="alert info" style="margin-top:10px">${ic("info")}<div>${R.mode === "FIXED" ? "تصدر فاتورة بقيمة العقد عند الاعتماد. لو بقيت المعدات بعد انتهاء المدة تُفوتر الأيام الزائدة لكل قطعة." : "لا تصدر فاتورة الآن. تُحسب الأجرة يوميًا بالقطعة الموجودة فعليًا بالموقع، وتتوقف أجرة كل قطعة من يوم ردها، وتُفوتر دوريًا."} تُحجز الكميات الآن وتنتقل إلى «مؤجر» عند التسليم.</div></div>
    <button class="btn primary lg" style="width:100%;margin-top:12px" data-act="rentConfirm" data-label="اعتماد العقد">${ic("check")}اعتماد العقد</button>
  </div></div></div>`;
});
Object.assign(ACTIONS, {
  rentCq: (el) => ((UI.rent.cq = el.value), render()),
  rentPickCustomer: (el) => {
    UI.rent.customerId = el.dataset.c;
    const ps = S.projects.filter((p) => p.customerId === el.dataset.c);
    UI.rent.projectId = ps.length === 1 ? ps[0].id : null;
    UI.rent.cq = "";
    render();
  },
  rentClearCustomer: () => ((UI.rent.customerId = null), (UI.rent.projectId = null), render()),
  rentProject: (el) => ((UI.rent.projectId = el.value || null), render()),
  rentBasis: (el) => {
    UI.rent.basis = el.dataset.k;
    UI.rent.lines.forEach((l) => (l.rate = undefined));
    render();
  },
  rentPer: (el) => ((UI.rent.periods = Math.max(1, UI.rent.periods + +el.dataset.d)), render()),
  rentPerIn: (el) => ((UI.rent.periods = Math.max(1, parseInt(toLatin(el.value), 10) || 1)), render()),
  rentMode: (el) => ((UI.rent.mode = el.dataset.k), render()),
  rentStart: (el) => ((UI.rent.start = el.value), render()),
  rentWh: (el) => ((UI.rent.wh = el.value), render()),
  rentRep: (el) => (UI.rent.repId = el.value || null),
  rentDep: (el) => ((UI.rent.deposit = parseMoney(el.value)), render()),
  rentNotes: (el) => (UI.rent.notes = el.value),
  rentQ: (el) => ((UI.rent.q = el.value), render()),
  rentCat: (el) => ((UI.rent.cat = el.dataset.k), render()),
  rentAdd: (el) => {
    const l = UI.rent.lines.find((x) => x.pid === el.dataset.p);
    if (l) l.qty += 1;
    else UI.rent.lines.push({ pid: el.dataset.p, qty: 1 });
    render();
  },
  rentQty: (el) => {
    const l = UI.rent.lines[+el.dataset.i];
    l.qty = Math.max(1, l.qty + +el.dataset.d);
    render();
  },
  rentQtyIn: (el) => ((UI.rent.lines[+el.dataset.i].qty = Math.max(1, parseInt(toLatin(el.value).replace(/\D/g, ""), 10) || 1)), render()),
  rentRate: (el) => ((UI.rent.lines[+el.dataset.i].rate = parseMoney(el.value)), render()),
  rentDel: (el) => (UI.rent.lines.splice(+el.dataset.i, 1), render()),
  rentDisc: (el) => ((UI.rent.discount = parseMoney(el.value)), render()),
  rentReset: () => confirmDialog("بدء عقد جديد", "سيتم تفريغ البيانات المدخلة.", () => ((UI.rent = null), render()), { danger: false }),
  rentConfirm: (el) => {
    const R = UI.rent;
    runAction(
      el,
      () => {
        const res = createRental({ customerId: R.customerId, projectId: R.projectId, wh: R.wh, basis: R.basis, periods: R.periods, mode: R.mode, lines: R.lines.map((l) => ({ pid: l.pid, qty: l.qty, rate: l.rate })), discount: R.discount, deposit: R.deposit, start: parseDay(R.start) + 9 * 3600000, repId: R.repId, notes: R.notes, idemKey: R.key }, ME);
        UI.rent = null;
        location.hash = "#/rentals/" + res.rental.id;
        return res;
      },
      (res) => (res.duplicate ? "هذا العقد سُجل مسبقًا — لم يتكرر" : "تم اعتماد عقد الإيجار وحجز المعدات"),
    );
  },
});

/* ─── قائمة الإيجارات ─── */
route("/rentals", [], (_, query) => {
  const u = ME;
  let rows = S.rentals.filter((r) => canSeeRental(u, r));
  if (query.f === "active") rows = rows.filter((r) => ["ACTIVE", "PARTIALLY_RETURNED"].includes(rentalStatusCalc(r)));
  if (query.f === "late") rows = rows.filter(isRentalOverdue);
  if (query.f === "unsettled") rows = rows.filter((r) => rentalStatusCalc(r) === "RETURNED" && (S.invoices.filter((i) => i.refId === r.id).some((i) => invRemaining(i) > 0) || depositHeld(r.id) > 0));
  const onSite = (r) => r.lines.reduce((a, l) => a + l.delivered - l.returned, 0);
  const toDeliver = S.rentals.filter((r) => canSeeRental(u, r) && r.lines.some((l) => l.delivered < l.qty) && rentalStatusCalc(r) !== "RETURNED");
  return `${pageHead(u.role === "WAREHOUSE" ? "التسليم والمرتجعات" : u.role === "SELLER" ? "إيجاراتي" : "الإيجارات", query.f ? `فلتر: ${{ active: "نشطة بالمواقع", late: "تجاوزت مدتها", unsettled: "غير مسوّاة" }[query.f]} · <a class="link" href="#/rentals">إزالة الفلتر</a>` : `${rows.length} عقد`, can(u, "rentals.create") ? `<a class="btn primary" href="#/rentals/new">${ic("plus")}إيجار جديد</a>` : "")}
  ${toDeliver.length && can(u, "rentals.deliver") ? `<div class="alert info" style="margin-bottom:14px">${ic("truck")}<div><b>${toDeliver.length} عقد ينتظر التسليم</b>: ${toDeliver.slice(0, 4).map((r) => `<a class="link" href="#/rentals/${r.id}">${r.no}</a>`).join(" · ")}</div></div>` : ""}
  ${table(
    "rentals",
    [
      { key: "no", label: "رقم العقد", text: (r) => r.no, render: (r) => `<a class="link num" href="#/rentals/${r.id}">${r.no}</a>` },
      { key: "at", label: "التاريخ", value: (r) => r.at, text: (r) => fmtDate(r.at), render: (r) => dateNum(r.at) },
      { key: "c", label: "العميل", text: (r) => custName(r.customerId) },
      { key: "p", label: "المشروع", text: (r) => projName(r.projectId) },
      { key: "basis", label: "التسعير", text: (r) => `${BASIS_LABEL[r.basis]} × ${r.periods} · ${r.mode === "FIXED" ? "محدد" : "مفتوح"}` },
      { key: "end", label: "نهاية المدة", value: (r) => r.endDay, text: (r) => fmtDate(dayStart(r.endDay)), render: (r) => dateNum(dayStart(r.endDay)) },
      { key: "qty", label: "مسلم / مرتجع", value: (r) => r.lines.reduce((a, l) => a + l.delivered, 0), render: (r) => `${int(r.lines.reduce((a, l) => a + l.delivered, 0))} / ${int(r.lines.reduce((a, l) => a + l.returned, 0))}` },
      { key: "site", label: "بالموقع", value: onSite, render: (r) => `<b>${int(onSite(r))}</b>` },
      { key: "acc", label: "المستحق حتى اليوم", value: rentalAccruedToDate, render: (r) => sar(rentalAccruedToDate(r)) },
      { key: "inv", label: "المفوتر", value: rentalInvoiced, render: (r) => sar(rentalInvoiced(r)) },
      { key: "seller", label: "البائع", text: (r) => userName(r.sellerId) },
      { key: "st", label: "الحالة", text: (r) => (isRentalOverdue(r) ? "متأخر" : BADGES[rentalStatusCalc(r)][0]), render: rentalBadge },
    ],
    rows,
    {
      sort: "at",
      rowLink: (r) => "/rentals/" + r.id,
      hidden: ["seller", "basis"],
      filters: [{ key: "st", label: "الحالة", options: [["RESERVED", "محجوز"], ["ACTIVE", "نشط"], ["PARTIALLY_RETURNED", "مرتجع جزئيًا"], ["RETURNED", "مُسترجع"]], match: (r, v) => rentalStatusCalc(r) === v }],
      footer: (c, data) => (c.key === "site" ? int(data.reduce((a, r) => a + onSite(r), 0)) : c.key === "inv" ? sar(data.reduce((a, r) => a + rentalInvoiced(r), 0)) : c.key === "no" ? "الإجمالي" : ""),
    },
  )}`;
});

/* ─── تفاصيل العقد ─── */
route("/rentals/:id", [], ({ id }) => {
  const r = byId(S.rentals, id);
  if (!r) return emptyBox("العقد غير موجود");
  if (!canSeeRental(ME, r)) throw new DomainError("هذا العقد خارج نطاق صلاحيتك");
  const invs = S.invoices.filter((i) => i.refId === r.id);
  const dns = S.deliveries.filter((d) => d.refId === r.id);
  const rns = S.returns.filter((x) => x.rentalId === r.id);
  const deps = S.deposits.filter((d) => d.rentalId === r.id);
  const st = rentalStatusCalc(r);
  const accrued = rentalAccruedToDate(r);
  const invoiced = rentalInvoiced(r);
  const paid = invs.reduce((a, i) => a + invPaid(i), 0);
  const unb = rentalUnbilled(r);
  const today = dayNo(Date.now());
  const onSite = r.lines.reduce((a, l) => a + l.delivered - l.returned, 0);
  const open = !["CLOSED", "CANCELLED"].includes(r.status);
  const canDeliver = open && can(ME, "rentals.deliver") && r.lines.some((l) => l.delivered < l.qty) && st !== "RETURNED";
  const canClose = open && canAny(ME, "rentals.bill") && onSite === 0 && r.lines.some((l) => l.delivered > 0);
  const canCancel = open && ME.role === "OWNER" && r.lines.every((l) => l.delivered === 0);
  const canReturn = can(ME, "rentals.return") && onSite > 0;
  return `${pageHead(`عقد إيجار ${r.no}`, `${esc(custName(r.customerId))} · مشروع <b>${esc(projName(r.projectId))}</b> · ${BASIS_LABEL[r.basis]} × ${r.periods} ${BASIS_UNIT[r.basis]} (${r.mode === "FIXED" ? "مدة محددة" : "مفتوح"})`, `${rentalBadge(r)}${canDeliver ? `<button class="btn primary" data-act="deliver" data-r="${r.id}">${ic("truck")}تسليم للعميل</button>` : ""}${canReturn ? `<button class="btn primary" data-act="returnNote" data-r="${r.id}">${ic("undo")}كشف دخول (مرتجع)</button>` : ""}${canClose ? `<button class="btn success" data-act="closeRental" data-r="${r.id}">${ic("checkc")}إغلاق العقد</button>` : ""}${canCancel ? `<button class="btn danger" data-act="cancelRental" data-r="${r.id}">${ic("ban")}إلغاء العقد</button>` : ""}${open && can(ME, "rentals.bill") && unb.gross > 0 ? `<button class="btn" data-act="billRental" data-r="${r.id}">${ic("file")}فوترة حتى اليوم (${nf2.format(unb.gross / 100)})</button>` : ""}`, `<a href="#/rentals">الإيجارات</a> / ${r.no}`)}
  ${r.status === "CANCELLED" ? `<div class="alert danger" style="margin-bottom:14px">${ic("ban")}<div><b>العقد ملغى</b> — ${esc(r.cancelReason || "")}. فُك حجز المعدات وأُلغيت فاتورته بإشعار دائن.</div></div>` : ""}${r.status === "CLOSED" ? `<div class="alert ok" style="margin-bottom:14px">${ic("checkc")}<div><b>العقد مغلق</b> في ${fmtDate(r.closedAt)} — رُدت المعدات وفُوترت كل الأيام وفُك حجز ما لم يُسلَّم.</div></div>` : ""}${isRentalOverdue(r) ? `<div class="alert danger" style="margin-bottom:14px">${ic("alert")}<div>انتهت مدة العقد في ${fmtDate(dayStart(r.endDay))} وما زالت ${onSite} قطعة بالموقع — تُحتسب الأيام الزائدة بالقطعة × اليوم.</div></div>` : ""}
  ${st === "RETURNED" && invs.some((i) => invRemaining(i) > 0) ? `<div class="alert warn" style="margin-bottom:14px">${ic("info")}<div><b>المعدات رُدّت بالكامل والعهدة صفر — لكن الدين المالي باقٍ:</b> ${nf2.format(invs.reduce((a, i) => a + invRemaining(i), 0) / 100)} ر.س حتى قبضه.</div></div>` : ""}
  <div class="split-box">
    <div class="card card-b"><div class="row between"><b>${ic("box").replace("<svg", '<svg style="width:16px;height:16px;vertical-align:-3px"')} المعدات (العهدة)</b><span class="chip">قطع</span></div>
      <div class="grid g4" style="margin-top:10px"><div><div class="muted small">مطلوب</div><div class="big-num num">${r.lines.reduce((a, l) => a + l.qty, 0)}</div></div><div><div class="muted small">مسلّم</div><div class="big-num num">${r.lines.reduce((a, l) => a + l.delivered, 0)}</div></div><div><div class="muted small">مرتجع</div><div class="big-num num">${r.lines.reduce((a, l) => a + l.returned, 0)}</div></div><div><div class="muted small">بالموقع الآن</div><div class="big-num num" style="color:var(--brand)">${onSite}</div></div></div></div>
    <div class="card card-b"><div class="row between"><b>${ic("wallet").replace("<svg", '<svg style="width:16px;height:16px;vertical-align:-3px"')} المال</b><span class="chip">ر.س</span></div>
      <div class="grid g4" style="margin-top:10px"><div><div class="muted small">قيمة العقد</div><div class="bold">${money(r.est.total)}</div></div><div><div class="muted small">المستحق حتى اليوم</div><div class="bold">${money(accrued + Math.round((accrued * r.rate) / 100))}</div><div class="xs faint">قبل الضريبة ${money(accrued)}</div></div><div><div class="muted small">المفوتر / المدفوع</div><div class="bold">${money(invoiced)} / ${money(paid)}</div></div><div><div class="muted small">المتبقي على الفواتير</div><div class="bold" style="color:var(--red)">${money(invoiced - paid)}</div></div></div></div>
  </div>
  <div class="card" style="margin-top:14px"><div class="card-h"><h3>بنود العقد — الكمية المعلّقة على كل بند</h3></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>الصنف</th><th>السعر / ${BASIS_UNIT[r.basis]}</th><th>مطلوب</th><th>مسلّم</th><th>مرتجع</th><th>بالموقع</th><th>قطعة × يوم حتى اليوم</th><th>المستحق</th><th>مفوتر حتى</th></tr></thead><tbody>${r.lines
    .map((l, i) => {
      const ev = lineEvents(r.id, i);
      const first = ev.length ? Math.min(...ev.map((e) => e.day)) : today;
      const pd = pieceDays(ev, first, today + 1);
      return `<tr><td><a class="link" href="#/inventory/${l.pid}">${esc(l.name)}</a></td><td>${money(l.rate)}</td><td>${int(l.qty)}</td><td>${int(l.delivered)}</td><td>${int(l.returned)}</td><td><b>${int(l.delivered - l.returned)}</b></td><td>${int(pd)}</td><td>${money(Math.round((pd * l.rate) / BASIS_DAYS[r.basis]))}</td><td>${l.billedThrough ? dateNum(dayStart(l.billedThrough)) : "—"}</td></tr>`;
    })
    .join("")}</tbody></table></div></div>
  <div class="grid g3" style="margin-top:14px">
    <div class="card"><div class="card-h"><h3>سندات استلام المواد (تأجير)</h3></div><div class="card-b">${dns.map((d) => `<a class="row between" style="padding:5px 0" href="#/print/dn/${d.id}"><span class="link num">${d.no}</span><span class="small">${int(d.lines.reduce((a, l) => a + l.count, 0))} قطعة · ${dateNum(d.at)}</span></a>`).join("") || emptyBox("لم يتم التسليم بعد", "truck")}</div></div>
    <div class="card"><div class="card-h"><h3>كشوف الدخول (المرتجعات)</h3></div><div class="card-b">${rns.map((x) => `<a class="row between" style="padding:5px 0" href="#/print/rn/${x.id}"><span class="link num">${x.no}</span><span class="small">${int(x.lines.reduce((a, l) => a + l.qty, 0))} قطعة · ${dateNum(x.at)}${x.fee ? ` · صيانة ${money(x.fee)}` : ""}</span></a><div class="xs muted">${x.lines.map((l) => `${esc(l.name)}: ${l.qty} ${COND_LABEL[l.cond]}`).join(" · ")}</div>`).join("") || emptyBox("لا مرتجعات", "undo")}</div></div>
    <div class="card"><div class="card-h"><h3>الفواتير</h3></div><div class="card-b">${invs.map((i) => `<a class="row between" style="padding:5px 0" href="#/invoices/${i.id}"><span><span class="link num">${i.no}</span> <span class="xs muted">${i.kind === "FEES" ? "رسوم صيانة" : i.periodFrom ? `${fmtDate(i.periodFrom)} ← ${fmtDate(i.periodTo)}` : ""}</span></span><span>${money(i.total)} ${badge(invStatus(i))}</span></a>`).join("") || emptyBox("لا فواتير بعد", "file")}</div></div>
    <div class="card"><div class="card-h"><h3>التأمين</h3>${can(ME, "deposits") ? `<div class="row"><button class="btn sm" data-act="deposit" data-r="${r.id}" data-k="RECEIVED">قبض</button>${depositHeld(r.id) > 0 ? `<button class="btn sm" data-act="deposit" data-r="${r.id}" data-k="REFUNDED">رد</button><button class="btn sm danger" data-act="deposit" data-r="${r.id}" data-k="FORFEITED">حسم</button>` : ""}</div>` : ""}</div><div class="card-b"><div class="row between"><span class="muted">المطلوب</span><b>${sar(r.deposit)}</b></div><div class="row between"><span class="muted">المحتفظ به الآن</span><b>${sar(depositHeld(r.id))}</b></div>${deps.map((d) => `<div class="xs muted" style="margin-top:4px">${{ RECEIVED: "قبض", REFUNDED: "رد", FORFEITED: "حسم" }[d.kind]} ${money(d.amount)} · ${esc(accName(d.accountId))} · ${fmtDate(d.at)}</div>`).join("")}<div class="xs faint" style="margin-top:6px">التأمين التزام على المؤسسة وليس إيرادًا.</div></div></div>
    <div class="card"><div class="card-h"><h3>البيانات</h3></div><div class="card-b col" style="gap:6px"><div class="row between"><span class="muted">العميل</span><a class="link" href="#/customers/${r.customerId}?project=${r.projectId}">${esc(custName(r.customerId))}</a></div><div class="row between"><span class="muted">البائع</span><b>${esc(userName(r.sellerId))}</b></div><div class="row between"><span class="muted">المندوب</span><b>${esc(byId(S.reps, r.repId)?.name || "—")}</b></div><div class="row between"><span class="muted">البداية / النهاية</span><b class="num">${fmtDate(dayStart(r.startDay))} — ${fmtDate(dayStart(r.endDay))}</b></div><div class="row between"><span class="muted">المستودع</span><b>${esc(whName(r.wh))}</b></div></div></div>
    <div class="card"><div class="card-h"><h3>الخط الزمني</h3></div><div class="card-b">${timelineFor([r.id])}</div></div>
  </div>`;
});

function deliverModal(r) {
  const st = (UI.dl ||= { r: r.id, qty: r.lines.map((l) => l.qty - l.delivered), driver: "", receiver: "", key: newKey("dl") });
  return `<div class="alert info" style="margin-bottom:12px">${ic("truck")}<div>يُنشأ سند استلام مواد مصنّف «تأجير» مرتبط بالعقد، وتنتقل الكميات من «محجوز» إلى «مؤجر» وتدخل عهدة مشروع <b>${esc(projName(r.projectId))}</b>.</div></div>
  <table class="tbl"><thead><tr><th>الصنف</th><th>المتبقي للتسليم</th><th>الكمية المسلمة الآن</th></tr></thead><tbody>${r.lines.map((l, i) => `<tr><td>${esc(l.name)}</td><td>${int(l.qty - l.delivered)}</td><td><input class="input" style="width:100px;height:32px" id="dlq-${i}" value="${st.qty[i]}" data-act-input="dlQty" data-i="${i}"></td></tr>`).join("")}</tbody></table>
  <div class="form-grid" style="margin-top:12px"><div class="field"><label>اسم السائق</label><input class="input" id="dldrv" value="${esc(st.driver)}" data-act-input="dlDriver"></div><div class="field"><label>المستلم بالموقع</label><input class="input" id="dlrcv" value="${esc(st.receiver)}" data-act-input="dlRcv"></div><div class="field"><label>أجرة النقل (ر.س، قبل الضريبة)</label><input class="input" id="dltr" value="${st.transport ? (st.transport / 100).toFixed(2) : ""}" placeholder="0.00" inputmode="decimal" data-act-input="dlTr"><span class="hint">تصدر بها فاتورة «نقل» مستقلة وتظهر بندًا في كشف الحساب</span></div></div>`;
}
function returnModal(r) {
  const st = (UI.rn ||= { r: r.id, rows: r.lines.map((l, i) => ({ idx: i, good: 0, maint: 0, damaged: 0, lost: 0 })), fee: 0, driver: "", gate: "", key: newKey("rn") });
  return `<div class="alert info" style="margin-bottom:12px">${ic("undo")}<div>سجّل لكل بند الكمية وحالتها. لا يُقبل مرتجع أكبر من الموجود بالموقع. السليم يعود «متاح»، وما يحتاج صيانة/التالف/المفقود يُسجل بحالته ليقرر المالك تسويته. رد جزء من الشحنة لا يقفل العقد.</div></div>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>الصنف</th><th>بالموقع</th><th>سليم</th><th>يحتاج صيانة</th><th>تالف</th><th>مفقود</th></tr></thead><tbody>${r.lines
    .map((l, i) => {
      const row = st.rows[i];
      const onSite = l.delivered - l.returned;
      const inp = (k) => `<input class="input" style="width:74px;height:32px" id="rn-${k}-${i}" value="${row[k] || ""}" placeholder="0" data-act-input="rnQty" data-i="${i}" data-k="${k}">`;
      return `<tr><td>${esc(l.name)}</td><td><b>${int(onSite)}</b></td><td>${inp("good")}</td><td>${inp("maint")}</td><td>${inp("damaged")}</td><td>${inp("lost")}</td></tr>`;
    })
    .join("")}</tbody></table></div>
  <div class="form-grid" style="margin-top:12px"><div class="field"><label>مبلغ الصيانة/التعويض (قبل الضريبة)</label><input class="input" id="rnfee" value="${st.fee ? (st.fee / 100).toFixed(2) : ""}" placeholder="0.00" data-act-input="rnFee"><span class="hint">يصدر به فاتورة رسوم مستقلة على العميل</span></div><div class="field"><label>السائق</label><input class="input" id="rndrv" value="${esc(st.driver)}" data-act-input="rnDriver"></div><div class="field"><label>مسؤول البوابة</label><input class="input" id="rngate" value="${esc(st.gate)}" data-act-input="rnGate"></div><div class="field"><label>أجرة نقل المرتجع (قبل الضريبة)</label><input class="input" id="rntr" value="${st.transport ? (st.transport / 100).toFixed(2) : ""}" placeholder="0.00" inputmode="decimal" data-act-input="rnTr"></div><div class="field"><label>مسؤول العدد</label><input class="input" value="${esc(ME.name)}" disabled></div></div>`;
}
Object.assign(ACTIONS, {
  deliver: (el) => {
    const r = byId(S.rentals, el.dataset.r);
    UI.dl = null;
    openModal(`تسليم معدات — ${r.no}`, () => deliverModal(r), `<button class="btn primary" data-act="dlSave" data-label="تأكيد التسليم">${ic("check")}تأكيد التسليم</button><button class="btn" data-act="closeModal">إلغاء</button>`, "wide");
  },
  dlQty: (el) => (UI.dl.qty[+el.dataset.i] = parseInt(toLatin(el.value).replace(/\D/g, ""), 10) || 0),
  dlDriver: (el) => (UI.dl.driver = el.value),
  dlRcv: (el) => (UI.dl.receiver = el.value),
  dlTr: (el) => (UI.dl.transport = parseMoney(el.value)),
  dlSave: (el) =>
    runAction(
      el,
      () => {
        const d = UI.dl;
        const res = deliverRental(d.r, { lines: d.qty.map((q, idx) => ({ idx, qty: q })), driver: d.driver, receiver: d.receiver, transport: d.transport, idemKey: d.key }, ME);
        closeModal();
        return res;
      },
      (res) => (res.duplicate ? "التسليم مسجل مسبقًا — لم يتكرر" : `تم التسليم — سند ${res.dn.no}${res.dn.transport ? " وفاتورة النقل" : ""}`),
    ),
  returnNote: (el) => {
    const r = byId(S.rentals, el.dataset.r);
    UI.rn = null;
    openModal(`كشف دخول (مرتجع) — ${r.no}`, () => returnModal(r), `<button class="btn primary" data-act="rnSave" data-label="حفظ كشف الدخول">${ic("check")}حفظ كشف الدخول</button><button class="btn" data-act="closeModal">إلغاء</button>`, "wide");
  },
  rnQty: (el) => (UI.rn.rows[+el.dataset.i][el.dataset.k] = parseInt(toLatin(el.value).replace(/\D/g, ""), 10) || 0),
  rnFee: (el) => (UI.rn.fee = parseMoney(el.value)),
  rnDriver: (el) => (UI.rn.driver = el.value),
  rnGate: (el) => (UI.rn.gate = el.value),
  rnTr: (el) => (UI.rn.transport = parseMoney(el.value)),
  rnSave: (el) =>
    runAction(
      el,
      () => {
        const st = UI.rn;
        const lines = [];
        const map = { good: "GOOD", maint: "MAINTENANCE", damaged: "DAMAGED", lost: "LOST" };
        st.rows.forEach((row) => Object.entries(map).forEach(([k, c]) => row[k] > 0 && lines.push({ idx: row.idx, qty: row[k], cond: c })));
        const res = returnRental(st.r, { lines, fee: st.fee, transport: st.transport, driver: st.driver, gate: st.gate, counter: ME.name, idemKey: st.key }, ME);
        closeModal();
        return res;
      },
      (res) => (res.duplicate ? "كشف الدخول مسجل مسبقًا — لم يتكرر" : `تم حفظ كشف الدخول ${res.rn.no}${res.feeInvoice ? " وإصدار فاتورة الصيانة" : ""}`),
    ),
  closeRental: (el) => {
    const r = byId(S.rentals, el.dataset.r);
    const unb = rentalUnbilled(r).gross;
    const rest = r.lines.reduce((a, l) => a + l.qty - l.delivered, 0);
    confirmDialog("إغلاق العقد", `كل المعدات رُدت.${unb ? ` ستصدر فاتورة أخيرة بـ ${nf2.format(unb / 100)} ر.س + الضريبة عن الأيام غير المفوترة.` : ""}${rest ? ` ويُفك حجز ${rest} قطعة لم تُسلَّم.` : ""} يبقى الدين المالي قائمًا حتى قبضه.`, () => runAction(null, () => closeRental(r.id, ME), (res) => "تم إغلاق العقد" + (res.bill ? " وصدرت الفاتورة " + res.bill.no : "")), { danger: false, yes: "إغلاق العقد" });
  },
  cancelRental: (el) => {
    const r = byId(S.rentals, el.dataset.r);
    UI.cancelR = { id: r.id, reason: "" };
    openModal("إلغاء العقد " + r.no, () => `<div class="alert danger">${ic("alert")}<div>يُفك حجز كل المعدات وتُلغى فاتورة العقد بإشعار دائن. لا يُسمح بالإلغاء إن سُلّم شيء أو دُفع من الفاتورة أو قُبض تأمين.</div></div><div class="field" style="margin-top:10px"><label>سبب الإلغاء *</label><input class="input" id="cr-reason" data-act-input="crReason" value="${esc(UI.cancelR.reason)}"></div>`, `<button class="btn danger" data-act="crSave" data-label="تأكيد الإلغاء">تأكيد الإلغاء</button><button class="btn" data-act="closeModal">تراجع</button>`);
  },
  crReason: (el) => (UI.cancelR.reason = el.value),
  crSave: (el) => runAction(el, () => { const r = cancelRental(UI.cancelR.id, UI.cancelR.reason.trim(), ME); closeModal(); return r; }, "تم إلغاء العقد وفك الحجز"),
  billRental: (el) => {
    const r = byId(S.rentals, el.dataset.r);
    const unb = rentalUnbilled(r);
    confirmDialog(
      "فوترة الإيجار حتى اليوم",
      `ستصدر فاتورة بقيمة ${nf2.format(unb.gross / 100)} ر.س + ضريبة ${S.settings.vatRate}% عن ${unb.parts.reduce((a, p) => a + p.pd, 0)} قطعة×يوم غير مفوترة.`,
      () => runAction(null, () => billRental(r.id, ME), (inv) => `صدرت الفاتورة ${inv.no}`),
      { danger: false, yes: "إصدار الفاتورة" },
    );
  },
  deposit: (el) => {
    const r = byId(S.rentals, el.dataset.r);
    const k = el.dataset.k;
    UI.depForm = { amount: k === "RECEIVED" ? Math.max(0, r.deposit - depositHeld(r.id)) : depositHeld(r.id), accountId: "a-cash" };
    openModal(
      { RECEIVED: "قبض تأمين", REFUNDED: "رد تأمين للعميل", FORFEITED: "حسم من التأمين" }[k] + " — " + r.no,
      () => `<div class="form-grid"><div class="field"><label>المبلغ</label><input class="input" id="depamt" value="${(UI.depForm.amount / 100).toFixed(2)}" data-act-input="depAmt"></div><div class="field"><label>الحساب</label><select class="select" data-act-change="depAcc">${S.accounts.map((a) => `<option value="${a.id}" ${UI.depForm.accountId === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select></div></div><div class="alert info" style="margin-top:10px">${ic("info")}<div>التأمين منفصل عن فاتورة الإيجار. ${k === "FORFEITED" ? "الحسم يُعتمد بمستند (مثل كشف دخول بتلف) ويُسجّل في التدقيق." : ""}</div></div>`,
      `<button class="btn primary" data-act="depSave" data-r="${r.id}" data-k="${k}" data-label="حفظ">حفظ</button><button class="btn" data-act="closeModal">إلغاء</button>`,
    );
  },
  depAmt: (el) => (UI.depForm.amount = parseMoney(el.value)),
  depAcc: (el) => (UI.depForm.accountId = el.value),
  depSave: (el) =>
    runAction(
      el,
      () => {
        const d = rentalDeposit(el.dataset.r, { kind: el.dataset.k, amount: UI.depForm.amount, accountId: UI.depForm.accountId }, ME);
        closeModal();
        return d;
      },
      "تم تسجيل حركة التأمين",
    ),
});

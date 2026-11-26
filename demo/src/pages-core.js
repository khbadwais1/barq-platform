/* ═══════════ الصفحات: الدخول، اللوحات ═══════════ */
"use strict";

function loginPage() {
  const err = UI.loginErr || "";
  const expired = UI.sessionExpired;
  UI.sessionExpired = false;
  return `<div class="login">
    <div class="login-art">
      <div class="row" style="position:relative"><div class="logo" style="width:46px;height:46px;font-size:26px">B</div><div><b style="font-size:18px">سقالات البرق</b><div class="small" style="color:#a9b8ee">${COMPANY.tagline}</div></div></div>
      <div style="position:relative;max-width:520px"><h2>من البائع إلى الفاتورة والتحصيل ولوحة المالك — في نظام واحد مترابط.</h2>
      <p style="color:#c7d2fe;font-size:15px">كل عملية بيع أو إيجار تولّد مستنداتها، وتحدّث المخزون وعهدة كل مشروع، وتظهر فورًا للمالية والمالك.</p>
      <div class="row wrap" style="gap:10px;margin-top:22px">${["عهدة كل مشروع بالقطعة", "فاتورة ضريبية 15%", "سند قبض باسم المندوب", "يومية الصندوق تلقائيًا"].map((t) => `<span class="chip" style="background:rgba(255,255,255,.1);color:#e0e7ff">${ic("check")}${t}</span>`).join("")}</div></div>
      <div class="small" style="color:#8ea0dd;position:relative">${COMPANY.address}</div>
    </div>
    <div class="login-form"><form class="login-box" onsubmit="event.preventDefault();ACTIONS.login()">
      <div class="login-brand-m"><div class="logo">B</div><div><b>سقالات البرق</b><div class="xs muted">${COMPANY.tagline}</div></div></div><h1 style="font-size:24px;margin:0 0 4px">تسجيل الدخول</h1><div class="muted" style="margin-bottom:22px">أدخل اسم المستخدم وكلمة المرور</div>
      ${expired ? `<div class="alert warn" style="margin-bottom:12px">${ic("clock")}<div>انتهت الجلسة بسبب عدم النشاط. سجّل الدخول مرة أخرى.</div></div>` : ""}
      ${err ? `<div class="alert danger" style="margin-bottom:12px">${ic("alert")}<div>${esc(err)}</div></div>` : ""}
      <div class="field" style="margin-bottom:12px"><label>اسم المستخدم</label><input class="input" id="lu" autocomplete="username" dir="ltr" style="text-align:right" value="${esc(UI.loginUser || "")}"></div>
      <div class="field" style="margin-bottom:18px"><label>كلمة المرور</label><input class="input" id="lp" type="password" autocomplete="current-password" dir="ltr" style="text-align:right"></div>
      <button class="btn primary lg" style="width:100%" type="submit">دخول</button>
      <div class="section-title" style="margin-top:26px">حسابات العرض (كلمة المرور 2026)</div>
      <div class="demo-users">${S.users.map((u) => `<button type="button" data-act="demoLogin" data-u="${u.username}"><b class="small">${esc(u.name)}</b><div class="xs muted">${ROLE_LABEL[u.role]} · <span class="num">${u.username}</span></div></button>`).join("")}</div>
    </form></div></div>`;
}
Object.assign(ACTIONS, {
  noop: () => {},
  login: () => {
    const u = $("#lu").value,
      p = $("#lp").value;
    UI.loginUser = u;
    UI.loginErr = doLogin(u, p) || "";
    if (UI.loginErr) render();
  },
  demoLogin: (el) => {
    UI.loginErr = doLogin(el.dataset.u, byId(S.users, S.users.find((x) => x.username === el.dataset.u).id).password || "2026") || "";
    if (UI.loginErr) render();
  },
});

function forbiddenPage(msg) {
  return `<div class="content"><div class="card card-b" style="text-align:center;padding:60px 20px">${ic("shield")
    .replace("<svg", '<svg style="width:48px;height:48px;color:var(--red)"')}<h2 style="margin:12px 0 6px">403 — غير مصرح</h2><div class="muted">${esc(msg || "ليس لديك صلاحية للوصول إلى هذه الصفحة. الرفض يتم في الخادم حتى لو كُتب الرابط يدويًا.")}</div><a class="btn primary" style="margin-top:16px" href="#${ROLE_HOME[ME.role]}">العودة للوحتي</a></div></div>`;
}
function pageHead(title, sub, actions = "", crumbs = "") {
  return `<div class="page-head"><div>${crumbs ? `<div class="crumbs">${crumbs}</div>` : ""}<h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ""}</div><div class="row wrap">${actions}</div></div>`;
}

/* ─── مقاييس مشتركة ─── */
function metrics(p, filter = {}) {
  const sellerOk = (x) => !filter.sellerId || x.sellerId === filter.sellerId;
  const invs = S.invoices.filter((i) => i.status !== "CANCELLED" && sellerOk(i));
  const inP = (t) => inRange(t, p.from, p.to);
  const inPrev = (t) => inRange(t, p.prevFrom, p.prevTo);
  const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
  const salesInv = invs.filter((i) => i.kind === "SALE");
  const rentInv = invs.filter((i) => i.kind !== "SALE");
  const pays = S.payments.filter((x) => x.status !== "VOID" && (!filter.sellerId || x.allocations.some((a) => byId(S.invoices, a.invoiceId)?.sellerId === filter.sellerId)));
  const payAmt = (x) => (filter.sellerId ? x.allocations.filter((a) => byId(S.invoices, a.invoiceId)?.sellerId === filter.sellerId).reduce((s, a) => s + a.amount, 0) : x.amount);
  const exps = S.expenses.filter((e) => e.status === "APPROVED");
  const txs = transactions();
  const sales = S.sales.filter((s) => s.status === "CONFIRMED" && sellerOk(s));
  return {
    salesBilled: sum(salesInv.filter((i) => inP(i.at)), (i) => i.total),
    salesBilledPrev: sum(salesInv.filter((i) => inPrev(i.at)), (i) => i.total),
    salesTaxable: sum(salesInv.filter((i) => inP(i.at)), (i) => i.taxable),
    rentBilled: sum(rentInv.filter((i) => inP(i.at)), (i) => i.total),
    rentBilledPrev: sum(rentInv.filter((i) => inPrev(i.at)), (i) => i.total),
    rentTaxable: sum(rentInv.filter((i) => inP(i.at)), (i) => i.taxable),
    salesCount: sales.filter((s) => inP(s.at)).length,
    salesCountPrev: sales.filter((s) => inPrev(s.at)).length,
    cogs: sum(sales.filter((s) => inP(s.at)), (s) => s.cost),
    collected: sum(pays.filter((x) => inP(x.at)), payAmt),
    collectedPrev: sum(pays.filter((x) => inPrev(x.at)), payAmt),
    expenses: sum(exps.filter((e) => inP(e.postedAt)), (e) => e.amount),
    expensesPrev: sum(exps.filter((e) => inPrev(e.postedAt)), (e) => e.amount),
    cashIn: sum(txs.filter((t) => t.dir === "IN" && inP(t.at)), (t) => t.amount),
    cashOut: sum(txs.filter((t) => t.dir === "OUT" && inP(t.at)), (t) => t.amount),
    cashInPrev: sum(txs.filter((t) => t.dir === "IN" && inPrev(t.at)), (t) => t.amount),
    cashOutPrev: sum(txs.filter((t) => t.dir === "OUT" && inPrev(t.at)), (t) => t.amount),
    receivable: sum(invs, invRemaining),
    overdue: invs.filter((i) => invStatus(i) === "OVERDUE"),
    newCustomers: S.customers.filter((c) => inP(c.at) && (!filter.sellerId || c.createdBy === filter.sellerId)).length,
    newCustomersPrev: S.customers.filter((c) => inPrev(c.at) && (!filter.sellerId || c.createdBy === filter.sellerId)).length,
  };
}
function dailySeries(p, fn) {
  const d0 = dayNo(p.from),
    d1 = dayNo(p.to - 1);
  const n = Math.max(1, d1 - d0 + 1);
  const labels = [],
    idx = {};
  for (let i = 0; i < n; i++) {
    const t = dayStart(d0 + i);
    labels.push(fmtDate(t).slice(0, 5));
    idx[d0 + i] = i;
  }
  return { labels, idx, n, values: () => new Array(n).fill(0) };
}
function agingBuckets(invs) {
  const b = [
    ["غير مستحق", 0, "#64748b"],
    ["1–30 يوم", 0, "#e0902a"],
    ["31–60 يوم", 0, "#d97706"],
    ["61–90 يوم", 0, "#dc2626"],
    ["+90 يوم", 0, "#991b1b"],
  ];
  const today = dayNo(Date.now());
  for (const i of invs) {
    const rem = invRemaining(i);
    if (rem <= 0) continue;
    const late = today - dayNo(i.due);
    const k = late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : late <= 90 ? 3 : 4;
    b[k][1] += rem;
  }
  return b.map(([label, value, color]) => ({ label, value, color }));
}
function sellerRanking(p) {
  return S.users
    .filter((u) => u.role === "SELLER")
    .map((u) => {
      const m = metrics(p, { sellerId: u.id });
      const mine = S.invoices.filter((i) => i.sellerId === u.id && i.status !== "CANCELLED");
      const count = m.salesCount + S.rentals.filter((r) => r.sellerId === u.id && inRange(r.at, p.from, p.to)).length;
      const value = m.salesBilled + m.rentBilled;
      const prevValue = m.salesBilledPrev + m.rentBilledPrev;
      return {
        u,
        count,
        value,
        collected: m.collected,
        remaining: mine.filter((i) => inRange(i.at, p.from, p.to)).reduce((a, i) => a + invRemaining(i), 0),
        newCustomers: m.newCustomers,
        avg: count ? Math.round(value / count) : 0,
        growth: prevValue > 0 ? ((value - prevValue) / prevValue) * 100 : null,
        commission: Math.round((m.salesTaxable + m.rentTaxable) * ((u.commission || 0) / 100)),
      };
    });
}

/* ═════════ لوحة المالك ═════════ */
route("/owner/dashboard", ["*"], () => {
  const p = period();
  const m = metrics(p);
  const cash = S.accounts.filter((a) => a.type === "CASH").reduce((x, a) => x + accountBalance(a.id), 0);
  const bank = S.accounts.filter((a) => a.type === "BANK").reduce((x, a) => x + accountBalance(a.id), 0);
  const today = dayNo(Date.now());
  const salesToday = S.invoices.filter((i) => i.kind === "SALE" && i.status !== "CANCELLED" && dayNo(i.at) === today).reduce((a, i) => a + i.total, 0);
  const now = new Date(Date.now() + RIYADH);
  const mStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - RIYADH;
  const salesMonth = S.invoices.filter((i) => i.kind === "SALE" && i.status !== "CANCELLED" && i.at >= mStart).reduce((a, i) => a + i.total, 0);
  const collToday = S.payments.filter((x) => dayNo(x.at) === today).reduce((a, x) => a + x.amount, 0);
  const collMonth = S.payments.filter((x) => x.at >= mStart).reduce((a, x) => a + x.amount, 0);
  const activeR = S.rentals.filter((r) => ["ACTIVE", "PARTIALLY_RETURNED"].includes(rentalStatusCalc(r)));
  const lateR = S.rentals.filter(isRentalOverdue);
  const rentedPieces = S.products.reduce((a, pr) => a + balAll(pr.id).RENTED, 0);
  const invValue = S.products.reduce((a, pr) => {
    const b = balAll(pr.id);
    return a + (b.AVAILABLE + b.RESERVED + b.RENTED + b.MAINTENANCE) * pr.cost;
  }, 0);
  const totals = S.products.reduce(
    (acc, pr) => {
      const b = balAll(pr.id);
      for (const k in acc) acc[k] += b[k];
      return acc;
    },
    { AVAILABLE: 0, RESERVED: 0, RENTED: 0, DAMAGED: 0, LOST: 0, MAINTENANCE: 0 },
  );
  const low = S.products.filter((pr) => balAll(pr.id).AVAILABLE <= pr.min);
  const revenue = m.salesTaxable + m.rentTaxable;
  const gross = m.salesTaxable - m.cogs + m.rentTaxable;
  const profit = gross - m.expenses;
  const rank = sellerRanking(p);
  const sortKey = UI.rankSort || "value";
  rank.sort((a, b) => (b[sortKey] ?? -1e15) - (a[sortKey] ?? -1e15));
  const topCustomer = Object.entries(
    S.invoices.filter((i) => inRange(i.at, p.from, p.to) && i.status !== "CANCELLED").reduce((acc, i) => ((acc[i.customerId] = (acc[i.customerId] || 0) + i.total), acc), {}),
  ).sort((a, b) => b[1] - a[1])[0];
  // السلاسل الزمنية
  const ds = dailySeries(p);
  const sv = ds.values(),
    rv = ds.values(),
    cv = ds.values(),
    ev = ds.values();
  for (const i of S.invoices) if (i.status !== "CANCELLED" && inRange(i.at, p.from, p.to)) (i.kind === "SALE" ? sv : rv)[ds.idx[dayNo(i.at)]] += i.taxable;
  for (const x of S.payments) if (inRange(x.at, p.from, p.to)) cv[ds.idx[dayNo(x.at)]] += x.amount;
  for (const e of S.expenses) if (e.status === "APPROVED" && inRange(e.postedAt, p.from, p.to)) ev[ds.idx[dayNo(e.postedAt)]] += e.amount;
  const revSeries = sv.map((v, i) => v + rv[i]);
  const byCat = S.categories.map((c, k) => ({
    label: c.name,
    color: ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)"][k],
    value: S.sales.filter((s) => s.status === "CONFIRMED" && inRange(s.at, p.from, p.to)).reduce((a, s) => a + s.lines.filter((l) => byId(S.products, l.pid).cat === c.id).reduce((b, l) => b + lineCalc(byId(S.products, l.pid), l).net, 0), 0),
  }));
  const utilTotal = totals.AVAILABLE + totals.RESERVED + totals.RENTED + totals.MAINTENANCE + totals.DAMAGED;
  const pendingAp = S.approvals.filter((a) => a.status === "PENDING");

  return `${pageHead("لوحة سليمان الجربوع", `ملخص تنفيذي — ${p.label}. أرقام الفترة منفصلة عن الأرصدة الحالية.`, periodBar())}
  ${pendingAp.length ? `<div class="alert info" style="margin-bottom:14px;cursor:pointer" data-go="/approvals">${ic("approve")}<div><b>${pendingAp.length} طلب ينتظر قرارك</b> — ${pendingAp.map((a) => esc(a.summary)).slice(0, 2).join(" · ")}</div></div>` : ""}
  <div class="section-title">${ic("wallet").replace("<svg", '<svg style="width:15px;height:15px"')} المال — أرصدة حالية</div>
  <div class="grid g5">
    ${kpi({ label: "إجمالي السيولة", value: sar(cash + bank), icon: "wallet", link: "/accounts", tag: "رصيد حالي", sub: "صندوق + بنوك" })}
    ${kpi({ label: "رصيد الصندوق", value: sar(cash), icon: "cash", link: "/accounts", tag: "رصيد حالي", color: "#0f9f8f" })}
    ${kpi({ label: "رصيد البنوك", value: sar(bank), icon: "bank", link: "/accounts", tag: "رصيد حالي", color: "#9b5de5" })}
    ${kpi({ label: "المديونية (الذمم)", value: sar(m.receivable), icon: "file", link: "/invoices?f=open", tag: "رصيد حالي", sub: `${m.overdue.length} فاتورة متأخرة`, color: "#d1495b" })}
    ${kpi({ label: "التحصيل اليوم / الشهر", value: `${sar(collToday)}`, icon: "receipt", link: "/payments", sub: `الشهر: ${nf2.format(collMonth / 100)}`, color: "#047857" })}
  </div>
  <div class="section-title">النشاط خلال الفترة — ${p.label}</div>
  <div class="grid g5">
    ${kpi({ label: "الإيرادات (قبل الضريبة)", value: sar(revenue), icon: "trend", cur: revenue, prev: S.invoices.filter((i) => i.status !== "CANCELLED" && inRange(i.at, p.prevFrom, p.prevTo)).reduce((a, i) => a + i.taxable, 0), link: "/invoices", spark: revSeries })}
    ${kpi({ label: "التحصيلات", value: sar(m.collected), icon: "cash", cur: m.collected, prev: m.collectedPrev, link: "/payments", spark: cv, color: "#047857" })}
    ${kpi({ label: "المصروفات المعتمدة", value: sar(m.expenses), icon: "wallet", cur: m.expenses, prev: m.expensesPrev, link: "/expenses", invertGood: true, color: "#d1495b", spark: ev })}
    ${kpi({ label: "صافي حركة النقد", value: sar(m.cashIn - m.cashOut), icon: "repeat", cur: m.cashIn - m.cashOut, prev: m.cashInPrev - m.cashOutPrev, link: "/accounts", sub: "داخل − خارج الحسابات", color: "#0f9f8f" })}
    ${kpi({ label: "الربح التشغيلي التقديري", value: sar(profit), icon: "chart", sub: "تعريفه أسفل اللوحة", color: "#9b5de5" })}
  </div>
  <div class="grid g5" style="margin-top:14px">
    ${kpi({ label: "مبيعات اليوم", value: sar(salesToday), icon: "cart", link: "/sales", tag: "مفوترة" })}
    ${kpi({ label: "مبيعات الشهر", value: sar(salesMonth), icon: "cart", link: "/sales", tag: "مفوترة" })}
    ${kpi({ label: "مبيعات الفترة", value: sar(m.salesBilled), icon: "receipt", cur: m.salesBilled, prev: m.salesBilledPrev, link: "/sales", sub: `${m.salesCount} عملية` })}
    ${kpi({ label: "متوسط قيمة العملية", value: sar(m.salesCount ? Math.round(m.salesBilled / m.salesCount) : 0), icon: "layers", link: "/sales" })}
    ${kpi({ label: "إيجارات مفوترة", value: sar(m.rentBilled), icon: "key", cur: m.rentBilled, prev: m.rentBilledPrev, link: "/rentals", color: "#e0902a" })}
  </div>
  <div class="grid g4" style="margin-top:14px">
    ${kpi({ label: "إيجارات نشطة بالمواقع", value: int(activeR.length), icon: "repeat", link: "/rentals?f=active", sub: `${nf0.format(rentedPieces)} قطعة مؤجرة` })}
    ${kpi({ label: "عقود تجاوزت مدتها", value: int(lateR.length), icon: "alert", link: "/rentals?f=late", color: "#d1495b" })}
    ${kpi({ label: "أعلى بائع", value: esc([...rank].sort((a, b) => b.value - a.value)[0]?.u.name || "—"), icon: "star", link: "/sales" })}
    ${kpi({ label: "أعلى عميل", value: esc(topCustomer ? custName(topCustomer[0]) : "—"), icon: "users", link: topCustomer ? "/customers/" + topCustomer[0] : "/customers", sub: topCustomer ? nf2.format(topCustomer[1] / 100) + " ر.س" : "" })}
  </div>

  <div class="grid g3" style="margin-top:16px">
    <div class="card span2"><div class="card-h"><h3>الإيرادات مقابل المصروفات</h3><span class="chip">يومي · ر.س</span></div><div class="card-b">${lineChart(ds.labels, [
      { name: "الإيرادات قبل الضريبة", color: "var(--c1)", values: revSeries },
      { name: "المصروفات المعتمدة", color: "var(--c5)", values: ev },
    ])}${chartSource("المصدر: الفواتير الصادرة (الوعاء الضريبي) والمصروفات المعتمدة المرحّلة، حسب تاريخ الإصدار/الترحيل.")}</div></div>
    <div class="card"><div class="card-h"><h3>السيولة: صندوق مقابل بنوك</h3><span class="chip">رصيد حالي</span></div><div class="card-b">${donut(S.accounts.map((a, k) => ({ label: a.name, value: Math.max(0, accountBalance(a.id)), color: ["#0f9f8f", "#2547b0", "#9b5de5"][k] })))}${chartSource("المصدر: الرصيد الافتتاحي + حركات كل حساب.")}</div></div>
    <div class="card span2"><div class="card-h"><h3>اتجاه المبيعات والتحصيل</h3></div><div class="card-b">${lineChart(ds.labels, [
      { name: "مبيعات (قبل الضريبة)", color: "var(--c1)", values: sv },
      { name: "إيجارات (قبل الضريبة)", color: "var(--c3)", values: rv },
      { name: "التحصيلات", color: "var(--c2)", values: cv },
    ], { area: false })}${chartSource("المبيعات والإيجارات من الفواتير؛ التحصيل من سندات القبض بتاريخ القبض. البيع الآجل لا يُحسب نقدًا.")}</div></div>
    <div class="card"><div class="card-h"><h3>أعمار الذمم</h3><span class="chip">رصيد حالي</span></div><div class="card-b">${barChart(agingBuckets(S.invoices), { horizontal: true })}${chartSource("المتبقي على الفواتير حسب أيام التأخير عن تاريخ الاستحقاق.")}</div></div>
    <div class="card"><div class="card-h"><h3>المبيعات حسب البائع</h3></div><div class="card-b">${barChart(rank.map((r, k) => ({ label: r.u.name, value: r.value, color: ["var(--c1)", "var(--c2)"][k % 2], link: "/sales?seller=" + r.u.id })), { horizontal: true })}${chartSource("فواتير البيع والإيجار للبائع خلال الفترة (شامل الضريبة).")}</div></div>
    <div class="card"><div class="card-h"><h3>المبيعات حسب الفئة</h3></div><div class="card-b">${donut(byCat)}${chartSource("صافي بنود البيع المؤكدة حسب فئة الصنف خلال الفترة (قبل الضريبة).")}</div></div>
    <div class="card"><div class="card-h"><h3>استغلال المعدات</h3><span class="chip">الآن</span></div><div class="card-b"><div class="big-num num">${utilTotal ? ((totals.RENTED / utilTotal) * 100).toFixed(1) : 0}%</div><div class="muted small" style="margin-bottom:10px">من القطع المملوكة مؤجرة حاليًا</div>${stackedBar([
      { label: "مؤجر", value: totals.RENTED, color: "var(--c1)" },
      { label: "محجوز", value: totals.RESERVED, color: "var(--c4)" },
      { label: "متاح", value: totals.AVAILABLE, color: "var(--c2)" },
      { label: "صيانة", value: totals.MAINTENANCE, color: "var(--c3)" },
      { label: "تالف", value: totals.DAMAGED, color: "var(--c5)" },
    ])}${chartSource("المصدر: دفتر حركات المخزون لكل المستودعات. الوحدة: قطعة.")}</div></div>
  </div>

  <div class="card" style="margin-top:16px" id="ranking"><div class="card-h"><h3>ترتيب البائعين — ${p.label}</h3><div class="seg">${[
    ["value", "القيمة"],
    ["collected", "التحصيل"],
    ["remaining", "المتبقي"],
    ["newCustomers", "العملاء الجدد"],
    ["avg", "متوسط العملية"],
    ["growth", "النمو"],
  ].map(([k, l]) => `<button class="${sortKey === k ? "on" : ""}" data-act="rankSort" data-k="${k}">${l}</button>`).join("")}</div></div>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>البائع</th><th>عدد العمليات</th><th>قيمة المبيعات والإيجار</th><th>التحصيل</th><th>المتبقي</th><th>العملاء الجدد</th><th>متوسط العملية</th><th>النمو</th><th>العمولة (${S.users.find((u) => u.role === "SELLER").commission}%)</th></tr></thead>
  <tbody>${rank.map((r, i) => `<tr class="click" data-go="/sales?seller=${r.u.id}"><td><span class="badge ${i === 0 ? "b-amber" : "b-gray"}">${i + 1}</span></td><td class="bold">${esc(r.u.name)}</td><td>${int(r.count)}</td><td>${sar(r.value)}</td><td>${sar(r.collected)}</td><td>${sar(r.remaining)}</td><td>${int(r.newCustomers)}</td><td>${sar(r.avg)}</td><td>${r.growth === null ? '<span class="trend na">غير متاحة</span>' : `<span class="trend ${r.growth >= 0 ? "up" : "down"}">${r.growth >= 0 ? "▲" : "▼"} <span class="num">${Math.abs(r.growth).toFixed(1)}%</span></span>`}</td><td>${sar(r.commission)}</td></tr>`).join("")}</tbody></table></div></div>

  <div class="section-title">المخزون — الآن</div>
  <div class="grid g5">
    ${kpi({ label: "قيمة المخزون (بالتكلفة)", value: sar(invValue), icon: "box", link: "/inventory", sub: "متاح + محجوز + مؤجر + صيانة" })}
    ${kpi({ label: "قطع متاحة", value: int(totals.AVAILABLE), icon: "checkc", link: "/inventory", color: "#047857" })}
    ${kpi({ label: "أصناف تحت الحد الأدنى", value: int(low.length), icon: "alert", link: "/inventory?f=low", color: "#e0902a" })}
    ${kpi({ label: "تالف / مفقود", value: `${int(totals.DAMAGED)} / ${int(totals.LOST)}`, icon: "ban", link: "/inventory?f=damaged", color: "#d1495b" })}
    ${kpi({ label: "تحت الصيانة", value: int(totals.MAINTENANCE), icon: "settings", link: "/inventory?f=maint", color: "#9b5de5" })}
  </div>
  <div class="card card-b" style="margin-top:16px" id="profit"><b>تعريف الربح المعروض:</b> <span class="muted">الربح التشغيلي التقديري = (مبيعات قبل الضريبة − تكلفة البضاعة المباعة وقت البيع) + إيرادات الإيجار قبل الضريبة − المصروفات المعتمدة خلال الفترة. لا يشمل استهلاك المعدات ولا الضريبة، والتأمينات ليست إيرادًا. <b>بند ينتظر اعتماد المؤسسة.</b></span>
  <div class="row wrap" style="margin-top:8px;gap:14px" class="small"><span class="chip">مبيعات: ${sar(m.salesTaxable)}</span><span class="chip">تكلفة: ${sar(m.cogs)}</span><span class="chip">إيجار: ${sar(m.rentTaxable)}</span><span class="chip">مصروفات: ${sar(m.expenses)}</span><span class="chip">= ${sar(profit)}</span></div></div>`;
});
ACTIONS.rankSort = (el) => ((UI.rankSort = el.dataset.k), render());

/* ═════════ لوحة المالية ═════════ */
route("/finance/dashboard", ["dash.finance"], () => {
  const p = period();
  const m = metrics(p);
  const today = dayNo(Date.now());
  const now = new Date(Date.now() + RIYADH);
  const mStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - RIYADH;
  const cash = S.accounts.filter((a) => a.type === "CASH").reduce((x, a) => x + accountBalance(a.id), 0);
  const bank = S.accounts.filter((a) => a.type === "BANK").reduce((x, a) => x + accountBalance(a.id), 0);
  const collToday = S.payments.filter((x) => dayNo(x.at) === today).reduce((a, x) => a + x.amount, 0);
  const collYesterday = S.payments.filter((x) => dayNo(x.at) === today - 1).reduce((a, x) => a + x.amount, 0);
  const collMonth = S.payments.filter((x) => x.at >= mStart).reduce((a, x) => a + x.amount, 0);
  const expToday = S.expenses.filter((e) => e.status === "APPROVED" && dayNo(e.postedAt) === today).reduce((a, e) => a + e.amount, 0);
  const expMonth = S.expenses.filter((e) => e.status === "APPROVED" && e.postedAt >= mStart).reduce((a, e) => a + e.amount, 0);
  const pendingExp = S.expenses.filter((e) => e.status === "PENDING");
  const unsettled = S.rentals.filter((r) => rentalStatusCalc(r) === "RETURNED" && (S.invoices.filter((i) => i.refId === r.id).some((i) => invRemaining(i) > 0) || depositHeld(r.id) > 0));
  const follow = S.invoices.filter((i) => ["OVERDUE", "PARTIAL", "UNPAID"].includes(invStatus(i))).sort((a, b) => a.due - b.due);
  const debtors = Object.entries(S.invoices.reduce((acc, i) => ((acc[i.customerId] = (acc[i.customerId] || 0) + invRemaining(i)), acc), {}))
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const byRep = S.reps.map((r, k) => ({ label: r.name, value: S.payments.filter((x) => x.repId === r.id && inRange(x.at, p.from, p.to)).reduce((a, x) => a + x.amount, 0), color: ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)"][k], link: "/payments?rep=" + r.id }));
  const ds = dailySeries(p);
  const cv = ds.values();
  for (const x of S.payments) if (inRange(x.at, p.from, p.to)) cv[ds.idx[dayNo(x.at)]] += x.amount;
  return `${pageHead("لوحة المالية", `المستحقات والتحصيل والصناديق — ${p.label}`, `${periodBar()}<button class="btn primary" data-act="quick" data-h="@payment">${ic("cash")}تسجيل تحصيل</button><button class="btn" data-act="quick" data-h="@expense">${ic("wallet")}مصروف جديد</button>`)}
  <div class="grid g5">
    ${kpi({ label: "تحصيل اليوم", value: sar(collToday), icon: "cash", cur: collToday, prev: collYesterday, link: "/payments?d=today", color: "#047857", tag: "مقارنة بأمس" })}
    ${kpi({ label: "تحصيل الشهر", value: sar(collMonth), icon: "receipt", link: "/payments", color: "#047857" })}
    ${kpi({ label: "إجمالي المستحقات", value: sar(m.receivable), icon: "file", link: "/invoices?f=open", tag: "رصيد حالي", color: "#d1495b" })}
    ${kpi({ label: "الفواتير المتأخرة", value: `${int(m.overdue.length)} <small>· ${nf2.format(m.overdue.reduce((a, i) => a + invRemaining(i), 0) / 100)} ر.س</small>`, icon: "alert", link: "/invoices?f=OVERDUE", color: "#b91c1c" })}
    ${kpi({ label: "العمليات غير المسوّاة", value: int(unsettled.length), icon: "repeat", link: "/rentals?f=unsettled", sub: "عقود مرتجعة بذمة أو تأمين", color: "#e0902a" })}
  </div>
  <div class="grid g5" style="margin-top:14px">
    ${kpi({ label: "رصيد الصندوق", value: sar(cash), icon: "cash", link: "/accounts/a-cash", tag: "رصيد حالي", color: "#0f9f8f" })}
    ${kpi({ label: "إجمالي البنوك", value: sar(bank), icon: "bank", link: "/accounts", tag: "رصيد حالي", color: "#9b5de5" })}
    ${kpi({ label: "مصروفات اليوم / الشهر", value: sar(expToday), icon: "wallet", link: "/expenses", sub: `الشهر: ${nf2.format(expMonth / 100)}`, color: "#d1495b" })}
    ${kpi({ label: "صافي التدفق (الفترة)", value: sar(m.cashIn - m.cashOut), icon: "repeat", cur: m.cashIn - m.cashOut, prev: m.cashInPrev - m.cashOutPrev, link: "/accounts", sub: "قبض + تأمين − صرف" })}
    ${kpi({ label: "مصروفات تنتظر الاعتماد", value: int(pendingExp.length), icon: "approve", link: "/expenses?f=PENDING", sub: sar(pendingExp.reduce((a, e) => a + e.amount, 0)), color: "#7c3aed" })}
  </div>
  <div class="grid g3" style="margin-top:16px">
    <div class="card span2"><div class="card-h"><h3>اتجاه التحصيل اليومي</h3></div><div class="card-b">${lineChart(ds.labels, [{ name: "التحصيلات", color: "var(--c2)", values: cv }])}${chartSource("سندات القبض المرحّلة بتاريخ القبض — بتوقيت الرياض.")}</div></div>
    <div class="card"><div class="card-h"><h3>سندات القبض حسب المندوب</h3></div><div class="card-b">${barChart(byRep, { horizontal: true })}${chartSource("مجموع سندات القبض خلال الفترة لكل مندوب. اضغط للتفاصيل.")}</div></div>
  </div>
  <div class="grid g2" style="margin-top:16px">
    <div class="span2">${table(
      "fin-follow",
      [
        { key: "c", label: "العميل", text: (i) => custName(i.customerId), render: (i) => `<a class="link" href="#/customers/${i.customerId}">${esc(custName(i.customerId))}</a>` },
        { key: "no", label: "رقم الفاتورة", text: (i) => i.no, render: (i) => `<a class="link num" href="#/invoices/${i.id}">${i.no}</a>` },
        { key: "t", label: "الإجمالي", value: (i) => i.total, render: (i) => sar(i.total) },
        { key: "p", label: "المدفوع", value: (i) => invPaid(i), render: (i) => sar(invPaid(i)) },
        { key: "r", label: "المتبقي", value: (i) => invRemaining(i), render: (i) => `<b>${sar(invRemaining(i))}</b>` },
        { key: "d", label: "الاستحقاق", value: (i) => i.due, render: (i) => dateNum(i.due) },
        { key: "late", label: "أيام التأخير", value: (i) => Math.max(0, today - dayNo(i.due)), render: (i) => (today > dayNo(i.due) ? `<span class="badge b-red">${today - dayNo(i.due)} يوم</span>` : '<span class="faint">—</span>') },
        { key: "s", label: "الحالة", text: (i) => invStatus(i), render: (i) => badge(invStatus(i)) },
        { key: "a", label: "", search: false, text: () => "", render: (i) => `<button class="btn sm" data-act="pay" data-inv="${i.id}">${ic("cash")}تحصيل</button>` },
      ],
      follow,
      { size: 8, sort: "late", empty: "لا فواتير تحتاج متابعة", actions: `<a class="btn sm" href="#/invoices">كل الفواتير</a>` },
    ).replace('<div class="card">', '<div class="card"><div class="card-h"><h3>فواتير تحتاج متابعة</h3></div>')}</div>
    <div class="card"><div class="card-h"><h3>آخر التحصيلات</h3><a class="btn sm ghost" href="#/payments">الكل</a></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>الوقت</th><th>العميل</th><th>المبلغ</th><th>الطريقة</th><th>الحساب</th><th>المندوب</th><th>الموظف</th></tr></thead><tbody>${[...S.payments]
      .sort((a, b) => b.at - a.at)
      .slice(0, 8)
      .map((x) => `<tr class="click" data-go="/payments/${x.id}"><td class="num">${fmtDT(x.at)}</td><td>${esc(custName(x.customerId))}</td><td>${sar(x.amount)}</td><td>${METHOD[x.method]}</td><td>${esc(accName(x.accountId))}</td><td>${esc(x.repName || "—")}</td><td>${esc(userName(x.recordedBy))}</td></tr>`)
      .join("")}</tbody></table></div></div>
    <div class="col" style="gap:14px">
    <div class="card"><div class="card-h"><h3>مصروفات تنتظر الاعتماد</h3><a class="btn sm ghost" href="#/expenses?f=PENDING">الكل</a></div><div class="card-b">${pendingExp.length ? pendingExp.map((e) => `<div class="row between" style="padding:6px 0;border-bottom:1px dashed var(--border)"><span><b>${esc(e.cat)}</b> <span class="muted small">${esc(e.desc)}</span></span><span>${sar(e.amount)} ${badge("PENDING")}</span></div>`).join("") : emptyBox("لا مصروفات معلقة", "approve")}</div></div>
    <div class="card"><div class="card-h"><h3>عملاء مرتفعو المديونية</h3></div><div class="card-b">${barChart(debtors.map(([cid, v]) => ({ label: custName(cid), value: v, color: "var(--c5)", link: "/customers/" + cid })), { horizontal: true })}</div></div></div>
  </div>`;
});

/* ═════════ لوحة البائع ═════════ */
route("/seller/dashboard", ["dash.seller"], () => {
  const u = ME;
  const p = period();
  const m = metrics(p, { sellerId: u.id });
  const today = dayNo(Date.now());
  const now = new Date(Date.now() + RIYADH);
  const mStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - RIYADH;
  const myInv = S.invoices.filter((i) => i.sellerId === u.id && i.status !== "CANCELLED");
  const todaySales = myInv.filter((i) => dayNo(i.at) === today).reduce((a, i) => a + i.total, 0);
  const monthSales = myInv.filter((i) => i.at >= mStart).reduce((a, i) => a + i.total, 0);
  const myCustomers = S.customers.filter((c) => canSeeCustomer(u, c));
  const open = [...S.sales.filter((s) => s.sellerId === u.id && (s.status === "PENDING_APPROVAL" || (s.invoiceId && invRemaining(byId(S.invoices, s.invoiceId)) > 0))), ...S.rentals.filter((r) => r.sellerId === u.id && ["RESERVED", "ACTIVE", "PARTIALLY_RETURNED"].includes(rentalStatusCalc(r)))];
  const remaining = myInv.reduce((a, i) => a + invRemaining(i), 0);
  const d7 = [];
  for (let k = 6; k >= 0; k--) {
    const d = today - k;
    d7.push({ label: fmtDate(dayStart(d)).slice(0, 5), value: myInv.filter((i) => dayNo(i.at) === d).reduce((a, i) => a + i.total, 0), color: "var(--c1)" });
  }
  const topC = Object.entries(myInv.reduce((acc, i) => ((acc[i.customerId] = (acc[i.customerId] || 0) + i.total), acc), {}))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const recent = [...S.sales.filter((s) => s.sellerId === u.id).map((s) => ({ ...s, k: "sale" })), ...S.rentals.filter((r) => r.sellerId === u.id).map((r) => ({ ...r, k: "rental", total: r.est.total }))].sort((a, b) => b.at - a.at).slice(0, 8);
  const fus = S.followups.filter((f) => f.userId === u.id && !f.done).sort((a, b) => (a.next || 0) - (b.next || 0));
  const notifs = notificationsFor(u).slice(0, 5);
  return `${pageHead(`أهلًا، ${esc(u.name)}`, `أداؤك — ${p.label}`, `${periodBar()}<a class="btn primary lg" href="#/sales/new">${ic("cart")}بيع جديد</a><a class="btn lg" href="#/rentals/new">${ic("key")}إيجار جديد</a>`)}
  <div class="grid g4">
    ${kpi({ label: "مبيعات اليوم", value: sar(todaySales), icon: "cart", link: "/sales", tag: "مفوترة" })}
    ${kpi({ label: "مبيعات الشهر", value: sar(monthSales), icon: "receipt", link: "/sales" })}
    ${kpi({ label: "قيمة الفترة (بيع + إيجار)", value: sar(m.salesBilled + m.rentBilled), icon: "trend", cur: m.salesBilled + m.rentBilled, prev: m.salesBilledPrev + m.rentBilledPrev, link: "/sales", spark: d7.map((d) => d.value) })}
    ${kpi({ label: "عدد العمليات (الفترة)", value: int(m.salesCount + S.rentals.filter((r) => r.sellerId === u.id && inRange(r.at, p.from, p.to)).length), icon: "layers", link: "/sales" })}
  </div>
  <div class="grid g4" style="margin-top:14px">
    ${kpi({ label: "المحصّل من عملياتي", value: sar(m.collected), icon: "cash", cur: m.collected, prev: m.collectedPrev, link: "/payments", color: "#047857" })}
    ${kpi({ label: "المتبقي على عملائي", value: sar(remaining), icon: "file", link: "/invoices?f=open", color: "#d1495b", tag: "رصيد حالي" })}
    ${kpi({ label: "عملائي / الجدد", value: `${int(myCustomers.length)} <small>/ ${m.newCustomers} جديد</small>`, icon: "users", link: "/customers", cur: m.newCustomers, prev: m.newCustomersPrev })}
    ${kpi({ label: "الصفقات المفتوحة", value: int(open.length), icon: "repeat", link: "/rentals?f=active", sub: `عمولتي التقديرية ${nf2.format(Math.round((m.salesTaxable + m.rentTaxable) * (u.commission / 100)) / 100)} ر.س` })}
  </div>
  <div class="grid g3" style="margin-top:16px">
    <div class="card span2"><div class="card-h"><h3>مبيعاتي آخر 7 أيام</h3><span class="chip">يومي · شامل الضريبة</span></div><div class="card-b">${barChart(d7)}${chartSource("فواتير البيع والإيجار التي أنشأتها، بتاريخ الإصدار.")}</div></div>
    <div class="card"><div class="card-h"><h3>أعلى عملائي</h3></div><div class="card-b">${barChart(topC.map(([cid, v]) => ({ label: custName(cid), value: v, link: "/customers/" + cid })), { horizontal: true })}</div></div>
    <div class="card span2"><div class="card-h"><h3>آخر عملياتي</h3><a class="btn sm ghost" href="#/sales">الكل</a></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>الرقم</th><th>النوع</th><th>العميل / المشروع</th><th>الإجمالي</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>${recent.map((x) => `<tr class="click" data-go="/${x.k === "sale" ? "sales" : "rentals"}/${x.id}"><td class="num link">${x.no}</td><td>${x.k === "sale" ? "بيع" : "إيجار"}</td><td>${esc(custName(x.customerId))} <span class="muted small">/ ${esc(projName(x.projectId))}</span></td><td>${sar(x.total)}</td><td>${x.k === "sale" ? saleBadge(x) : rentalBadge(byId(S.rentals, x.id))}</td><td>${dateNum(x.at)}</td></tr>`).join("") || `<tr><td colspan="6">${emptyBox("لا عمليات بعد")}</td></tr>`}</tbody></table></div></div>
    <div class="col" style="gap:14px"><div class="card"><div class="card-h"><h3>متابعاتي</h3><a class="btn sm ghost" href="#/reps">الكل</a></div><div class="card-b">${fus.length ? fus.slice(0, 5).map((f) => `<div style="padding:7px 0;border-bottom:1px dashed var(--border)" class="row between"><span class="col" style="gap:0"><a class="link bold" href="#/customers/${f.customerId}">${esc(custName(f.customerId))}</a><span class="xs muted">${esc(f.outcome)} · مندوب: ${esc(byId(S.reps, f.repId)?.name || "—")}</span></span><span class="${f.next && dayNo(f.next) <= today ? "badge b-red" : "badge b-gray"}">${dateNum(f.next)}</span></div>`).join("") : emptyBox("لا متابعات")}</div></div>
    <div class="card"><div class="card-h"><h3>تنبيهاتي</h3></div><div class="card-b">${notifs.length ? notifs.map((n) => `<a href="${n.link}" class="row" style="padding:6px 0"><span class="badge b-${n.type === "red" ? "red" : n.type === "amber" ? "amber" : "blue"}" style="padding:2px 6px"></span><span class="col" style="gap:0"><b class="small">${esc(n.title)}</b><span class="xs muted">${esc(n.body)}</span></span></a>`).join("") : emptyBox("لا تنبيهات", "bell")}</div></div></div>
  </div>`;
});

/* ═══════════ التطبيق: الجلسة، التوجيه، الصلاحيات، الأحداث ═══════════ */
"use strict";

const STORE_KEY = "barq-demo-state-v6";
const SESSION_KEY = "barq-demo-session";
const IDLE_MS = 30 * 60000; // انتهاء الجلسة بعد 30 دقيقة خمول
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(S));
    } catch (e) {}
  }, 250);
}
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const st = JSON.parse(raw);
      if (st.version === 6) {
        S = st;
        VER++;
        return;
      }
    }
  } catch (e) {}
  seedState();
  save();
}

/* ─── الصلاحيات ─── */
const ROLE_LABEL = { OWNER: "المالك", FINANCE: "المالية", SELLER: "بائع", WAREHOUSE: "مسؤول العدد" };
const ROLE_HOME = { OWNER: "/owner/dashboard", FINANCE: "/finance/dashboard", SELLER: "/seller/dashboard", WAREHOUSE: "/rentals" };
const PERMS = {
  OWNER: ["*"],
  FINANCE: ["dash.finance", "sales.viewAll", "rentals.viewAll", "rentals.bill", "invoices", "payments.create", "payments", "accounts", "expenses", "customers.viewAll", "inventory", "reps", "daily", "deposits", "promissory", "rate", "followups"],
  SELLER: ["dash.seller", "sales.create", "rentals.create", "rentals.deliver", "customers.create", "invoices.own", "payments.own", "inventory", "reps", "rate", "followups"],
  WAREHOUSE: ["rentals.viewAll", "rentals.deliver", "rentals.return", "inventory", "customers.viewAll"],
};
const can = (u, p) => PERMS[u.role].includes("*") || PERMS[u.role].includes(p);
const canAny = (u, ...ps) => ps.some((p) => can(u, p));
/** نطاق البائع: عملاؤه (أنشأهم أو مسندون لمندوب يتابعه أو تعامل معهم) */
function canSeeCustomer(u, c) {
  if (canAny(u, "customers.viewAll")) return true;
  if (c.createdBy === u.id) return true;
  const rep = byId(S.reps, c.repId);
  if (rep && rep.followers.includes(u.id)) return true;
  return S.sales.some((s) => s.customerId === c.id && s.sellerId === u.id) || S.rentals.some((r) => r.customerId === c.id && r.sellerId === u.id);
}
const canSeeSale = (u, s) => can(u, "sales.viewAll") || s.sellerId === u.id;
const canSeeRental = (u, r) => can(u, "rentals.viewAll") || r.sellerId === u.id;
const canSeeInvoice = (u, i) => can(u, "invoices") || (can(u, "invoices.own") && i.sellerId === u.id);
const canSeePayment = (u, p) => can(u, "payments") || (can(u, "payments.own") && p.allocations.some((a) => byId(S.invoices, a.invoiceId)?.sellerId === u.id));

/* ─── الجلسة ─── */
let ME = null;
function currentUser() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (!s) return null;
    if (Date.now() - s.last > IDLE_MS) {
      localStorage.removeItem(SESSION_KEY);
      UI.sessionExpired = true;
      return null;
    }
    const u = byId(S.users, s.userId);
    if (!u || !u.active) return null;
    s.last = Date.now();
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    return u;
  } catch (e) {
    return null;
  }
}
function doLogin(username, password) {
  const u = S.users.find((x) => x.username === username.trim().toLowerCase());
  const recent = S.logins.filter((l) => l.username === username && !l.ok && Date.now() - l.at < 15 * 60000).length;
  if (recent >= 5) return "تم إيقاف الدخول مؤقتًا بعد 5 محاولات فاشلة. حاول بعد 15 دقيقة.";
  const pw = u?.password || "2026";
  if (!u || password !== pw) {
    S.logins.push({ username, ok: false, at: Date.now(), ip: "127.0.0.1", reason: u ? "كلمة مرور خاطئة" : "مستخدم غير معروف" });
    save();
    return "اسم المستخدم أو كلمة المرور غير صحيحة";
  }
  if (!u.active) {
    S.logins.push({ username, ok: false, at: Date.now(), ip: "127.0.0.1", reason: "حساب معطل" });
    save();
    return "هذا الحساب معطّل. تواصل مع المالك.";
  }
  u.lastLogin = Date.now();
  S.logins.push({ username, ok: true, at: Date.now(), ip: "127.0.0.1" });
  audit(u, "LOGIN", "User", u.id);
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: u.id, last: Date.now() }));
  touch();
  location.hash = "#" + ROLE_HOME[u.role];
  render();
  return null;
}
function doLogout() {
  if (ME) audit(ME, "LOGOUT", "User", ME.id);
  localStorage.removeItem(SESSION_KEY);
  touch();
  location.hash = "#/login";
  render();
}

/* ─── حالة الواجهة ─── */
const UI = {
  collapsed: false,
  period: { key: "30d", from: null, to: null },
  modal: null,
  menu: null,
  search: "",
  pos: null,
  rent: null,
  tab: {},
  sel: {},
};
function period() {
  const p = UI.period;
  const today = dayNo(Date.now());
  let from, to, label;
  const ms = (y, m) => Date.UTC(y, m, 1) - RIYADH;
  const nowR = new Date(Date.now() + RIYADH);
  switch (p.key) {
    case "today":
      from = dayStart(today);
      to = dayStart(today + 1);
      label = "اليوم";
      break;
    case "7d":
      from = dayStart(today - 6);
      to = dayStart(today + 1);
      label = "آخر 7 أيام";
      break;
    case "month":
      from = ms(nowR.getUTCFullYear(), nowR.getUTCMonth());
      to = dayStart(today + 1);
      label = "هذا الشهر";
      break;
    case "lastMonth":
      from = ms(nowR.getUTCFullYear(), nowR.getUTCMonth() - 1);
      to = ms(nowR.getUTCFullYear(), nowR.getUTCMonth());
      label = "الشهر الماضي";
      break;
    case "custom":
      from = p.from ? parseDay(p.from) : dayStart(today - 29);
      to = p.to ? parseDay(p.to) + DAY : dayStart(today + 1);
      label = `${fmtDate(from)} — ${fmtDate(to - DAY)}`;
      break;
    default:
      from = dayStart(today - 29);
      to = dayStart(today + 1);
      label = "آخر 30 يومًا";
  }
  const len = to - from;
  let prevFrom = from - len,
    prevTo = from;
  if (p.key === "month") {
    prevFrom = ms(nowR.getUTCFullYear(), nowR.getUTCMonth() - 1);
    prevTo = prevFrom + len;
  }
  if (p.key === "lastMonth") {
    prevFrom = ms(nowR.getUTCFullYear(), nowR.getUTCMonth() - 2);
    prevTo = from;
  }
  return { from, to, prevFrom, prevTo, label, key: p.key };
}
const inRange = (t, a, b) => t >= a && t < b;

/** شريط الفترة: اختصارات سريعة + «من / إلى» ظاهران دائمًا في كل لوحة */
function periodBar() {
  const keys = [
    ["today", "اليوم"],
    ["7d", "7 أيام"],
    ["30d", "30 يومًا"],
    ["month", "هذا الشهر"],
    ["lastMonth", "الشهر الماضي"],
  ];
  const p = UI.period;
  const cur = period();
  const today = isoDay(Date.now());
  const fromV = isoDay(cur.from),
    toV = isoDay(cur.to - DAY);
  return `<div class="row wrap period-bar"><div class="seg">${keys.map(([k, l]) => `<button class="${p.key === k ? "on" : ""}" data-act="period" data-k="${k}">${l}</button>`).join("")}</div>
  <div class="row date-range ${p.key === "custom" ? "on" : ""}"><span class="muted small">من</span><input type="date" class="input" data-act-change="periodFrom" value="${fromV}" max="${today}" aria-label="من تاريخ"><span class="muted small">إلى</span><input type="date" class="input" data-act-change="periodTo" value="${toV}" max="${today}" aria-label="إلى تاريخ"></div>
  <span class="chip">${ic("clock")}<span>بتوقيت الرياض</span></span></div>`;
}

/** تعديل «من» أو «إلى» يحوّل الفترة لمخصصة ويحتفظ بالطرف الآخر كما يظهر */
function setRange(from, to) {
  const cur = period();
  let f = from || isoDay(cur.from),
    t = to || isoDay(cur.to - DAY);
  if (f > t) [f, t] = [t, f];
  UI.period = { key: "custom", from: f, to: t };
  render();
}

/* ─── التوجيه ─── */
const ROUTES = [];
function route(pattern, perms, fn, opts = {}) {
  const keys = [];
  const re = new RegExp("^" + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), "([^/]+)")) + "$");
  ROUTES.push({ re, keys, perms, fn, opts });
}
function parseHash() {
  const h = location.hash.replace(/^#/, "") || "/";
  const [path, qs] = h.split("?");
  const query = Object.fromEntries(new URLSearchParams(qs || ""));
  return { path, query };
}
function go(path) {
  if (location.hash === "#" + path) render();
  else location.hash = "#" + path;
}

/* ─── العرض ─── */
const $ = (sel, root = document) => root.querySelector(sel);
function render() {
  ensureToolsState();
  const { path, query } = parseHash();
  ME = currentUser();
  const root = $("#root");
  const active = document.activeElement;
  const focusId = active && active.id;
  const selStart = active && "selectionStart" in active ? active.selectionStart : null;
  const focusVal = active && active.tagName === "INPUT" ? active.value : null;
  if (!ME || path === "/login") {
    if (ME && path === "/login") return go(ROLE_HOME[ME.role]);
    root.innerHTML = loginPage();
    restoreFocus(focusId, selStart, focusVal);
    return;
  }
  if (path === "/" || path === "") return go(ROLE_HOME[ME.role]);
  let html = null;
  for (const r of ROUTES) {
    const m = path.match(r.re);
    if (!m) continue;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    if (r.perms.length && !canAny(ME, ...r.perms)) {
      html = forbiddenPage();
      break;
    }
    try {
      html = r.fn(params, query);
    } catch (e) {
      if (e instanceof DomainError) html = forbiddenPage(e.message);
      else {
        console.error(e);
        html = `<div class="content"><div class="alert danger">${ic("alert")}<div>حدث خطأ أثناء عرض الصفحة: ${esc(e.message)}</div></div></div>`;
      }
    }
    if (r.opts.bare) {
      root.innerHTML = html;
      return;
    }
    break;
  }
  if (html === null)
    html = `<div class="nf"><div><div class="code num">404</div><h1 style="font-size:22px;margin:14px 0 6px">هذه الصفحة غير موجودة</h1><p class="muted" style="margin:0">الرابط <bdi dir="ltr" class="num">${esc(path)}</bdi> لا يطابق أي صفحة في النظام. ربما نُقل المستند أو كُتب الرابط بشكل خاطئ.</p><div class="links"><a class="btn primary" href="#${ROLE_HOME[ME.role]}">لوحتي</a>${can(ME, "sales.create") ? '<a class="btn" href="#/sales/new">بيع جديد</a>' : ""}<a class="btn" href="#/customers">العملاء</a>${canAny(ME, "invoices", "invoices.own") ? '<a class="btn" href="#/invoices">الفواتير</a>' : ""}</div></div></div>`;
  const enter = UI._lastPath !== path;
  UI._lastPath = path;
  root.innerHTML = layout(html, path, enter);
  renderModal();
  restoreFocus(focusId, selStart, focusVal);
}
function restoreFocus(id, pos, val) {
  if (!id) return;
  const el = document.getElementById(id);
  if (el) {
    // نحتفظ بما يكتبه المستخدم كما هو أثناء الكتابة (بدون إعادة تنسيق)
    if (val !== null && val !== undefined && el.tagName === "INPUT" && el.type !== "date") el.value = val;
    el.focus();
    if (pos !== null && "setSelectionRange" in el) {
      try {
        el.setSelectionRange(pos, pos);
      } catch (e) {}
    }
  }
}

/* ─── القائمة الجانبية حسب الدور ─── */
function navItems(u) {
  const pendingAp = S.approvals.filter((a) => a.status === "PENDING").length;
  const items = [];
  const add = (sec, href, icon, label, show, count) => show && items.push({ sec, href, icon, label, count });
  add("الرئيسية", "/owner/dashboard", "home", "لوحة المالك", u.role === "OWNER");
  add("الرئيسية", "/finance/dashboard", "wallet", "لوحة المالية", canAny(u, "dash.finance"));
  add("الرئيسية", "/seller/dashboard", "home", "لوحتي", u.role === "SELLER");
  add("العمليات", "/sales/new", "cart", "بيع جديد", can(u, "sales.create"));
  add("العمليات", "/rentals/new", "key", "إيجار جديد", can(u, "rentals.create"));
  add("العمليات", "/sales", "receipt", u.role === "SELLER" ? "مبيعاتي" : "المبيعات", u.role !== "WAREHOUSE");
  add("العمليات", "/rentals", "repeat", u.role === "SELLER" ? "إيجاراتي" : u.role === "WAREHOUSE" ? "التسليم والمرتجعات" : "الإيجارات", true);
  add("العملاء", "/customers", "users", u.role === "SELLER" ? "عملائي" : "العملاء", true);
  add("العملاء", "/reps", "user", u.role === "SELLER" ? "مناديبي ومتابعاتي" : "المناديب والمتابعة", can(u, "reps"));
  add("المالية", "/invoices", "file", u.role === "SELLER" ? "فواتيري" : "الفواتير", canAny(u, "invoices", "invoices.own"));
  add("المالية", "/payments", "cash", "سندات القبض", canAny(u, "payments", "payments.own"));
  add("المالية", "/accounts", "bank", "الصندوق والبنوك", can(u, "accounts"));
  add("المالية", "/expenses", "wallet", "المصروفات", can(u, "expenses"));
  add("المالية", "/vouchers", "cashOut", "سندات الصرف", can(u, "expenses"));
  add("المالية", "/daily", "calendar", "يومية الصندوق", can(u, "daily"));
  add("المالية", "/monthly", "chart", "الحركة الشهرية", can(u, "daily"));
  add("المالية", "/cashbook", "layers", "دفتر الصندوق والبنوك", can(u, "daily"));
  add("المخزون", "/inventory", "box", "المخزون", can(u, "inventory"));
  add("الإدارة", "/approvals", "approve", "مركز الموافقات", u.role === "OWNER", pendingAp);
  add("الإدارة", "/users", "shield", "المستخدمون", u.role === "OWNER");
  add("الإدارة", "/settings", "settings", "الإعدادات", u.role === "OWNER");
  add("الإدارة", "/audit", "history", "سجل التدقيق", u.role === "OWNER");
  add("العرض", "/acceptance", "checkc", "سيناريوهات القبول", true);
  return items;
}
function layout(content, path, enter) {
  const u = ME;
  const items = navItems(u);
  let sec = "";
  const nav = items
    .map((it) => {
      const head = it.sec !== sec ? `<div class="nav-section">${(sec = it.sec)}</div>` : "";
      const activeCls = path === it.href || (it.href !== "/sales/new" && it.href !== "/rentals/new" && path.startsWith(it.href + "/") && !items.some((o) => o.href !== it.href && path.startsWith(o.href) && o.href.length > it.href.length)) ? "active" : "";
      return `${head}<a href="#${it.href}" class="${activeCls}" title="${it.label}">${ic(it.icon)}<span class="lbl">${it.label}</span>${it.count ? `<span class="badge-count">${it.count}</span>` : ""}</a>`;
    })
    .join("");
  const notifs = notificationsFor(u);
  const unread = notifs.filter((n) => !S.readNotifs[u.id + n.key]).length;
  const qa = [
    ["/sales/new", "cart", "بيع جديد", can(u, "sales.create")],
    ["/rentals/new", "key", "إيجار جديد", can(u, "rentals.create")],
    ["@customer", "users", "عميل جديد", can(u, "customers.create") || u.role === "OWNER"],
    ["@payment", "cash", "تحصيل جديد", can(u, "payments.create")],
    ["@expense", "cashOut", "سند صرف / مصروف جديد", can(u, "expenses")],
  ].filter((x) => x[3]);
  return `<button class="skip" data-act="skip">تخطَّ إلى المحتوى</button><div class="demo-banner"><span>${ic("info", "")} نسخة عرض للمراجعة — بيانات تجريبية محفوظة في هذا المتصفح فقط، وكل العمليات تعمل وتُحدّث الأرقام.</span><button data-act="reset">إعادة البيانات للبداية</button></div>
  <div class="app ${UI.collapsed ? "collapsed" : ""} ${UI.mnav ? "mnav" : ""}">
    <aside class="sidebar">
      <div class="brand"><div class="logo">B</div><div class="txt"><div class="t">سقالات البرق</div><div class="s">نظام البيع والتأجير</div></div></div>
      <nav class="nav">${nav}</nav>
      <div class="side-foot"><button class="collapse-btn" data-act="collapse">${ic("collapse")}<span class="lbl">${UI.collapsed ? "" : "طي القائمة"}</span></button></div>
    </aside>
    <div class="main">
      <header class="header">
        <button class="icon-btn menu-btn" data-act="mnav">${ic("menu")}</button>
        <div class="search"><input id="gsearch" placeholder="ابحث: عميل، جوال، هوية، سجل، فاتورة، بيع، إيجار، مشروع، صنف…" value="${esc(UI.search)}" data-act-input="gsearch" autocomplete="off">${ic("search")}${UI.search.trim().length >= 2 ? globalResults(UI.search) : ""}</div>
        <span class="grow"></span>
        ${headerClock()}
        <button class="icon-btn" data-act="toggleTools" title="الأدوات (T)" aria-pressed="${UI.toolsOpen ? "true" : "false"}">${ic("tools")}</button>
        ${qa.length ? `<div style="position:relative"><button class="icon-btn primary" data-act="menu" data-m="qa" title="إجراء سريع">${ic("plus")}</button>${UI.menu === "qa" ? `<div class="dropdown">${qa.map(([h, i, l]) => `<button data-act="quick" data-h="${h}">${ic(i)}${l}</button>`).join("")}</div>` : ""}</div>` : ""}
        <div style="position:relative"><button class="icon-btn" data-act="menu" data-m="notif" title="التنبيهات">${ic("bell")}${unread ? `<span class="dot">${unread > 99 ? "99+" : unread}</span>` : ""}</button>
          ${UI.menu === "notif" ? `<div class="dropdown" style="width:360px;max-height:460px;overflow:auto"><div class="row between" style="padding:6px 8px"><b>التنبيهات</b><button class="btn sm ghost" style="width:auto" data-act="readAll">تعليم الكل كمقروء</button></div>${notifs.length ? notifs.slice(0, 40).map((n) => `<a href="${n.link}" data-act="readNotif" data-k="${n.key}" style="align-items:flex-start;${S.readNotifs[u.id + n.key] ? "opacity:.55" : ""}"><span class="badge b-${n.type === "red" ? "red" : n.type === "amber" ? "amber" : n.type === "green" ? "green" : "blue"}" style="padding:2px 6px"></span><span class="col" style="gap:0"><b class="small">${esc(n.title)}</b><span class="xs muted">${esc(n.body)}</span></span></a>`).join("") : emptyBox("لا توجد تنبيهات", "bell")}</div>` : ""}</div>
        <div style="position:relative"><div class="user-chip" data-act="menu" data-m="user"><div class="txt col" style="gap:0;text-align:left"><b class="small">${esc(u.name)}</b><span class="xs muted">${ROLE_LABEL[u.role]}</span></div><div class="avatar">${esc(u.name[0])}</div></div>
          ${UI.menu === "user" ? `<div class="dropdown"><div style="padding:8px 10px" class="small muted">آخر دخول: <span class="num">${fmtDT(S.logins.filter((l) => l.username === u.username && l.ok).slice(-2)[0]?.at)}</span></div><button data-act="toggleTheme">${ic("moon")}${document.documentElement.dataset.theme === "dark" ? "الوضع النهاري" : "الوضع الليلي"}</button><button data-act="shortcuts">${ic("keyboard")}اختصارات لوحة المفاتيح</button><a href="#/profile">${ic("user")}الملف الشخصي وكلمة المرور</a><button data-act="switchUser">${ic("repeat")}تبديل المستخدم (للعرض)</button><button data-act="logout" style="color:var(--red)">${ic("logout")}تسجيل الخروج</button></div>` : ""}</div>
      </header>
      <main class="content${enter ? " enter" : ""}" id="content" tabindex="-1">${content}</main>
    </div>
    ${toolsPanel()}
  </div>`;
}

function globalResults(q) {
  const u = ME;
  const t = normText(q);
  const groups = [];
  const custs = searchCustomers(q).filter((x) => canSeeCustomer(u, x.customer) || u.role === "SELLER").slice(0, 6);
  if (custs.length)
    groups.push([
      "العملاء",
      custs.map(({ customer: c, key }) => {
        const full = canSeeCustomer(u, c);
        return `<a href="#/customers/${c.id}" data-act="closeSearch"><span>${esc(full ? c.name : c.name.split(" ")[0] + " •••")}${full ? "" : ' <span class="badge b-gray">لدى بائع آخر</span>'}</span><span class="xs muted">${key} · ${c.code}</span></a>`;
      }),
    ]);
  const projs = S.projects.filter((p) => normText(p.name + " " + p.code).includes(t) && canSeeCustomer(u, byId(S.customers, p.customerId))).slice(0, 5);
  if (projs.length) groups.push(["المشاريع", projs.map((p) => `<a href="#/customers/${p.customerId}?project=${p.id}" data-act="closeSearch"><span>${esc(p.name)}</span><span class="xs muted">${esc(custName(p.customerId))}</span></a>`)]);
  const sales = S.sales.filter((s) => normText(s.no).includes(t) && canSeeSale(u, s)).slice(0, 4);
  if (sales.length) groups.push(["المبيعات", sales.map((s) => `<a href="#/sales/${s.id}" data-act="closeSearch"><span class="num">${s.no}</span><span class="xs muted">${esc(custName(s.customerId))}</span></a>`)]);
  const rents = S.rentals.filter((r) => normText(r.no).includes(t) && canSeeRental(u, r)).slice(0, 4);
  if (rents.length) groups.push(["الإيجارات", rents.map((r) => `<a href="#/rentals/${r.id}" data-act="closeSearch"><span class="num">${r.no}</span><span class="xs muted">${esc(custName(r.customerId))}</span></a>`)]);
  const invs = S.invoices.filter((i) => normText(i.no).includes(t) && canSeeInvoice(u, i)).slice(0, 4);
  if (invs.length) groups.push(["الفواتير", invs.map((i) => `<a href="#/invoices/${i.id}" data-act="closeSearch"><span class="num">${i.no}</span><span class="xs muted">${esc(custName(i.customerId))}</span></a>`)]);
  const pays = S.payments.filter((p) => (normText(p.no).includes(t) || normText(p.repName).includes(t)) && canSeePayment(u, p)).slice(0, 4);
  if (pays.length) groups.push(["سندات القبض", pays.map((p) => `<a href="#/payments/${p.id}" data-act="closeSearch"><span class="num">${p.no}</span><span class="xs muted">${esc(p.repName || custName(p.customerId))}</span></a>`)]);
  const prods = S.products.filter((p) => normText(p.name + " " + p.sku).includes(t)).slice(0, 5);
  if (prods.length && can(u, "inventory")) groups.push(["الأصناف والمعدات", prods.map((p) => `<a href="#/inventory/${p.id}" data-act="closeSearch"><span>${esc(p.name)}</span><span class="xs muted">متاح ${nf0.format(balAll(p.id).AVAILABLE)}</span></a>`)]);
  return `<div class="search-results">${groups.length ? groups.map(([g, rows]) => `<div class="grp">${g}</div>${rows.join("")}`).join("") : `<div class="empty small">لا نتائج ضمن صلاحياتك</div>`}</div>`;
}

/* ─── النوافذ والتنبيهات ─── */
function openModal(title, body, footer, cls = "") {
  UI.modal = { title, body, footer, cls, fresh: true };
  renderModal();
}
function closeModal() {
  UI.modal = null;
  renderModal();
}
function renderModal() {
  let el = $("#modal-root");
  if (!UI.modal) {
    el.innerHTML = "";
    return;
  }
  const m = UI.modal;
  const body = typeof m.body === "function" ? m.body() : m.body;
  const footer = typeof m.footer === "function" ? m.footer() : m.footer;
  const active = document.activeElement;
  const fid = active && active.id;
  const pos = active && "selectionStart" in active ? active.selectionStart : null;
  const val = active && active.tagName === "INPUT" ? active.value : null;
  const anim = m.fresh ? " enter" : "";
  m.fresh = false;
  el.innerHTML = `<div class="overlay${anim}" data-act="overlay"><div class="modal ${m.cls}${anim}" role="dialog" aria-modal="true" aria-label="${esc(String(m.title).replace(/<[^>]+>/g, ""))}"><div class="modal-h"><h3>${m.title}</h3><button class="icon-btn" data-act="closeModal" style="width:34px;height:34px">${ic("x")}</button></div><div class="modal-b">${body}</div>${footer ? `<div class="modal-f">${footer}</div>` : ""}</div></div>`;
  restoreFocus(fid, pos, val);
}
function rerenderModal() {
  if (UI.modal) renderModal();
}
function toast(msg, type = "ok") {
  const t = document.createElement("div");
  t.className = "toast " + type;
  t.innerHTML = ic(type === "ok" ? "checkc" : "alert") + `<span>${msg}</span>`;
  $("#toasts").appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateY(6px)";
    setTimeout(() => t.remove(), 300);
  }, 3400);
}
function confirmDialog(title, text, onYes, { danger = true, yes = "تأكيد" } = {}) {
  UI.confirmCb = onYes;
  openModal(title, `<div class="alert ${danger ? "danger" : "info"}">${ic(danger ? "alert" : "info")}<div>${text}</div></div>`, `<button class="btn ${danger ? "danger" : "primary"}" data-act="confirmYes">${yes}</button><button class="btn" data-act="closeModal">تراجع</button>`);
}
/** يشغّل عملية مع حالة تحميل الزر ورسالة النجاح أو الخطأ */
function runAction(btn, fn, okMsg) {
  if (btn) {
    if (btn.dataset.busy) return;
    btn.dataset.busy = "1";
    btn.disabled = true;
    btn.innerHTML = `<span class="spin"></span> جارٍ الحفظ…`;
  }
  setTimeout(() => {
    try {
      const res = fn();
      if (okMsg) toast(typeof okMsg === "function" ? okMsg(res) : okMsg);
      render();
    } catch (e) {
      if (!(e instanceof DomainError)) console.error(e);
      toast(e.message, "err");
      if (btn) {
        delete btn.dataset.busy;
        btn.disabled = false;
        btn.innerHTML = btn.dataset.label || "حفظ";
      }
      rerenderModal();
    }
  }, 380);
}

/* ─── الأحداث العامة ─── */
const ACTIONS = {};
document.addEventListener("click", (ev) => {
  const act = ev.target.closest("[data-act]");
  if (act) {
    const name = act.dataset.act;
    if (name === "overlay" && ev.target !== act) {
      /* نقرة داخل النافذة */
    } else if (ACTIONS[name]) {
      ev.preventDefault();
      ACTIONS[name](act, ev);
      return;
    }
  }
  const tblBtn = ev.target.closest("[data-tbl-sort],[data-tbl-page],[data-tbl-export],[data-tbl-cols]");
  if (tblBtn) return tableClick(tblBtn);
  const goEl = ev.target.closest("[data-go]");
  if (goEl && !ev.target.closest("a,button,input,select,textarea,label")) {
    go(goEl.dataset.go.replace(/^#/, ""));
    return;
  }
  if (UI.menu && !ev.target.closest(".dropdown")) {
    UI.menu = null;
    render();
  }
  if (UI.search && !ev.target.closest(".search")) {
    UI.search = "";
    render();
  }
  document.querySelectorAll(".cols-menu").forEach((m) => {
    if (!ev.target.closest(".cols-menu")) m.classList.add("hide");
  });
});
document.addEventListener("input", (ev) => {
  const el = ev.target;
  if (el.dataset.tblQ) {
    TBL[el.dataset.tblQ].q = el.value;
    TBL[el.dataset.tblQ].page = 0;
    render();
    return;
  }
  const a = el.dataset.actInput;
  if (a && ACTIONS[a]) ACTIONS[a](el, ev);
});
document.addEventListener("change", (ev) => {
  const el = ev.target;
  if (el.dataset.tblF) {
    TBL[el.dataset.tblF].filters[el.dataset.key] = el.value;
    TBL[el.dataset.tblF].page = 0;
    return render();
  }
  if (el.dataset.tblCol) {
    const st = TBL[el.dataset.tblCol];
    el.checked ? st.hidden.delete(el.dataset.key) : st.hidden.add(el.dataset.key);
    render();
    const m = document.getElementById("cols-" + el.dataset.tblCol);
    if (m) m.classList.remove("hide");
    return;
  }
  if (el.dataset.tblSize) {
    TBL[el.dataset.tblSize].size = +el.value;
    TBL[el.dataset.tblSize].page = 0;
    return render();
  }
  const a = el.dataset.actChange;
  if (a && ACTIONS[a]) ACTIONS[a](el, ev);
});
function tableClick(el) {
  const d = el.dataset;
  if (d.tblSort) {
    const st = TBL[d.tblSort];
    if (st.sort === d.key) st.dir = st.dir === "asc" ? "desc" : "asc";
    else {
      st.sort = d.key;
      st.dir = "desc";
    }
    return render();
  }
  if (d.tblPage) {
    TBL[d.tblPage].page += +d.d;
    return render();
  }
  if (d.tblExport) {
    const csv = "﻿" + TBL[d.tblExport]._export();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `${d.tblExport}-${isoDay(Date.now())}.csv`;
    a.click();
    audit(ME, "EXPORT", "Table", d.tblExport);
    touch();
    return toast("تم تصدير الجدول بالفلاتر الحالية وضمن صلاحياتك");
  }
  if (d.tblCols) document.getElementById("cols-" + d.tblCols).classList.toggle("hide");
}
/* تلميحات الرسوم */
let tipEl = null;
document.addEventListener("mouseover", (ev) => {
  const t = ev.target.closest("[data-tip]");
  if (!t) {
    if (tipEl) tipEl.remove(), (tipEl = null);
    return;
  }
  if (!tipEl) {
    tipEl = document.createElement("div");
    tipEl.className = "tip";
    document.body.appendChild(tipEl);
  }
  tipEl.innerHTML = t.dataset.tip;
});
document.addEventListener("mousemove", (ev) => {
  if (tipEl) {
    tipEl.style.top = ev.clientY + 14 + "px";
    tipEl.style.left = Math.min(ev.clientX + 14, innerWidth - tipEl.offsetWidth - 8) + "px";
  }
});
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && UI.modal) closeModal();
  if ((ev.key === "Enter" || ev.key === " ") && ev.target.matches?.("[data-go][tabindex]")) {
    ev.preventDefault();
    go(ev.target.dataset.go.replace(/^#/, ""));
  }
});

Object.assign(ACTIONS, {
  pdf: (el) => {
    const target = document.querySelector(el.dataset.target || ".print-sheet");
    if (!target || typeof downloadPdf !== "function") return toast("تعذّر تجهيز ملف PDF", "err");
    const no = target.querySelector(".ps-no")?.textContent.trim();
    const name = el.dataset.name || (no ? no.replace(/s+/g, " ") : document.title);
    const land = el.dataset.land === "1" || target.classList.contains("land");
    const label = el.innerHTML;
    el.disabled = true;
    el.innerHTML = '<span class="spin"></span> جارٍ تجهيز الملف…';
    document.body.classList.add("pdf-mode");
    setTimeout(() => {
      downloadPdf(target, name, land)
        .then(() => toast("تم حفظ الملف " + name + ".pdf"))
        .catch((e) => (console.error(e), toast("تعذّر تجهيز ملف PDF", "err")))
        .finally(() => {
          document.body.classList.remove("pdf-mode");
          el.disabled = false;
          el.innerHTML = label;
        });
    }, 60);
  },
  skip: () => document.getElementById("content")?.focus(),
  collapse: () => ((UI.collapsed = !UI.collapsed), render()),
  mnav: () => ((UI.mnav = !UI.mnav), render()),
  menu: (el) => ((UI.menu = UI.menu === el.dataset.m ? null : el.dataset.m), render()),
  logout: () => doLogout(),
  switchUser: () => {
    localStorage.removeItem(SESSION_KEY);
    UI.menu = null;
    go("/login");
  },
  closeModal: () => closeModal(),
  overlay: (el, ev) => {
    if (ev.target === el) closeModal();
  },
  confirmYes: () => {
    const cb = UI.confirmCb;
    closeModal();
    if (cb) cb();
  },
  reset: () =>
    confirmDialog("إعادة بيانات العرض", "سيتم حذف كل العمليات التي أجريتها في هذا المتصفح وإرجاع بيانات العرض كما كانت. هل تريد المتابعة؟", () => {
      localStorage.removeItem(STORE_KEY);
      seedState();
      save();
      for (const k in TBL) delete TBL[k];
      toast("أعيدت بيانات العرض للبداية");
      render();
    }),
  period: (el) => {
    UI.period.key = el.dataset.k;
    render();
  },
  periodFrom: (el) => setRange(el.value, null),
  periodTo: (el) => setRange(null, el.value),
  gsearch: (el) => ((UI.search = el.value), render()),
  closeSearch: () => (UI.search = ""),
  readNotif: (el) => {
    S.readNotifs[ME.id + el.dataset.k] = true;
    UI.menu = null;
    save();
    go(el.getAttribute("href").replace(/^#/, ""));
  },
  readAll: () => {
    for (const n of notificationsFor(ME)) S.readNotifs[ME.id + n.key] = true;
    save();
    render();
  },
  quick: (el) => {
    UI.menu = null;
    const h = el.dataset.h;
    if (h === "@customer") return openCustomerModal();
    if (h === "@payment") return openPaymentPicker();
    if (h === "@expense") return openExpenseModal();
    go(h);
  },
});

window.addEventListener("hashchange", () => {
  UI.menu = null;
  UI.mnav = false;
  UI.search = "";
  render();
  window.scrollTo(0, 0);
});
// تحديث دوري: يحاكي ظهور عمليات المستخدمين الآخرين (جلسة أخرى في تبويب آخر)
window.addEventListener("storage", (ev) => {
  if (ev.key === STORE_KEY && ev.newValue) {
    try {
      S = JSON.parse(ev.newValue);
      VER++;
      if (!UI.modal) render();
    } catch (e) {}
  }
});

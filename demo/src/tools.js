/* ═══════════ أدوات مساعدة للموظفين (CR-004) ═══════════
   حاسبة، حاسبة إيجار، أمتار، تاريخ هجري، تفقيط، ملاحظات، تذكيرات، مفضلة، واتساب، نسخ، اختصارات، وضع ليلي.
   لا تغيّر أي رصيد أو قاعدة حساب. */
"use strict";

/* ─── دوال نقية (مختبرة في سيناريوهات القبول) ─── */

/** آلة حاسبة آمنة بلا eval: + − × ÷ % وأقواس، وتقبل الأرقام العربية */
function calcEval(input) {
  const src = toLatin(String(input || ""))
    .replace(/[×xX*]/g, "*")
    .replace(/[÷/]/g, "/")
    .replace(/[−–—]/g, "-")
    .replace(/٫/g, ".")
    .replace(/[,٬\s]/g, "");
  if (!src) return null;
  // تقطيع يدوي بلا تعابير منتظمة (لا مخاطر ReDoS على مدخلات المستخدم)
  if (src.length > 200) throw new Error("الصيغة طويلة جدًا");
  const tokens = [];
  for (let p = 0; p < src.length; ) {
    const ch = src[p];
    if ("+-*/%()".includes(ch)) {
      tokens.push(ch);
      p++;
    } else if (ch >= "0" && ch <= "9") {
      let q = p;
      let dot = false;
      while (q < src.length && ((src[q] >= "0" && src[q] <= "9") || (src[q] === "." && !dot))) {
        if (src[q] === ".") dot = true;
        q++;
      }
      tokens.push(src.slice(p, q));
      p = q;
    } else throw new Error("صيغة غير صحيحة");
  }
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];
  function factor() {
    let t = next();
    if (t === "-") return -factor();
    if (t === "+") return factor();
    let v;
    if (t === "(") {
      v = expr();
      if (next() !== ")") throw new Error("قوس ناقص");
    } else if (/^\d/.test(t || "")) v = parseFloat(t);
    else throw new Error("صيغة غير صحيحة");
    while (peek() === "%") {
      next();
      v = v / 100;
    }
    return v;
  }
  function term() {
    let v = factor();
    while (peek() === "*" || peek() === "/") {
      const op = next();
      const r = factor();
      if (op === "/" && r === 0) throw new Error("القسمة على صفر");
      v = op === "*" ? v * r : v / r;
    }
    return v;
  }
  function expr() {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      // «100 + 15%» تعني زيادة 15% من 100
      const save = i;
      const r = term();
      const wasPct = tokens[i - 1] === "%" && tokens.slice(save, i).filter((x) => x === "%").length === 1 && tokens.slice(save, i).length === 2;
      const add = wasPct ? v * r : r;
      v = op === "+" ? v + add : v - add;
    }
    return v;
  }
  const v = expr();
  if (i !== tokens.length) throw new Error("صيغة غير صحيحة");
  return Math.round(v * 1e6) / 1e6;
}

/** عرض سعر إيجار سريع — نفس قاعدة الفوترة (BR-015): العدد × الشهري ÷ 30 × الأيام */
function quickRentalQuote(qty, monthlyHalalas, days, vatRate) {
  const amount = Math.round((qty * days * monthlyHalalas) / 30);
  const vat = vatOf(amount, vatRate);
  return { amount, vat, total: amount + vat };
}

/** الأيام بين تاريخين شاملة اليومين (عرف المؤسسة) */
const inclusiveDays = (fromISO, toISO) => dayNo(parseDay(toISO)) - dayNo(parseDay(fromISO)) + 1;

/** رقم واتساب دولي من جوال سعودي */
function waNumber(mobile) {
  const m = normalizeMobile(mobile);
  return /^05\d{8}$/.test(m) ? "966" + m.slice(1) : "";
}
const waLink = (mobile, text) => (waNumber(mobile) ? `https://wa.me/${waNumber(mobile)}?text=${encodeURIComponent(text)}` : "");

/** هجري ← ميلادي: بحث في نطاق قريب باستخدام تقويم أم القرى */
function hijriParts(t) {
  const f = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { timeZone: "Asia/Riyadh", year: "numeric", month: "numeric", day: "numeric" });
  const p = Object.fromEntries(f.formatToParts(new Date(t)).filter((x) => x.type !== "literal").map((x) => [x.type, parseInt(x.value, 10)]));
  return { y: p.year, m: p.month, d: p.day };
}
function hijriToGregorian(y, m, d) {
  // تقدير أولي ثم بحث ±40 يومًا
  const approx = Date.UTC(622, 6, 16) + ((y - 1) * 354.36707 + (m - 1) * 29.530588 + (d - 1)) * DAY;
  for (let k = -40; k <= 40; k++) {
    const t = approx + k * DAY;
    const h = hijriParts(t);
    if (h.y === y && h.m === m && h.d === d) return dayStart(dayNo(t));
  }
  return null;
}

/* ─── الحالة الإضافية (لا تمسح بيانات المستخدم) ─── */
function ensureToolsState() {
  if (!S) return;
  S.notes ||= {};
  S.reminders ||= [];
  S.favorites ||= {};
}
const isFav = (cid) => !!(ME && S.favorites?.[ME.id]?.includes(cid));

/* ─── اللوحة ─── */
const TOOL_TABS = [
  ["calc", "calc", "الحاسبة"],
  ["rent", "key", "حاسبة الإيجار"],
  ["meters", "hash", "الأمتار والقطع"],
  ["date", "calendar", "هجري / ميلادي"],
  ["words", "doc", "التفقيط"],
  ["notes", "edit", "ملاحظاتي"],
  ["todo", "bell", "تذكيراتي"],
];
UI.tl = { tab: "calc", expr: "", hist: [], rq: 100, rm: "", rd: 30, rf: "", rt: "", rvat: true, rp: "", mc: 10, ml: "4", mm: "", mmL: "4", dg: "", hy: "", hm: "", hd: "", wa: "", rmText: "", rmDue: "", rmCust: "" };

function toolsPanel() {
  if (!UI.toolsOpen) return "";
  const T = UI.tl;
  const tabs = TOOL_TABS.map(([k, i, l]) => `<button class="${T.tab === k ? "on" : ""}" data-act="tlTab" data-k="${k}" title="${l}">${ic(i)}<span>${l}</span></button>`).join("");
  return `<aside class="tools-panel" aria-label="أدوات"><div class="tools-h"><b>${ic("tools")} الأدوات</b><button class="icon-btn" data-act="toggleTools" title="إغلاق (Esc)">${ic("x")}</button></div><div class="tools-tabs">${tabs}</div><div class="tools-b">${toolBody(T.tab)}</div></aside>`;
}

function copyBtn(text, label = "نسخ") {
  return `<button class="btn sm" data-act="copy" data-v="${esc(text)}">${ic("copy")}${label}</button>`;
}

function toolBody(tab) {
  const T = UI.tl;
  if (tab === "calc") {
    let res = "",
      err = "";
    try {
      const v = calcEval(T.expr);
      res = v === null ? "" : String(v);
    } catch (e) {
      err = e.message;
    }
    const keys = ["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", "0", ".", "%", "+", "(", ")", "⌫", "C"];
    return `<input class="input calc-in" id="tl-expr" dir="ltr" value="${esc(T.expr)}" placeholder="مثال: 3 × 100 + 15%" data-act-input="tlSet" data-k="expr" autocomplete="off">
    <div class="calc-out num">${err ? `<span class="faint small">${esc(err)}</span>` : res ? `= ${nf2.format(+res)}` : "&nbsp;"}</div>
    <div class="calc-keys">${keys.map((k) => `<button class="btn" data-act="calcKey" data-k="${k}">${k}</button>`).join("")}<button class="btn primary" data-act="calcKey" data-k="=" style="grid-column:span 4">=</button></div>
    <div class="row wrap" style="margin-top:10px"><button class="btn sm" data-act="calcVat" data-k="add">+ ضريبة ${S.settings.vatRate}%</button><button class="btn sm" data-act="calcVat" data-k="remove">بدون ضريبة</button>${res ? copyBtn(res, "نسخ الناتج") : ""}</div>
    ${T.hist.length ? `<div class="section-title" style="margin:14px 0 6px">السجل</div>${T.hist.slice(-6).reverse().map((h) => `<div class="row between small"><span class="num muted" dir="ltr">${esc(h.e)}</span><b class="num">${nf2.format(h.v)}</b></div>`).join("")}` : ""}`;
  }
  if (tab === "rent") {
    const days = T.rf && T.rt ? Math.max(0, inclusiveDays(T.rf, T.rt)) : parseInt(toLatin(String(T.rd)), 10) || 0;
    const qty = parseInt(toLatin(String(T.rq)), 10) || 0;
    const monthly = parseMoney(T.rm || "0");
    const q = quickRentalQuote(qty, monthly, days, T.rvat ? S.settings.vatRate : 0);
    const prods = S.products.filter((p) => p.status === "ACTIVE");
    const msg = `عرض سعر إيجار — ${COMPANY.name}\n${T.rp ? prodName(T.rp) + "\n" : ""}العدد: ${qty} قطعة\nالإيجار الشهري للقطعة: ${nf2.format(monthly / 100)} ر.س\nالمدة: ${days} يوم\nالمبلغ: ${nf2.format(q.amount / 100)} ر.س${T.rvat ? `\nالضريبة ${S.settings.vatRate}%: ${nf2.format(q.vat / 100)} ر.س` : ""}\nالإجمالي: ${nf2.format(q.total / 100)} ر.س`;
    return `<div class="hint" style="margin-bottom:8px">نفس طريقة فواتير المؤسسة: العدد × الإيجار الشهري ÷ 30 × الأيام (شاملة يوم البداية والنهاية).</div>
    <div class="field"><label>الصنف (اختياري — يملأ السعر الشهري)</label><select class="select" data-act-change="tlProd"><option value="">—</option>${prods.map((p) => `<option value="${p.id}" ${T.rp === p.id ? "selected" : ""}>${esc(p.name)} — ${nf2.format(p.rentM / 100)} شهريًا</option>`).join("")}</select></div>
    <div class="form-grid" style="margin-top:8px"><div class="field"><label>العدد</label><input class="input" id="tl-rq" value="${esc(T.rq)}" inputmode="numeric" data-act-input="tlSet" data-k="rq"></div><div class="field"><label>الإيجار الشهري للقطعة</label><input class="input" id="tl-rm" value="${esc(T.rm)}" inputmode="decimal" placeholder="0.00" data-act-input="tlSet" data-k="rm"></div>
    <div class="field"><label>الأيام</label><input class="input" id="tl-rd" value="${esc(T.rd)}" inputmode="numeric" data-act-input="tlSet" data-k="rd" ${T.rf && T.rt ? "disabled" : ""}></div><div class="field"><label>الضريبة</label><label class="row small"><input type="checkbox" data-act-change="tlVat" ${T.rvat ? "checked" : ""}> تشمل ${S.settings.vatRate}%</label></div>
    <div class="field"><label>أو من تاريخ</label><input type="date" class="input" value="${T.rf}" data-act-change="tlDate" data-k="rf"></div><div class="field"><label>إلى تاريخ</label><input type="date" class="input" value="${T.rt}" data-act-change="tlDate" data-k="rt"></div></div>
    <div class="quote"><div class="row between"><span class="muted">المدة</span><b class="num">${days} يوم</b></div><div class="row between"><span class="muted">المبلغ</span><b class="num">${nf2.format(q.amount / 100)}</b></div>${T.rvat ? `<div class="row between"><span class="muted">الضريبة</span><b class="num">${nf2.format(q.vat / 100)}</b></div>` : ""}<div class="row between big"><span>الإجمالي</span><b class="num">${nf2.format(q.total / 100)} ر.س</b></div></div>
    <div class="row wrap" style="margin-top:10px">${copyBtn(msg, "نسخ العرض")}<input class="input" style="width:150px;height:30px" id="tl-wa" value="${esc(T.wa)}" placeholder="جوال العميل" inputmode="tel" data-act-input="tlSet" data-k="wa">${waLink(T.wa, msg) ? `<a class="btn sm wa" href="${waLink(T.wa, msg)}" target="_blank" rel="noopener">${ic("whatsapp")}واتساب</a>` : ""}</div>`;
  }
  if (tab === "meters") {
    const c = parseInt(toLatin(String(T.mc)), 10) || 0;
    const l = parseFloat(toLatin(String(T.ml))) || 0;
    const m = parseFloat(toLatin(String(T.mm))) || 0;
    const L = parseFloat(toLatin(String(T.mmL))) || 0;
    const lens = [...new Set(S.products.filter((p) => p.len).map((p) => p.len))].sort((a, b) => a - b);
    const lenOpts = (sel) => lens.map((x) => `<option value="${x}" ${+sel === x ? "selected" : ""}>${x.toFixed(2)} م</option>`).join("");
    return `<div class="section-title" style="margin:0 0 8px">العدد ← الأمتار</div><div class="form-grid"><div class="field"><label>العدد (قطع)</label><input class="input" id="tl-mc" value="${esc(T.mc)}" inputmode="numeric" data-act-input="tlSet" data-k="mc"></div><div class="field"><label>طول القطعة</label><select class="select" data-act-change="tlSel" data-k="ml">${lenOpts(T.ml)}</select></div></div>
    <div class="quote"><div class="row between big"><span>الكمية</span><b class="num">${nf2.format(c * l)} م</b></div></div>
    <div class="section-title" style="margin:16px 0 8px">الأمتار ← العدد</div><div class="form-grid"><div class="field"><label>الأمتار المطلوبة</label><input class="input" id="tl-mm" value="${esc(T.mm)}" inputmode="decimal" data-act-input="tlSet" data-k="mm"></div><div class="field"><label>طول القطعة</label><select class="select" data-act-change="tlSel" data-k="mmL">${lenOpts(T.mmL)}</select></div></div>
    <div class="quote"><div class="row between big"><span>العدد اللازم</span><b class="num">${L ? Math.ceil(m / L) : 0} قطعة</b></div>${L && m && m % L ? `<div class="xs faint">يزيد ${nf2.format(Math.ceil(m / L) * L - m)} م عن المطلوب</div>` : ""}</div>`;
  }
  if (tab === "date") {
    const g = T.dg || isoDay(Date.now());
    const h = hijriParts(parseDay(g) + 12 * 3600000);
    let back = "";
    const hy = parseInt(toLatin(T.hy), 10),
      hm = parseInt(toLatin(T.hm), 10),
      hd = parseInt(toLatin(T.hd), 10);
    if (hy && hm && hd) {
      const t = hijriToGregorian(hy, hm, hd);
      back = t ? `${fmtDate(t)} م — ${new Intl.DateTimeFormat("ar-SA", { weekday: "long", timeZone: "Asia/Riyadh" }).format(new Date(t + 12 * 3600000))}` : "تاريخ هجري غير صحيح";
    }
    return `<div class="section-title" style="margin:0 0 8px">ميلادي ← هجري</div><input type="date" class="input" value="${g}" data-act-change="tlDate" data-k="dg">
    <div class="quote"><div class="row between big"><span>الهجري (أم القرى)</span><b class="num">${h.d}/${h.m}/${h.y} هـ</b></div>${copyBtn(`${h.d}/${h.m}/${h.y} هـ`)}</div>
    <div class="section-title" style="margin:16px 0 8px">هجري ← ميلادي</div><div class="form-grid" style="grid-template-columns:repeat(3,1fr)"><div class="field"><label>اليوم</label><input class="input" id="tl-hd" value="${esc(T.hd)}" inputmode="numeric" data-act-input="tlSet" data-k="hd"></div><div class="field"><label>الشهر</label><input class="input" id="tl-hm" value="${esc(T.hm)}" inputmode="numeric" data-act-input="tlSet" data-k="hm"></div><div class="field"><label>السنة</label><input class="input" id="tl-hy" value="${esc(T.hy)}" inputmode="numeric" placeholder="1448" data-act-input="tlSet" data-k="hy"></div></div>
    ${back ? `<div class="quote"><div class="row between big"><span>الميلادي</span><b class="num">${back}</b></div></div>` : ""}`;
  }
  if (tab === "words") {
    const v = parseMoney(T.w || "0");
    const txt = v > 0 ? tafqeet(v) : "";
    return `<div class="field"><label>المبلغ</label><input class="input" id="tl-w" value="${esc(T.w || "")}" inputmode="decimal" placeholder="مثال: 16902.50" data-act-input="tlSet" data-k="w"></div>
    ${txt ? `<div class="quote"><b style="font-size:15px;line-height:1.8">${esc(txt)}</b></div>${copyBtn(txt)}` : `<div class="hint" style="margin-top:8px">يكتب المبلغ بالحروف كما في سندات القبض والصرف.</div>`}`;
  }
  if (tab === "notes") {
    const mine = S.notes[ME.id] || "";
    return `<div class="hint" style="margin-bottom:6px">ملاحظات شخصية لك فقط، تُحفظ تلقائيًا أثناء الكتابة.</div><textarea class="input notes-ta" id="tl-notes" data-act-input="tlNotes" placeholder="اكتب ملاحظاتك هنا…">${esc(mine)}</textarea><div class="row between xs faint" style="margin-top:4px"><span>${mine.length} حرف</span>${mine ? copyBtn(mine, "نسخ الكل") : ""}</div>`;
  }
  if (tab === "todo") {
    const mine = S.reminders.filter((r) => r.userId === ME.id).sort((a, b) => a.done - b.done || (a.due || 0) - (b.due || 0));
    const today = dayNo(Date.now());
    const custs = S.customers.filter((c) => canSeeCustomer(ME, c));
    return `<div class="field"><label>تذكير جديد</label><input class="input" id="tl-rmtext" value="${esc(T.rmText)}" placeholder="مثال: اتصل بمؤسسة الأفق بخصوص الدفعة" data-act-input="tlSet" data-k="rmText"></div>
    <div class="form-grid" style="margin-top:6px"><div class="field"><label>الموعد</label><input type="date" class="input" value="${T.rmDue}" data-act-change="tlDate" data-k="rmDue"></div><div class="field"><label>العميل (اختياري)</label><select class="select" data-act-change="tlSel" data-k="rmCust"><option value="">—</option>${custs.map((c) => `<option value="${c.id}" ${T.rmCust === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div></div>
    <button class="btn primary sm" style="margin-top:8px" data-act="rmAdd">${ic("plus")}إضافة التذكير</button>
    <div style="margin-top:12px">${mine.length ? mine.map((r) => `<div class="todo ${r.done ? "done" : ""}"><input type="checkbox" data-act-change="rmToggle" data-id="${r.id}" ${r.done ? "checked" : ""} aria-label="تم"><div class="grow"><div class="small">${esc(r.text)}</div><div class="xs muted">${r.due ? `<span class="${!r.done && dayNo(r.due) < today ? "late" : !r.done && dayNo(r.due) === today ? "today" : ""}">${fmtDate(r.due)}</span>` : "بدون موعد"}${r.customerId ? ` · <a class="link" href="#/customers/${r.customerId}">${esc(custName(r.customerId))}</a>` : ""}</div></div><button class="btn sm ghost" data-act="rmDel" data-id="${r.id}" title="حذف">${ic("x")}</button></div>`).join("") : emptyBox("لا تذكيرات", "bell")}</div>`;
  }
  return "";
}

/* ─── الإجراءات ─── */
const keepPanel = () => render();
Object.assign(ACTIONS, {
  toggleTools: () => ((UI.toolsOpen = !UI.toolsOpen), render()),
  tlTab: (el) => ((UI.tl.tab = el.dataset.k), (UI.toolsOpen = true), render()),
  tlSet: (el) => ((UI.tl[el.dataset.k] = el.value), keepPanel()),
  tlSel: (el) => ((UI.tl[el.dataset.k] = el.value), keepPanel()),
  tlDate: (el) => ((UI.tl[el.dataset.k] = el.value), keepPanel()),
  tlVat: (el) => ((UI.tl.rvat = el.checked), keepPanel()),
  tlProd: (el) => {
    UI.tl.rp = el.value;
    const p = byId(S.products, el.value);
    if (p) UI.tl.rm = (p.rentM / 100).toFixed(2);
    keepPanel();
  },
  calcKey: (el) => {
    const k = el.dataset.k;
    const T = UI.tl;
    if (k === "C") T.expr = "";
    else if (k === "⌫") T.expr = T.expr.slice(0, -1);
    else if (k === "=") {
      try {
        const v = calcEval(T.expr);
        if (v !== null) {
          T.hist.push({ e: T.expr, v });
          T.expr = String(v);
        }
      } catch (e) {
        toast(e.message, "err");
      }
    } else T.expr += k === "−" ? "-" : k;
    keepPanel();
  },
  calcVat: (el) => {
    const T = UI.tl;
    try {
      const v = calcEval(T.expr);
      if (v === null) return;
      const r = S.settings.vatRate / 100;
      const out = el.dataset.k === "add" ? v * (1 + r) : v / (1 + r);
      const rounded = Math.round(out * 100) / 100;
      T.hist.push({ e: `${v} ${el.dataset.k === "add" ? "+" : "−"} ${S.settings.vatRate}%`, v: rounded });
      T.expr = String(rounded);
    } catch (e) {
      toast(e.message, "err");
    }
    keepPanel();
  },
  tlNotes: (el) => {
    ensureToolsState();
    S.notes[ME.id] = el.value;
    save();
  },
  rmAdd: () => {
    ensureToolsState();
    const T = UI.tl;
    if (!T.rmText.trim()) return toast("اكتب نص التذكير", "err");
    S.reminders.push({ id: uid("rm"), userId: ME.id, text: T.rmText.trim(), due: T.rmDue ? parseDay(T.rmDue) + 9 * 3600000 : null, customerId: T.rmCust || null, done: false, at: Date.now() });
    T.rmText = "";
    T.rmCust = "";
    touch();
    toast("تمت إضافة التذكير");
    render();
  },
  rmToggle: (el) => {
    const r = S.reminders.find((x) => x.id === el.dataset.id && x.userId === ME.id);
    if (r) r.done = el.checked;
    touch();
    render();
  },
  rmDel: (el) => {
    S.reminders = S.reminders.filter((x) => !(x.id === el.dataset.id && x.userId === ME.id));
    touch();
    render();
  },
  copy: (el) => {
    const v = el.dataset.v || "";
    const done = () => toast("تم النسخ");
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(v).then(done, () => fallbackCopy(v) && done());
    else if (fallbackCopy(v)) done();
  },
  fav: (el) => {
    ensureToolsState();
    const list = (S.favorites[ME.id] ||= []);
    const i = list.indexOf(el.dataset.c);
    i >= 0 ? list.splice(i, 1) : list.push(el.dataset.c);
    touch();
    toast(i >= 0 ? "أُزيل من المفضلة" : "أُضيف إلى المفضلة");
    render();
  },
  pinNote: (el) => {
    const kind = el.dataset.kind;
    const obj = kind === "project" ? byId(S.projects, el.dataset.id) : byId(S.customers, el.dataset.id);
    UI.pn = { kind, id: obj.id, text: obj.pinnedNote?.text || "" };
    openModal(
      kind === "project" ? "ملاحظة مثبتة على المشروع — " + esc(obj.name) : "ملاحظة مثبتة على العميل — " + esc(obj.name),
      () => `<textarea class="input" id="pn-text" style="min-height:110px" data-act-input="pnText" placeholder="مثال: لا يُسلَّم إلا بحضور المهندس">${esc(UI.pn.text)}</textarea><div class="hint" style="margin-top:6px">تظهر لكل الموظفين في أعلى البروفايل. لحذفها امسح النص واحفظ.</div>`,
      `<button class="btn primary" data-act="pnSave2">${ic("check")}حفظ</button><button class="btn" data-act="closeModal">إلغاء</button>`,
    );
  },
  pnText: (el) => (UI.pn.text = el.value),
  pnSave2: () => {
    const obj = UI.pn.kind === "project" ? byId(S.projects, UI.pn.id) : byId(S.customers, UI.pn.id);
    const before = obj.pinnedNote || null;
    obj.pinnedNote = UI.pn.text.trim() ? { text: UI.pn.text.trim(), by: ME.id, at: Date.now() } : null;
    audit(ME, "PINNED_NOTE", UI.pn.kind === "project" ? "Project" : "Customer", obj.id, before, obj.pinnedNote);
    touch();
    closeModal();
    toast("تم حفظ الملاحظة");
    render();
  },
  toggleTheme: () => {
    const cur = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(cur);
    UI.menu = null;
    render();
  },
  shortcuts: () => openModal("اختصارات لوحة المفاتيح", shortcutsHelp, `<button class="btn" data-act="closeModal">إغلاق</button>`),
});
function fallbackCopy(v) {
  const t = document.createElement("textarea");
  t.value = v;
  t.style.position = "fixed";
  t.style.opacity = "0";
  document.body.appendChild(t);
  t.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch (e) {}
  t.remove();
  return ok;
}

/* ─── الوضع الليلي (تفضيل لكل جهاز) ─── */
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem("barq-theme", t);
  } catch (e) {}
}
(function initTheme() {
  let t = null;
  try {
    t = localStorage.getItem("barq-theme");
  } catch (e) {}
  if (t === "dark" || t === "light") document.documentElement.dataset.theme = t;
})();

/* ─── اختصارات لوحة المفاتيح ─── */
const SHORTCUTS = [
  ["N", "بيع جديد", "/sales/new", "sales.create"],
  ["R", "إيجار جديد", "/rentals/new", "rentals.create"],
  ["C", "العملاء", "/customers", null],
  ["I", "الفواتير", "/invoices", "invoices|invoices.own"],
  ["H", "لوحتي", "@home", null],
  ["/", "البحث العام", "@search", null],
  ["T", "الأدوات", "@tools", null],
  ["K", "الحاسبة", "@calc", null],
  ["?", "عرض الاختصارات", "@help", null],
  ["Esc", "إغلاق النافذة أو الأدوات", "", null],
];
function shortcutsHelp() {
  return `<div class="col" style="gap:6px">${SHORTCUTS.filter(([, , , p]) => !p || p.split("|").some((x) => can(ME, x)))
    .map(([k, l]) => `<div class="row between"><span>${l}</span><kbd>${k}</kbd></div>`)
    .join("")}</div><div class="hint" style="margin-top:10px">تعمل الاختصارات عندما لا تكون تكتب داخل حقل.</div>`;
}
document.addEventListener("keydown", (ev) => {
  if (!ME || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  const tag = (ev.target.tagName || "").toLowerCase();
  if (ev.key === "Escape" && UI.toolsOpen && !UI.modal) {
    UI.toolsOpen = false;
    return render();
  }
  if (tag === "input" || tag === "textarea" || tag === "select" || ev.target.isContentEditable) return;
  const key = ev.key.length === 1 ? ev.key.toUpperCase() : ev.key;
  // تخطيط لوحة المفاتيح العربية: نفس المواضع الفيزيائية
  const arabic = { "ى": "N", "ق": "R", "ؤ": "C", "ه": "I", "ا": "H", "ف": "T", "ن": "K", "؟": "?" };
  const k = arabic[ev.key] || key;
  const sc = SHORTCUTS.find(([s]) => s === k);
  if (!sc) return;
  const [, , target, perm] = sc;
  if (perm && !perm.split("|").some((x) => can(ME, x))) return;
  ev.preventDefault();
  if (target === "@home") go(ROLE_HOME[ME.role]);
  else if (target === "@search") document.getElementById("gsearch")?.focus();
  else if (target === "@tools") ((UI.toolsOpen = !UI.toolsOpen), render());
  else if (target === "@calc") ((UI.toolsOpen = true), (UI.tl.tab = "calc"), render(), setTimeout(() => document.getElementById("tl-expr")?.focus(), 0));
  else if (target === "@help") ACTIONS.shortcuts();
  else if (target) go(target);
});

/* ─── الساعة والتاريخ الهجري في الرأس ─── */
function headerClock() {
  const now = Date.now();
  const h = hijriParts(now);
  return `<div class="hclock" title="بتوقيت الرياض"><b class="num">${timeFmt.format(new Date(now))}</b><span class="num">${h.d}/${h.m}/${h.y} هـ · ${fmtDate(now)}</span></div>`;
}
setInterval(() => {
  const el = document.querySelector(".hclock");
  if (el) el.outerHTML = headerClock();
}, 30000);

/* ─── واتساب للمستندات ─── */
function waButton(mobile, text, label = "واتساب") {
  const href = waLink(mobile, text);
  return href ? `<a class="btn wa no-pdf" href="${href}" target="_blank" rel="noopener" title="يفتح واتساب برسالة جاهزة — راجعها قبل الإرسال">${ic("whatsapp")}${label}</a>` : "";
}
const msgInvoice = (i) =>
  `السلام عليكم ${custName(i.customerId)}،\nفاتورة رقم ${i.no} بتاريخ ${fmtDate(i.at)}${i.projectId ? ` — مشروع ${projName(i.projectId)}` : ""}\nالإجمالي: ${nf2.format(i.total / 100)} ر.س\nالمدفوع: ${nf2.format(invPaid(i) / 100)} ر.س\nالمتبقي: ${nf2.format(invRemaining(i) / 100)} ر.س\nتاريخ الاستحقاق: ${fmtDate(i.due)}\n${COMPANY.name}`;
const msgPayment = (p) => `السلام عليكم ${custName(p.customerId)}،\nاستلمنا منكم مبلغ ${nf2.format(p.amount / 100)} ر.س بسند قبض رقم ${p.no} بتاريخ ${fmtDate(p.at)}.\nشكرًا لكم.\n${COMPANY.name}`;
const msgStatement = (c, bal) => `السلام عليكم ${c.name}،\nرصيد حسابكم المستحق حتى ${fmtDate(Date.now())}: ${nf2.format(bal / 100)} ر.س.\nللاستفسار يسعدنا تواصلكم.\n${COMPANY.name}`;

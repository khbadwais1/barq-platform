/* ═══════════ مكونات الواجهة ═══════════ */
"use strict";

/* أيقونات (مسارات بنمط Lucide) */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2.5 3h3l2.6 12.4a1.5 1.5 0 0 0 1.5 1.1h8.7a1.5 1.5 0 0 0 1.5-1.1L22 7H6.2"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 6l3 3M14.5 8.5l2 2"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  receipt: '<path d="M5 3v18l2.5-1.5L10 21l2-1.5 2 1.5 2.5-1.5L19 21V3l-2.5 1.5L14 3l-2 1.5L10 3 7.5 4.5z"/><path d="M8.5 9h7M8.5 13h7"/>',
  wallet: '<path d="M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-2"/><path d="M22 11h-5a2 2 0 0 0 0 4h5z"/>',
  bank: '<path d="M3 10h18L12 4zM5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  down: '<path d="m3 7 6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkc: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  chev: '<path d="m15 18-6-6 6-6"/>',
  chevl: '<path d="m9 18 6-6-6-6"/>',
  collapse: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18M10 9l-3 3 3 3"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  cols: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18"/>',
  truck: '<path d="M10 17h4V5H2v12h3M14 9h4l4 4v4h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15v3M12 10v8M17 6v12"/>',
  pie: '<path d="M21.2 15.9A10 10 0 1 1 8 2.8"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  map: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  clip: '<path d="m21.4 11-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
  approve: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
  doc: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  cashOut: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M12 9v6M9.5 11.5 12 9l2.5 2.5"/><path d="M6 12h.01M18 12h.01"/>',
  tools: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.6-.6-.6-2.6z"/>',
  calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h4"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  whatsapp: '<path d="M3 21l1.65-4.4A8.5 8.5 0 1 1 8 19.6z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-1.8-1.8l.8-1-1-2z"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  pin: '<path d="M12 17v5M5 17h14l-1.5-3.5V5h1V3H5.5v2h1v8.5z"/>',
  hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
};
const ic = (n, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ""}</svg>`;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const nf2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const money = (h) => `<span class="num">${nf2.format((h || 0) / 100)}</span>`;
const sar = (h) => `${money(h)} <span class="faint xs">ر.س</span>`;
const sarShort = (h) => {
  const v = (h || 0) / 100;
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (Math.abs(v) >= 1e4) return (v / 1e3).toFixed(1) + "K";
  return nf0.format(v);
};
const int = (n) => `<span class="num">${nf0.format(n || 0)}</span>`;
const gregFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit" });
let hijriFmt;
try {
  hijriFmt = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" });
} catch (e) {
  hijriFmt = null;
}
const fmtDate = (t) => (t ? gregFmt.format(new Date(t)) : "—");
const fmtDT = (t) => (t ? `${gregFmt.format(new Date(t))} ${timeFmt.format(new Date(t))}` : "—");
const fmtHijri = (t) => (t && hijriFmt ? hijriFmt.format(new Date(t)).replace(/[^\d/]/g, "") + " هـ" : "—");
const dateNum = (t) => `<span class="num">${fmtDate(t)}</span>`;
const isoDay = (t) => new Date(t + RIYADH).toISOString().slice(0, 10);
const parseDay = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d) - RIYADH;
};

const userName = (id) => byId(S.users, id)?.name || "—";
const custName = (id) => byId(S.customers, id)?.name || "—";
const projName = (id) => byId(S.projects, id)?.name || "—";
const accName = (id) => byId(S.accounts, id)?.name || "—";
const whName = (id) => byId(S.warehouses, id)?.name || "—";
const prodName = (id) => byId(S.products, id)?.name || "—";
const METHOD = { CASH: "نقدًا", TRANSFER: "تحويل بنكي", CARD: "بطاقة/مدى", CHEQUE: "شيك" };
const TERM = { CASH: "نقدي", PARTIAL: "دفع جزئي", CREDIT: "آجل" };

/* ─── الشارات ─── */
const BADGES = {
  PAID: ["مدفوعة", "b-green"],
  PARTIAL: ["مدفوعة جزئيًا", "b-amber"],
  UNPAID: ["غير مدفوعة", "b-gray"],
  OVERDUE: ["متأخرة", "b-red"],
  CANCELLED: ["ملغاة", "b-gray"],
  CONFIRMED: ["مؤكد", "b-blue"],
  PENDING_APPROVAL: ["بانتظار الموافقة", "b-purple"],
  RESERVED: ["محجوز — لم يُسلَّم", "b-purple"],
  ACTIVE: ["نشط بالموقع", "b-blue"],
  PARTIALLY_RETURNED: ["مرتجع جزئيًا", "b-amber"],
  RETURNED: ["مُسترجع بالكامل", "b-green"],
  CLOSED: ["مغلق", "b-gray"],
  PENDING: ["بانتظار الاعتماد", "b-purple"],
  APPROVED: ["معتمد", "b-green"],
  REJECTED: ["مرفوض", "b-red"],
  POSTED: ["مرحّل", "b-green"],
  ISSUED: ["صادر", "b-gray"],
  SETTLED: ["مسدد", "b-green"],
  LATE: ["متأخر عن المدة", "b-red"],
};
const badge = (st, label) => {
  const b = BADGES[st] || [st, "b-gray"];
  return `<span class="badge ${b[1]}">${label || b[0]}</span>`;
};
function saleBadge(s) {
  if (s.status !== "CONFIRMED") return badge(s.status);
  const inv = byId(S.invoices, s.invoiceId);
  return inv ? badge(invStatus(inv)) : badge("CONFIRMED");
}
function rentalBadge(r) {
  if (isRentalOverdue(r)) return badge("LATE");
  return badge(rentalStatusCalc(r));
}

/* ─── بطاقة مؤشر ─── */
function kpi({ label, value, icon, prev, cur, link, tag, spark, color, sub, invertGood }) {
  let tr = "";
  if (prev !== undefined) {
    const g = prev > 0 ? ((cur - prev) / prev) * 100 : null;
    if (g === null) tr = `<span class="trend na" title="لا توجد قيمة صالحة في الفترة السابقة">المقارنة غير متاحة</span>`;
    else {
      const good = invertGood ? g <= 0 : g >= 0;
      tr = `<span class="trend ${good ? "up" : "down"}" title="مقارنة بالفترة السابقة">${g >= 0 ? "▲" : "▼"} <span class="num">${Math.abs(g) > 999 ? "999+" : Math.abs(g).toFixed(1)}%</span></span>`;
    }
  }
  return `<div class="card kpi${link ? "" : " static"}" ${link ? `data-go="${link}" tabindex="0" role="link"` : ""}>
    <div class="top"><div class="lbl">${label}</div><div class="ic" ${color ? `style="background:${color}1a;color:${color}"` : ""}>${ic(icon)}</div></div>
    <div class="val">${value}</div>
    <div class="foot">${tr || (sub ? `<span class="muted">${sub}</span>` : "<span></span>")}${tag ? `<span class="tag">${tag}</span>` : ""}</div>
  </div>`;
}

/* ─── رسوم SVG تفاعلية ─── */
function sparkline(vals, color) {
  const w = 80,
    hh = 26;
  const mx = Math.max(...vals, 1);
  const pts = vals.map((v, i) => `${(i / Math.max(1, vals.length - 1)) * w},${hh - (v / mx) * (hh - 2) - 1}`).join(" ");
  return `<svg width="${w}" height="${hh}" viewBox="0 0 ${w} ${hh}"><polyline fill="none" stroke="${color}" stroke-width="1.6" points="${pts}" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
const fmtTipMoney = (v) => nf2.format(v / 100) + " ر.س";
/** series: [{name,color,values:[]}], labels: [] */
function lineChart(labels, series, { height = 220, money: isMoney = true, area = true } = {}) {
  const W = 640,
    H = height,
    pl = 46,
    pr = 10,
    pt = 12,
    pb = 26;
  const all = series.flatMap((s) => s.values);
  const mx = Math.max(...all, 1) * 1.1;
  const x = (i) => pl + (i / Math.max(1, labels.length - 1)) * (W - pl - pr);
  const y = (v) => pt + (1 - v / mx) * (H - pt - pb);
  let g = "";
  for (let k = 0; k <= 4; k++) {
    const v = (mx / 4) * k;
    g += `<line class="gl" x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}"/><text x="${pl - 8}" y="${y(v) + 4}" text-anchor="end">${isMoney ? sarShort(v) : nf0.format(v)}</text>`;
  }
  const step = Math.ceil(labels.length / 8);
  labels.forEach((l, i) => {
    if ((i % step === 0 && labels.length - 1 - i >= step / 2) || i === labels.length - 1) g += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${l}</text>`;
  });
  for (const s of series) {
    const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
    if (area) g += `<polygon fill="${s.color}" opacity=".08" points="${x(0)},${y(0)} ${pts} ${x(s.values.length - 1)},${y(0)}"/>`;
    g += `<polyline fill="none" stroke="${s.color}" stroke-width="2.2" points="${pts}" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  // أعمدة شفافة للتلميح
  labels.forEach((l, i) => {
    const tip = `${l}<br>` + series.map((s) => `<span style="color:${s.color}">●</span> ${s.name}: ${isMoney ? fmtTipMoney(s.values[i]) : nf0.format(s.values[i])}`).join("<br>");
    const bw = (W - pl - pr) / Math.max(1, labels.length - 1);
    g += `<rect x="${x(i) - bw / 2}" y="${pt}" width="${bw}" height="${H - pt - pb}" fill="transparent" data-tip="${esc(tip)}"/>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${g}</svg>` + legend(series);
}
function barChart(items, { height = 220, money: isMoney = true, color = "var(--c1)", horizontal = false, link } = {}) {
  if (!items.length) return emptyBox("لا توجد بيانات في هذه الفترة");
  if (horizontal) {
    const mx = Math.max(...items.map((i) => i.value), 1);
    return `<div class="col" style="gap:10px">${items
      .map(
        (it) => `<div ${it.link ? `data-go="${it.link}" style="cursor:pointer"` : ""} data-tip="${esc(it.label + ": " + (isMoney ? fmtTipMoney(it.value) : nf0.format(it.value)))}">
      <div class="row between small"><span>${esc(it.label)}</span><b>${isMoney ? sar(it.value) : int(it.value)}</b></div>
      <div class="bar" style="margin-top:4px"><i style="width:${(it.value / mx) * 100}%;background:${it.color || color}"></i></div></div>`,
      )
      .join("")}</div>`;
  }
  const W = 640,
    H = height,
    pl = 46,
    pr = 10,
    pt = 12,
    pb = 34;
  const mx = Math.max(...items.map((i) => i.value), 1) * 1.12;
  const bw = (W - pl - pr) / items.length;
  const y = (v) => pt + (1 - v / mx) * (H - pt - pb);
  let g = "";
  for (let k = 0; k <= 4; k++) {
    const v = (mx / 4) * k;
    g += `<line class="gl" x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}"/><text x="${pl - 8}" y="${y(v) + 4}" text-anchor="end">${isMoney ? sarShort(v) : nf0.format(v)}</text>`;
  }
  items.forEach((it, i) => {
    const x0 = pl + i * bw + bw * 0.18;
    const w = bw * 0.64;
    g += `<rect class="hov" x="${x0}" y="${y(it.value)}" width="${w}" height="${y(0) - y(it.value)}" rx="4" fill="${it.color || color}" data-tip="${esc(it.label + ": " + (isMoney ? fmtTipMoney(it.value) : nf0.format(it.value)))}" ${it.link ? `data-go="${it.link}" style="cursor:pointer"` : ""}/>`;
    g += `<text x="${x0 + w / 2}" y="${H - 14}" text-anchor="middle">${esc(it.label.length > 12 ? it.label.slice(0, 11) + "…" : it.label)}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${g}</svg>`;
}
function donut(items, { money: isMoney = true, center } = {}) {
  const total = items.reduce((a, i) => a + i.value, 0);
  if (!total) return emptyBox("لا توجد بيانات");
  const R = 70,
    r = 46,
    cx = 90,
    cy = 90;
  let a0 = -Math.PI / 2;
  let g = "";
  for (const it of items) {
    if (!it.value) continue;
    const a1 = a0 + (it.value / total) * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (a, rad) => `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`;
    const d = items.filter((i) => i.value).length === 1 ? `M ${cx - R},${cy} a ${R},${R} 0 1,0 ${2 * R},0 a ${R},${R} 0 1,0 ${-2 * R},0 M ${cx - r},${cy} a ${r},${r} 0 1,1 ${2 * r},0 a ${r},${r} 0 1,1 ${-2 * r},0` : `M ${p(a0, R)} A ${R} ${R} 0 ${large} 1 ${p(a1, R)} L ${p(a1, r)} A ${r} ${r} 0 ${large} 0 ${p(a0, r)} Z`;
    g += `<path class="hov" d="${d}" fill="${it.color}" fill-rule="evenodd" data-tip="${esc(it.label + ": " + (isMoney ? fmtTipMoney(it.value) : nf0.format(it.value)) + " (" + ((it.value / total) * 100).toFixed(1) + "%)")}"/>`;
    a0 = a1;
  }
  return `<div class="row" style="gap:18px;flex-wrap:wrap"><svg width="180" height="180" viewBox="0 0 180 180">${g}<text x="90" y="86" text-anchor="middle" style="font-size:11px;fill:var(--text-3)">${center?.label || "الإجمالي"}</text><text x="90" y="104" text-anchor="middle" style="font-size:15px;font-weight:700;fill:var(--text)">${center?.value || (isMoney ? sarShort(total) : nf0.format(total))}</text></svg>
  <div class="col" style="gap:8px;flex:1;min-width:150px">${items.map((it) => `<div class="row between small"><span class="row"><i style="width:10px;height:10px;border-radius:3px;background:${it.color};display:inline-block"></i>${esc(it.label)}</span><b>${isMoney ? sar(it.value) : int(it.value)}</b></div>`).join("")}</div></div>`;
}
function stackedBar(items) {
  const total = items.reduce((a, i) => a + i.value, 0) || 1;
  return `<div class="bar" style="height:14px">${items.map((i) => `<i style="width:${(i.value / total) * 100}%;background:${i.color}" data-tip="${esc(i.label + ": " + nf0.format(i.value))}"></i>`).join("")}</div>
  <div class="legend" style="margin-top:8px">${items.map((i) => `<span><i style="background:${i.color}"></i>${i.label} <b class="num">${nf0.format(i.value)}</b></span>`).join("")}</div>`;
}
const legend = (series) => (series.length > 1 ? `<div class="legend" style="margin-top:6px">${series.map((s) => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join("")}</div>` : "");
const emptyBox = (msg, icon = "box") => `<div class="empty">${ic(icon)}<div>${msg}</div></div>`;
const chartSource = (txt) => `<div class="xs faint" style="margin-top:8px">${ic("info", "")} <span>${txt}</span></div>`.replace('<svg class=""', '<svg style="width:12px;height:12px;vertical-align:-2px"');

/* ─── الجدول: فرز وبحث وفلترة وترقيم وأعمدة وتصدير ─── */
const TBL = {};
function table(id, columns, rows, opts = {}) {
  const st = (TBL[id] ||= { q: "", sort: opts.sort || null, dir: opts.dir || "desc", page: 0, size: opts.size || 12, hidden: new Set(opts.hidden || []), filters: {} });
  let data = rows;
  for (const f of opts.filters || []) {
    const v = st.filters[f.key];
    if (v) data = data.filter((r) => f.match(r, v));
  }
  if (st.q) {
    const q = normText(st.q);
    data = data.filter((r) => columns.some((c) => c.search !== false && normText(String(c.text ? c.text(r) : c.value ? c.value(r) : "")).includes(q)));
  }
  if (st.sort) {
    const c = columns.find((c) => c.key === st.sort);
    if (c) {
      const f = c.value || c.text;
      data = [...data].sort((a, b) => {
        const x = f(a),
          y = f(b);
        const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "ar");
        return st.dir === "asc" ? r : -r;
      });
    }
  }
  // صفوف مثبتة في الأعلى (مثل العملاء المفضلين) مهما كان الفرز
  if (opts.pinFirst) data = [...data.filter(opts.pinFirst), ...data.filter((r) => !opts.pinFirst(r))];
  const pages = Math.max(1, Math.ceil(data.length / st.size));
  if (st.page >= pages) st.page = pages - 1;
  const slice = data.slice(st.page * st.size, st.page * st.size + st.size);
  const vis = columns.filter((c) => !st.hidden.has(c.key));
  const tools = `<div class="tbl-tools">
    <div class="search" style="max-width:260px;flex:1"><input class="input" id="tq-${id}" data-tbl-q="${id}" placeholder="بحث في الجدول…" value="${esc(st.q)}">${ic("search")}</div>
    ${(opts.filters || []).map((f) => `<select class="select" data-tbl-f="${id}" data-key="${f.key}"><option value="">${f.label}: الكل</option>${f.options.map(([v, l]) => `<option value="${esc(v)}" ${st.filters[f.key] === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`).join("")}
    <span class="grow"></span>
    <span class="small muted">${int(data.length)} سجل</span>
    <div style="position:relative"><button class="btn sm" data-tbl-cols="${id}">${ic("cols")}الأعمدة</button>
      <div class="cols-menu hide" id="cols-${id}" style="left:0;top:36px">${columns.map((c) => `<label><input type="checkbox" data-tbl-col="${id}" data-key="${c.key}" ${st.hidden.has(c.key) ? "" : "checked"}> ${c.label}</label>`).join("")}</div></div>
    <button class="btn sm" data-tbl-export="${id}">${ic("download")}تصدير CSV</button>
    ${opts.actions || ""}
  </div>`;
  TBL[id]._export = () => {
    const head = vis.map((c) => c.label);
    const lines = data.map((r) => vis.map((c) => String(c.text ? c.text(r) : c.value ? c.value(r) : "").replace(/"/g, '""')));
    return [head, ...lines].map((l) => l.map((x) => `"${x}"`).join(",")).join("\n");
  };
  const body = slice.length
    ? slice.map((r) => `<tr class="${opts.rowLink ? "click" : ""}" ${opts.rowLink ? `data-go="${opts.rowLink(r)}"` : ""}>${vis.map((c) => `<td>${c.render ? c.render(r) : esc(c.text ? c.text(r) : c.value(r))}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${vis.length}">${emptyBox(st.q ? "لا نتائج مطابقة للبحث" : opts.empty || "لا توجد سجلات")}</td></tr>`;
  const foot = opts.footer ? `<tfoot><tr>${vis.map((c) => `<td>${opts.footer(c, data) ?? ""}</td>`).join("")}</tr></tfoot>` : "";
  return `<div class="card">${opts.noTools ? "" : tools}<div class="tbl-wrap"><table class="tbl"><thead><tr>${vis.map((c) => `<th data-tbl-sort="${id}" data-key="${c.key}">${c.label}${st.sort === c.key ? `<span class="arr">${st.dir === "asc" ? "▲" : "▼"}</span>` : ""}</th>`).join("")}</tr></thead><tbody>${body}</tbody>${foot}</table></div>
  ${pages > 1 ? `<div class="pager"><span>صفحة ${int(st.page + 1)} من ${int(pages)}</span><div class="row"><select class="select" style="height:30px;width:auto" data-tbl-size="${id}">${[12, 25, 50].map((n) => `<option ${n === st.size ? "selected" : ""}>${n}</option>`).join("")}</select><button class="btn sm" data-tbl-page="${id}" data-d="-1" ${st.page === 0 ? "disabled" : ""}>${ic("chevl")}السابق</button><button class="btn sm" data-tbl-page="${id}" data-d="1" ${st.page >= pages - 1 ? "disabled" : ""}>التالي${ic("chev")}</button></div></div>` : ""}</div>`;
}

/** زر «تنزيل PDF»: يحوّل المستند المعروض إلى ملف PDF بمقاس A4 */
function pdfBtn(target = ".print-sheet", name = "", landscape = false) {
  return `<button class="btn success no-pdf" data-act="pdf" data-target="${target}" data-name="${esc(name)}" data-land="${landscape ? 1 : 0}">${ic("download")}تنزيل PDF</button>`;
}

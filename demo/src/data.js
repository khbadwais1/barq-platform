/* ═══════════ بيانات العرض — تُولَّد نسبة إلى تاريخ اليوم ═══════════
   كل المبالغ بالهللة (أعداد صحيحة) لتجنب أخطاء الكسور العشرية. */
"use strict";

const DAY = 86400000;
const RIYADH = 3 * 3600000;
const dayNo = (t) => Math.floor((t + RIYADH) / DAY);
const dayStart = (n) => n * DAY - RIYADH;

const COMPANY = {
  name: "مؤسسة سقالات البرق",
  nameEn: "Al-Barq Scaffolding",
  tagline: "بيع - شراء - تأجير - شدات معدنية",
  address: "المدينة المنورة - طريق المطار القديم - طريق عبدالله بن الربيع - بجوار حمام الهنا",
  cr: "4650184408",
  vat: "300000000000003",
  phones: "0565615030 - 0545649033",
};

const SETTINGS_DEFAULT = {
  vatRate: 15,
  expenseThreshold: 500000, // 5,000 ر.س بالهللة
  sellerMaxDiscountPct: 5,
  creditDays: 30,
  dueSoonDays: 3,
};

const USERS = [
  { id: "u-owner", username: "sulaiman", name: "سليمان الجربوع", role: "OWNER" },
  { id: "u-fin", username: "finance", name: "موظف المالية", role: "FINANCE" },
  { id: "u-s1", username: "seller1", name: "البائع 1", role: "SELLER", repId: "r1", maxDisc: 5, commission: 2 },
  { id: "u-s2", username: "seller2", name: "البائع 2", role: "SELLER", repId: "r2", maxDisc: 5, commission: 2 },
  { id: "u-yard", username: "yard", name: "مسؤول العدد", role: "WAREHOUSE" },
];

const REPS = [
  { id: "r1", code: "REP-01", name: "البائع 1", mobile: "0551234001", userId: "u-s1", followers: ["u-s1"] },
  { id: "r2", code: "REP-02", name: "البائع 2", mobile: "0551234002", userId: "u-s2", followers: ["u-s2"] },
  { id: "r3", code: "REP-03", name: "المندوب 3", mobile: "0551234003", userId: null, followers: ["u-s1"] },
  { id: "r4", code: "REP-04", name: "المندوب 4", mobile: "0551234004", userId: null, followers: ["u-s2", "u-fin"] },
  { id: "r5", code: "REP-05", name: "المندوب 5", mobile: "0551234005", userId: null, followers: ["u-s1", "u-fin"] },
  { id: "r6", code: "REP-06", name: "المندوب 6", mobile: "0551234006", userId: null, followers: ["u-s2", "u-fin"] },
];

const WAREHOUSES = [
  { id: "w1", name: "مستودع أ - المدينة" },
  { id: "w2", name: "مستودع ب - الحناكية" },
];

const ACCOUNTS = [
  { id: "a-cash", name: "الصندوق الرئيسي", type: "CASH", opening: 2500000 },
  { id: "a-rajhi", name: "الراجحي - خاص", type: "BANK", bank: "مصرف الراجحي", iban: "SA03 8000 0000 6080 1016 7519", opening: 18500000 },
  { id: "a-ahli", name: "الأهلي", type: "BANK", bank: "البنك الأهلي السعودي", iban: "SA44 1000 0000 0123 4567 8901", opening: 9200000 },
];

const CATEGORIES = [
  { id: "c1", name: "قوائم ومواسير" },
  { id: "c2", name: "عوارض وأفقيات" },
  { id: "c3", name: "أخشاب" },
  { id: "c4", name: "إكسسوارات وربط" },
  { id: "c5", name: "معدات وإطارات" },
];

/* الأصناف: عائلة × مقاس، كما في كشف دخول الحديد والأخشاب.
   [family, cat, lengths[], salePerPiece(or per meter), rentDaily, cost%, opening, pricing] */
const FAMILIES = [
  ["قائم", "c1", [1.0, 1.5, 2.0, 2.5, 3.0], (l) => 28 * l, (l) => 0.35 * l + 0.4, 900],
  ["ماسورة", "c1", [3.0, 4.0, 6.0], (l) => 24 * l, (l) => 0.3 * l + 0.3, 700],
  ["دعامة", "c1", [2.0, 3.0, 4.0, 5.0], (l) => 22 * l + 15, (l) => 0.4 * l + 0.5, 500],
  ["عارضة", "c2", [1.0, 1.5, 2.0, 2.45], (l) => 30 * l, (l) => 0.3 * l + 0.3, 800],
  ["أفقي", "c2", [1.5, 2.0], (l) => 26 * l, (l) => 0.3 * l + 0.3, 900],
  ["مائل", "c2", [2.0, 2.5], (l) => 26 * l, (l) => 0.3 * l + 0.3, 600],
  ["مرابيع 8×8", "c3", [1.0, 1.5, 2.0, 2.5, 3.0, 4.0], () => 18, () => 0.25, 1200, "METER"],
  ["بلايود", "c3", [0.5, 0.6, 0.7], (l) => 60 * l + 20, (l) => 0.6, 600],
  ["تايبرود", "c4", [1.0, 1.5], (l) => 14 * l, (l) => 0.2, 1000],
];
const SINGLE_ITEMS = [
  // name, cat, sale, rentDaily, opening, unit
  ["كلبس", "c4", 9, 0.15, 3000],
  ["عصفورة", "c4", 7, 0.1, 2500],
  ["بلتة", "c4", 11, 0.15, 2000],
  ["ميزانية مسننة", "c4", 45, 0.5, 400],
  ["بوهيد مسنن", "c4", 48, 0.5, 400],
  ["كفرات", "c5", 85, 1.0, 120],
  ["برواز البرق", "c5", 140, 2.0, 250],
  ["برواز 2م", "c5", 120, 0.3, 900],
  ["بنطي", "c1", 35, 0.33, 600],
  // صنفا اختبار القبول (لا تمسّهما بيانات العرض)
  ["إطار سقالة 1.7م", "c5", 100, 3, 20, "TEST_FRAME"],
  ["ماكينة زر جينه", "c5", 950, 10, 10, "TEST_MACHINE"],
];

const fmtLen = (l) => (l < 1 ? `${Math.round(l * 100)} سم` : `${l.toFixed(2)} م`);
const h = (sar) => Math.round(sar * 100); // ريال ← هللة
const roundTo = (v, step) => Math.round(v / step) * step;

function buildProducts() {
  const products = [];
  let n = 1;
  for (const [family, cat, lengths, sale, rent, opening, pricing] of FAMILIES) {
    for (const l of lengths) {
      const salePrice = pricing === "METER" ? h(sale(l)) : h(roundTo(sale(l), 0.5));
      const daily = h(roundTo(rent(l), 0.05));
      products.push({
        id: `p${n}`,
        sku: `BRQ-${String(n).padStart(3, "0")}`,
        family,
        cat,
        len: l,
        name: `${family} ${fmtLen(l)}`,
        unit: "قطعة",
        pricing: pricing || "PIECE",
        price: salePrice,
        cost: Math.round(salePrice * 0.62),
        rentD: daily,
        rentW: roundTo(daily * 6, 50),
        rentM: roundTo(daily * 22, 100),
        min: Math.round(opening * 0.12),
        opening: Math.round(opening * (1 - l / 20)),
        status: "ACTIVE",
      });
      n++;
    }
  }
  for (const [name, cat, sale, rent, opening, tag] of SINGLE_ITEMS) {
    products.push({
      id: `p${n}`,
      sku: `BRQ-${String(n).padStart(3, "0")}`,
      family: name,
      cat,
      len: null,
      name,
      unit: "قطعة",
      pricing: "PIECE",
      price: h(sale),
      cost: Math.round(h(sale) * 0.62),
      rentD: h(rent),
      rentW: roundTo(h(rent) * 6, 50),
      rentM: roundTo(h(rent) * 22, 100),
      min: tag ? 3 : Math.round(opening * 0.12),
      opening,
      status: "ACTIVE",
      testTag: tag || null,
    });
    n++;
  }
  return products;
}

const CUSTOMER_SEED = [
  // type, name, tradeName, rep, city
  ["COMPANY", "مؤسسة الأفق للمقاولات", "الأفق", "r1", "المدينة المنورة"],
  ["COMPANY", "شركة البنيان الحديث للمقاولات", "البنيان الحديث", "r2", "المدينة المنورة"],
  ["COMPANY", "مؤسسة دار الإعمار", "دار الإعمار", "r3", "ينبع"],
  ["COMPANY", "شركة أعمدة الشمال", "أعمدة الشمال", "r1", "المدينة المنورة"],
  ["COMPANY", "مؤسسة سواعد البناء", "سواعد", "r4", "بدر"],
  ["COMPANY", "شركة الركائز المتحدة", "الركائز", "r2", "المدينة المنورة"],
  ["COMPANY", "مؤسسة طيبة للإنشاءات", "طيبة للإنشاءات", "r5", "المدينة المنورة"],
  ["COMPANY", "شركة المسار الذهبي", "المسار الذهبي", "r6", "العلا"],
  ["COMPANY", "مؤسسة نخبة الحجاز", "نخبة الحجاز", "r1", "المدينة المنورة"],
  ["COMPANY", "شركة قمة الإتقان", "قمة الإتقان", "r2", "خيبر"],
  ["COMPANY", "مؤسسة الصرح العالي", "الصرح العالي", "r3", "المدينة المنورة"],
  ["COMPANY", "شركة مدار التعمير", "مدار", "r1", "ينبع"],
  ["INDIVIDUAL", "عبدالله سالم الجهني", null, "r1", "المدينة المنورة", "NID"],
  ["INDIVIDUAL", "محمد عايض الحربي", null, "r5", "المدينة المنورة", "NID"],
  ["INDIVIDUAL", "سلطان فهد الرشيدي", null, "r5", "المدينة المنورة", "NID"],
  ["INDIVIDUAL", "أحمد محمود عبدالغني", null, "r4", "المدينة المنورة", "IQAMA"],
  ["INDIVIDUAL", "رياض حسن الأنصاري", null, "r1", "المدينة المنورة", "NID"],
  ["INDIVIDUAL", "إمران خان", null, "r2", "ينبع", "IQAMA"],
  ["INDIVIDUAL", "ناصر علي الصاعدي", null, "r3", "المدينة المنورة", "NID"],
  ["INDIVIDUAL", "يوسف إبراهيم الشريف", null, "r6", "المدينة المنورة", "NID"],
  ["INDIVIDUAL", "طارق السيد عثمان", null, "r2", "المدينة المنورة", "IQAMA"],
  ["COMPANY", "شركة نماء الأعمال", "نماء", "r4", "المدينة المنورة"],
];

const PROJECT_NAMES = [
  ["المستودع", "حي العاقول"],
  ["المجمع", "طريق الملك عبدالله"],
  ["فيلا سكنية", "حي الحرة الشرقية"],
  ["عمارة تجارية", "شارع قباء"],
  ["مدرسة أهلية", "حي العزيزية"],
  ["مستشفى خاص", "طريق الجامعات"],
  ["برج سكني", "حي الدفاع"],
  ["صيانة واجهات", "المنطقة المركزية"],
  ["مسجد الحي", "حي بني حارثة"],
  ["استراحة", "طريق تبوك"],
];
const GUARANTORS = ["سعد مبارك الحربي", "عيد سليمان الجهني", "فواز علي العوفي", "منصور ناصر السحيمي", "بندر حمد المزيني"];
const DRIVERS = ["السائق 1", "السائق 2", "السائق 3", "السائق 4", "السائق 5"];
/* بنود تحليل المصروفات كما في ملف «الحركة الشهرية» للمؤسسة.
   group: تشغيلية/إدارية (وصف دفتر الصندوق) — col: عمود المدفوعات في الحركة الشهرية */
const EXPENSE_META = [
  ["مصروف صيانة", "تشغيلية", "مصروفات"], ["صيانة الرافعة", "تشغيلية", "مصروفات"], ["صيانة القلاب", "تشغيلية", "مصروفات"], ["صيانة الونش", "تشغيلية", "مصروفات"],
  ["مصروف محروقات", "تشغيلية", "مصروفات"], ["محروقات القلاب", "تشغيلية", "مصروفات"], ["محروقات الونش", "تشغيلية", "مصروفات"],
  ["نقل خارجي", "تشغيلية", "مصروفات"], ["عمالة خارجية", "تشغيلية", "مصروفات"], ["لوازم الورشة", "تشغيلية", "مصروفات"], ["لوازم إنتاج", "تشغيلية", "مصروفات"],
  ["مصروف إيجارات", "إدارية", "بدل سكن وإيجارات"], ["إيجارات", "إدارية", "بدل سكن وإيجارات"], ["بدلات", "إدارية", "بدل سكن وإيجارات"],
  ["رواتب", "إدارية", "رواتب"], ["مكافآت", "إدارية", "مكافآت"], ["الجاري", "إدارية", "مسحوبات الجاري"], ["حكومية", "إدارية", "حكومية"], ["أصول", "إدارية", "أصول"],
  ["مطبوعات", "إدارية", "مصروفات"], ["هاتف", "إدارية", "مصروفات"], ["كهرباء", "إدارية", "مصروفات"], ["إعاشة وطعام", "إدارية", "مصروفات"], ["أعمال خيرية", "إدارية", "مصروفات"], ["إدارية 2", "إدارية", "مصروفات"],
];
const EXPENSE_CATS = EXPENSE_META.map((m) => m[0]);
const expenseGroup = (cat) => (EXPENSE_META.find((m) => m[0] === cat) || [cat, "إدارية", "مصروفات"])[1];
const expenseCol = (cat) => (EXPENSE_META.find((m) => m[0] === cat) || [cat, "إدارية", "مصروفات"])[2];
const PAY_COLS = ["مشتريات", "مردود إيجارات", "مصروفات", "بدل سكن وإيجارات", "رواتب", "مكافآت", "مسحوبات الجاري", "حكومية", "أصول"];

/* مولد أرقام شبه عشوائي ثابت حتى تكون البيانات نفسها في كل مرة */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

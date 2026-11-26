/* ═══════════ توليد بيانات العرض لآخر 90 يومًا باستخدام نفس قواعد العمل ═══════════ */
"use strict";

function emptyState() {
  return {
    version: 6,
    seededAt: Date.now(),
    settings: { ...SETTINGS_DEFAULT },
    users: USERS.map((u) => ({ ...u, active: true, lastLogin: null })),
    reps: REPS.map((r) => ({ ...r, followers: [...r.followers] })),
    warehouses: WAREHOUSES.map((w) => ({ ...w })),
    accounts: ACCOUNTS.map((a) => ({ ...a })),
    categories: CATEGORIES.map((c) => ({ ...c })),
    products: buildProducts(),
    customers: [],
    projects: [],
    sales: [],
    rentals: [],
    deliveries: [],
    returns: [],
    invoices: [],
    payments: [],
    deposits: [],
    expenses: [],
    approvals: [],
    promissory: [],
    ratings: [],
    blacklist: [],
    followups: [],
    documents: [],
    movements: [],
    audit: [],
    logins: [],
    seq: {},
    idem: {},
    readNotifs: {},
  };
}

function seedState() {
  S = emptyState();
  VER++;
  const R = rng(20261125);
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const int = (a, b) => a + Math.floor(R() * (b - a + 1));
  const today = dayNo(Date.now());
  const atDay = (d, hour = 10) => dayStart(d) + hour * 3600000 + int(0, 50) * 60000;
  const users = Object.fromEntries(S.users.map((u) => [u.username, u]));
  const owner = users.sulaiman,
    fin = users.finance,
    s1 = users.seller1,
    s2 = users.seller2,
    yard = users.yard;
  const sellerOf = (repId) => (["r1", "r3", "r5"].includes(repId) ? s1 : s2);

  // ── رصيد افتتاحي (المستودع أ أساسًا، وجزء في ب) ──
  const openAt = dayStart(today - 125);
  for (const p of S.products) {
    if (p.testTag) {
      move({ type: "OPENING", pid: p.id, wh: "w1", qty: p.opening, from: null, to: "AVAILABLE", at: openAt, by: owner.id, reason: "رصيد افتتاحي" });
      continue;
    }
    const inB = Math.round(p.opening * 0.25);
    move({ type: "OPENING", pid: p.id, wh: "w1", qty: p.opening - inB, from: null, to: "AVAILABLE", at: openAt, by: owner.id, reason: "رصيد افتتاحي" });
    if (inB) move({ type: "OPENING", pid: p.id, wh: "w2", qty: inB, from: null, to: "AVAILABLE", at: openAt, by: owner.id, reason: "رصيد افتتاحي" });
  }
  // صنف تجربة المستودعين: 5 في أ و10 في ب
  const dual = S.products.find((p) => p.family === "برواز البرق");
  move({ type: "ADJUSTMENT", pid: dual.id, wh: "w1", qty: bal(dual.id, "w1").AVAILABLE - 5, from: "AVAILABLE", to: null, at: openAt + 1000, by: owner.id, reason: "نقل للصيانة الخارجية" });
  move({ type: "ADJUSTMENT", pid: dual.id, wh: "w2", qty: 10 - bal(dual.id, "w2").AVAILABLE, from: null, to: "AVAILABLE", at: openAt + 2000, by: owner.id, reason: "تسوية جرد" });
  // بعض القطع التالفة وتحت الصيانة لإظهار الحالات
  for (const p of S.products.filter((p) => !p.testTag).slice(0, 12)) {
    move({ type: "STATE_CHANGE", pid: p.id, wh: "w1", qty: int(2, 9), from: "AVAILABLE", to: pick(["DAMAGED", "MAINTENANCE", "MAINTENANCE"]), at: openAt + 5000, by: yard.id, reason: "فحص دوري" });
  }

  // ── العملاء والمشاريع ──
  const nid = () => "1" + String(int(0, 999999999)).padStart(9, "0");
  const iq = () => "2" + String(int(0, 999999999)).padStart(9, "0");
  const cr = () => "4650" + String(int(0, 999999)).padStart(6, "0");
  CUSTOMER_SEED.forEach(([type, name, trade, rep, city, idKind], i) => {
    const creator = sellerOf(rep);
    const at = atDay(today - 92 + Math.floor(i * 3.9), 9);
    const c = addCustomer(
      {
        type,
        name,
        tradeName: trade,
        cr: type === "COMPANY" ? cr() : null,
        vat: type === "COMPANY" ? "3" + String(int(0, 99999999999999)).padStart(13, "0") + "3" : null,
        nationalId: idKind === "NID" ? nid() : null,
        iqama: idKind === "IQAMA" ? iq() : null,
        mobile: "05" + String(int(0, 99999999)).padStart(8, "0"),
        city,
        fileNo: String(200 + i),
        guarantor: type === "COMPANY" ? pick(GUARANTORS) : "",
        guarantorId: type === "COMPANY" ? "1" + String(int(0, 999999999)).padStart(9, "0") : "",
        guarantorMobile: type === "COMPANY" ? "05" + String(int(0, 99999999)).padStart(8, "0") : "",
        repId: rep,
        at,
      },
      creator,
    );
    const nProj = i === 0 ? 0 : int(1, 3);
    const used = new Set();
    for (let k = 0; k < nProj; k++) {
      let pn;
      do pn = pick(PROJECT_NAMES);
      while (used.has(pn[0]));
      used.add(pn[0]);
      addProject({ customerId: c.id, name: pn[0], location: `${c.city} - ${pn[1]}`, at: at + k * 1000 }, creator, true);
    }
  });
  // العميل الأول: مشروعان كما في مثال المؤسسة
  const ofq = S.customers[0];
  ofq.mobile = "0501234567";
  const pStore = addProject({ customerId: ofq.id, name: "المستودع", location: "المدينة - حي العاقول", details: "مستودع تخزين 2,400 م²", at: ofq.at }, s1, true);
  const pMall = addProject({ customerId: ofq.id, name: "المجمع", location: "المدينة - طريق الملك عبدالله", details: "مجمع تجاري 3 أدوار", at: ofq.at + 1 }, s1, true);
  // مشروعان بنفس الاسم لعميلين مختلفين
  addProject({ customerId: S.customers[3].id, name: "المستودع", location: "المدينة - الصناعية", at: S.customers[3].at }, s1, true);

  const projectsOf = (cid) => S.projects.filter((p) => p.customerId === cid);
  const saleable = S.products.filter((p) => !p.testTag);
  const accounts = ["a-cash", "a-rajhi", "a-ahli"];
  const methodFor = (acc) => (acc === "a-cash" ? "CASH" : pick(["TRANSFER", "TRANSFER", "CHEQUE"]));

  // ── المبيعات (34) ──
  const saleDays = [];
  for (let i = 0; i < 34; i++) saleDays.push(today - 88 + Math.floor((i * 88) / 34) + int(0, 2));
  saleDays.push(today, today); // بيعتان اليوم
  saleDays.forEach((d, i) => {
    const elig = S.customers.slice(1).filter((c) => c.at <= atDay(d));
    if (!elig.length) return;
    const cust = elig[(i * 7 + 3) % elig.length];
    const proj = pick(projectsOf(cust.id));
    const seller = sellerOf(cust.repId);
    const n = int(1, 4);
    const lines = [];
    const used = new Set();
    for (let k = 0; k < n; k++) {
      const p = pick(saleable);
      if (used.has(p.id)) continue;
      used.add(p.id);
      lines.push({ pid: p.id, count: int(4, 40), price: p.price, disc: 0 });
    }
    const term = pick(["CASH", "CREDIT", "CREDIT", "PARTIAL"]);
    const t = saleTotals(lines, 0, S.settings.vatRate);
    const docDisc = R() < 0.3 ? Math.round(t.taxable * 0.03) : 0;
    const t2 = saleTotals(lines, docDisc, S.settings.vatRate);
    const acc = pick(accounts);
    try {
      createSale(
        {
          customerId: cust.id,
          projectId: proj.id,
          wh: R() < 0.85 ? "w1" : "w2",
          lines,
          docDisc,
          term,
          paid: term === "CASH" ? t2.total : term === "PARTIAL" ? Math.round(t2.total * 0.4) : 0,
          accountId: acc,
          method: methodFor(acc),
          due: atDay(d) + pick([15, 30, 30, 45]) * DAY,
          at: atDay(d, int(8, 18)),
          driver: pick(DRIVERS),
          idemKey: "seed-sale-" + i,
        },
        seller,
      );
    } catch (e) {
      /* نقص مخزون في التوليد: تُتجاوز */
    }
  });
  // بيع ينتظر موافقة خصم
  {
    const c = S.customers[5];
    const p = saleable[2];
    createSale({ customerId: c.id, projectId: projectsOf(c.id)[0].id, wh: "w1", lines: [{ pid: p.id, count: 50, price: p.price, disc: 0 }], docDisc: Math.round(p.price * 50 * 0.12), term: "CREDIT", at: atDay(today, 9), idemKey: "seed-sale-pending" }, sellerOf(c.repId));
  }

  // ── الإيجارات (17) ──
  const rentalPlan = [];
  for (let i = 0; i < 17; i++) { const d = today - 84 + Math.floor(i * 4.9); const elig = S.customers.slice(1).filter((c) => c.at <= atDay(d)); if (elig.length) rentalPlan.push({ d, cust: elig[(i * 5 + 2) % elig.length] }); }
  rentalPlan.forEach(({ d, cust }, i) => {
    const proj = pick(projectsOf(cust.id));
    const seller = sellerOf(cust.repId);
    const basis = pick(["MONTHLY", "MONTHLY", "WEEKLY", "DAILY"]);
    const periods = basis === "MONTHLY" ? 1 : basis === "WEEKLY" ? int(2, 4) : int(10, 20);
    const lines = [];
    const used = new Set();
    for (let k = 0; k < int(2, 4); k++) {
      const p = pick(saleable.filter((x) => x.cat !== "c4"));
      if (used.has(p.id)) continue;
      used.add(p.id);
      lines.push({ pid: p.id, qty: int(20, 120) });
    }
    const mode = R() < 0.35 ? "OPEN" : "FIXED";
    let res;
    try {
      res = createRental({ customerId: cust.id, projectId: proj.id, wh: "w1", basis, periods, mode, lines, deposit: pick([0, 0, 100000, 200000]), at: atDay(d, 9), start: atDay(d), dueDays: 10, idemKey: "seed-rent-" + i }, seller);
    } catch (e) {
      return;
    }
    const r = res.rental;
    deliverRental(r.id, { lines: r.lines.map((l, idx) => ({ idx, qty: l.qty })), driver: pick(DRIVERS), receiver: "مشرف الموقع", at: atDay(d, 13), idemKey: "seed-dl-" + i }, yard);
    if (r.deposit) rentalDeposit(r.id, { kind: "RECEIVED", amount: r.deposit, accountId: "a-cash", at: atDay(d, 13) }, fin);
    const span = periods * BASIS_DAYS[basis];
    const endD = d + span;
    // مرتجعات: جزئي في المنتصف، وكامل للعقود المنتهية في معظمها
    if (endD < today - 2 && R() < 0.8) {
      const mid = d + Math.floor(span / 2);
      returnRental(r.id, { lines: [{ idx: 0, qty: Math.floor(r.lines[0].qty / 3), cond: "GOOD" }], at: atDay(mid, 15), driver: pick(DRIVERS), idemKey: "seed-rn1-" + i }, yard);
      const rest = r.lines.map((l, idx) => ({ idx, qty: l.delivered - l.returned }));
      const lines2 = [];
      rest.forEach((x) => {
        if (x.qty <= 0) return;
        const bad = R() < 0.3 ? Math.min(x.qty, int(1, 3)) : 0;
        if (x.qty - bad > 0) lines2.push({ idx: x.idx, qty: x.qty - bad, cond: "GOOD" });
        if (bad) lines2.push({ idx: x.idx, qty: bad, cond: pick(["MAINTENANCE", "DAMAGED", "LOST"]) });
      });
      const fee = lines2.some((x) => x.cond !== "GOOD") ? int(1, 6) * 5000 : 0;
      const retDay = Math.min(today - 1, endD + int(-1, 4));
      returnRental(r.id, { lines: lines2, fee, at: atDay(retDay, 16), driver: pick(DRIVERS), counter: yard.name, gate: "مسؤول البوابة", idemKey: "seed-rn2-" + i }, yard);
      if (r.deposit) rentalDeposit(r.id, { kind: "REFUNDED", amount: r.deposit, accountId: "a-cash", at: atDay(retDay, 17) }, fin);
    }
    // الفوترة الدورية للمفتوح وما زاد عن المدة للثابت
    if (r.mode === "OPEN") {
      for (let bd = d + 30; bd <= today; bd += 30) {
        try {
          billRental(r.id, fin, bd, atDay(bd, 11));
        } catch (e) {}
      }
    }
    const lastRet = S.returns.filter((x) => x.rentalId === r.id).pop();
    if (lastRet && rentalStatusCalc(r) === "RETURNED") {
      try {
        billRental(r.id, fin, dayNo(lastRet.at), lastRet.at + 3600000);
      } catch (e) {}
    }
  });

  // ── مثال المؤسسة: 100 قطعة للمستودع لمدة 30 يومًا، رجع 40، ثم 200 للمجمع ──
  const q3 = S.products.find((p) => p.family === "قائم" && p.len === 3);
  const q2 = S.products.find((p) => p.family === "قائم" && p.len === 2);
  const ard = S.products.find((p) => p.family === "عارضة" && p.len === 1.5);
  const rA = createRental({ customerId: ofq.id, projectId: pStore.id, wh: "w1", basis: "MONTHLY", periods: 1, mode: "FIXED", lines: [{ pid: q3.id, qty: 100 }], deposit: 300000, at: atDay(today - 24, 9), start: atDay(today - 24), dueDays: 10, repId: "r1", idemKey: "seed-ofq-a" }, s1).rental;
  deliverRental(rA.id, { lines: [{ idx: 0, qty: 100 }], driver: "السائق 1", receiver: "مشرف الموقع", at: atDay(today - 24, 12), idemKey: "seed-ofq-a-dl" }, yard);
  rentalDeposit(rA.id, { kind: "RECEIVED", amount: 300000, accountId: "a-cash", at: atDay(today - 24, 12) }, fin);
  returnRental(rA.id, { lines: [{ idx: 0, qty: 38, cond: "GOOD" }, { idx: 0, qty: 2, cond: "MAINTENANCE" }], fee: 8000, at: atDay(today - 6, 15), driver: "السائق 2", counter: yard.name, gate: "مسؤول البوابة", idemKey: "seed-ofq-a-rn" }, yard);
  const rB = createRental({ customerId: ofq.id, projectId: pMall.id, wh: "w1", basis: "MONTHLY", periods: 2, mode: "FIXED", lines: [{ pid: q2.id, qty: 120 }, { pid: ard.id, qty: 80 }], at: atDay(today - 10, 10), start: atDay(today - 10), dueDays: 15, repId: "r1", idemKey: "seed-ofq-b" }, s1).rental;
  deliverRental(rB.id, { lines: [{ idx: 0, qty: 120 }, { idx: 1, qty: 80 }], driver: "السائق 3", receiver: "مشرف الموقع", at: atDay(today - 10, 13), idemKey: "seed-ofq-b-dl" }, yard);
  // بيع للعميل نفسه على مشروع المستودع
  const ofqSale = createSale({ customerId: ofq.id, projectId: pStore.id, wh: "w1", lines: [{ pid: S.products.find((p) => p.family === "كلبس").id, count: 200, price: 900 }, { pid: S.products.find((p) => p.family.startsWith("مرابيع") && p.len === 4).id, count: 30, price: 1800 }], docDisc: 0, term: "CREDIT", due: atDay(today - 20) + 30 * DAY, at: atDay(today - 20, 11), driver: "السائق 5", idemKey: "seed-ofq-sale" }, s1);
  // ── مثال «كشف ح - محمد» من ملفات المؤسسة: إيجار مفتوح بسعر شهري ÷ 30 والأيام شاملة ──
  const T0 = today - 118;
  const mohamed = addCustomer({ type: "INDIVIDUAL", name: "محمد", nationalId: "1098765432", mobile: "0559876543", city: "المدينة المنورة", fileNo: "731", repId: "r5", projectName: "عمارة حي العزيزية", projectLocation: "المدينة - حي العزيزية", at: atDay(T0 - 2) }, s1);
  const pMoh = S.projects.find((p) => p.customerId === mohamed.id);
  const P = (fam, len) => S.products.find((p) => p.family === fam && (len === undefined || p.len === len));
  const rM = createRental(
    {
      customerId: mohamed.id,
      projectId: pMoh.id,
      wh: "w1",
      basis: "MONTHLY",
      periods: 4,
      mode: "OPEN",
      lines: [
        { pid: P("برواز 2م").id, qty: 125, rate: 900 },
        { pid: P("مائل", 2).id, qty: 125, rate: 0 },
        { pid: P("أفقي", 2).id, qty: 250, rate: 0 },
        { pid: P("بنطي").id, qty: 30, rate: 1000 },
        { pid: P("مرابيع 8×8", 3).id, qty: 10, rate: 15000 },
        { pid: P("بلايود", 0.6).id, qty: 150, rate: 1000 },
      ],
      at: atDay(T0, 8),
      start: atDay(T0),
      repId: "r5",
      idemKey: "seed-mohamed",
    },
    s1,
  ).rental;
  deliverRental(rM.id, { lines: [0, 1, 2, 3].map((idx) => ({ idx, qty: rM.lines[idx].qty })), driver: "السائق 1", transport: 18000, at: atDay(T0, 11), idemKey: "seed-moh-dl1" }, yard);
  deliverRental(rM.id, { lines: [{ idx: 4, qty: 10 }], driver: "السائق 2", at: atDay(T0 + 4, 11), idemKey: "seed-moh-dl2" }, yard);
  deliverRental(rM.id, { lines: [{ idx: 5, qty: 150 }], driver: "السائق 2", at: atDay(T0 + 9, 11), idemKey: "seed-moh-dl3" }, yard);

  // عقد مفتوح لعميل آخر تجاوز مدته (للتنبيهات)
  const late = S.customers[6];
  const rL = createRental({ customerId: late.id, projectId: projectsOf(late.id)[0].id, wh: "w1", basis: "WEEKLY", periods: 2, mode: "FIXED", lines: [{ pid: q3.id, qty: 60 }], at: atDay(today - 21, 9), start: atDay(today - 21), dueDays: 7, idemKey: "seed-late" }, s2).rental;
  deliverRental(rL.id, { lines: [{ idx: 0, qty: 60 }], driver: "السائق 4", at: atDay(today - 21, 12), idemKey: "seed-late-dl" }, yard);

  // ── التحصيلات: دفعات جزئية وكاملة على فواتير مختلفة ──
  const invs = S.invoices.filter((i) => invRemaining(i) > 0).sort((a, b) => a.at - b.at);
  let k = 0;
  for (const inv of invs) {
    k++;
    if (inv.customerId === ofq.id || inv.refId === rL.id) continue;
    if (inv.at > Date.now() - 2 * DAY && k % 2) continue;
    const roll = R();
    if (roll < 0.22) continue; // تبقى غير مدفوعة
    const rem = invRemaining(inv);
    const amount = roll < 0.55 ? rem : Math.round(rem * pick([0.3, 0.5, 0.6]));
    const acc = pick(accounts);
    const cust = byId(S.customers, inv.customerId);
    const payDay = Math.min(today, dayNo(inv.at) + int(1, 25));
    try {
      recordPaymentRaw({ customerId: inv.customerId, projectId: inv.projectId, allocations: [{ invoiceId: inv.id, amount }], method: methodFor(acc), accountId: acc, ref: acc === "a-cash" ? "" : "TRX" + int(100000, 999999), repId: R() < 0.8 ? cust.repId : pick(["r1", "r2", "r3", "r4", "r5", "r6"]), at: atDay(payDay, int(9, 17)) }, fin);
    } catch (e) {}
  }
  // دفعة على فاتورة بيع الأفق (جزئية)
  recordPaymentRaw({ customerId: ofq.id, projectId: pStore.id, allocations: [{ invoiceId: ofqSale.invoice.id, amount: 200000 }], method: "TRANSFER", accountId: "a-rajhi", ref: "TRX558120", repId: "r1", at: atDay(today - 12, 11) }, fin);
  // دفعة اليوم
  const openToday = S.invoices.filter((i) => invRemaining(i) > 0 && i.customerId !== ofq.id).slice(-3);
  openToday.forEach((inv, i) => {
    recordPaymentRaw({ customerId: inv.customerId, projectId: inv.projectId, allocations: [{ invoiceId: inv.id, amount: Math.min(invRemaining(inv), 150000 + i * 50000) }], method: "CASH", accountId: "a-cash", repId: byId(S.customers, inv.customerId).repId, at: atDay(today, 9 + i) }, fin);
  });

  // ── المصروفات (أقل وأعلى من حد الاعتماد) ──
  for (let i = 0; i < 40; i++) {
    const d = today - 89 + Math.floor(i * 2.2);
    const cat = pick(EXPENSE_CATS);
    const amt = cat === "رواتب" ? int(80, 140) * 10000 : cat === "إيجارات" ? 750000 : cat === "أصول" ? 1200000 : int(15, 420) * 1000;
    let res;
    try {
      res = createExpense({ cat, amount: amt, accountId: amt > 300000 ? pick(["a-rajhi", "a-ahli"]) : "a-cash", desc: cat.startsWith("محروقات") ? "ديزل" : cat, projectId: R() < 0.2 ? pick(S.projects).id : null, at: atDay(d, 12), idemKey: "seed-exp-" + i }, fin);
    } catch (e) {
      continue; // رصيد الصندوق لا يكفي
    }
    if (res.expense.status === "PENDING" && d < today - 2) {
      const ap = S.approvals.find((a) => a.entityId === res.expense.id);
      const okDecision = R() < 0.85;
      decideApproval(ap.id, okDecision ? "APPROVED" : "REJECTED", okDecision ? "" : "يحتاج عرض سعر ثانٍ", owner, atDay(d + 1, 10));
    }
  }
  createExpense({ cat: "مصروف صيانة", amount: 750000, accountId: "a-rajhi", desc: "صيانة شاملة لماكينة زر جينه وتغيير قطع", at: atDay(today, 8), idemKey: "seed-exp-pending" }, fin);

  // ── التقييمات والقائمة السوداء والمتابعات وسندات لأمر ──
  S.ratings.push({ id: uid("rt"), customerId: ofq.id, rating: 4, reason: "التزام جيد بالسداد مع تأخر بسيط", by: fin.id, at: atDay(today - 60) });
  S.ratings.push({ id: uid("rt"), customerId: ofq.id, rating: 5, reason: "سداد مبكر وتعامل ممتاز في رد المعدات", by: owner.id, at: atDay(today - 15) });
  const bad = S.customers[9];
  S.blacklist.push({ id: uid("bl"), customerId: bad.id, action: "BLACKLIST", scope: "CREDIT", reason: "تأخر سداد أكثر من 90 يومًا", by: owner.id, at: atDay(today - 40) });
  S.blacklist.push({ id: uid("bl"), customerId: bad.id, action: "UNBLACKLIST", scope: "CREDIT", reason: "تمت التسوية بالكامل", by: owner.id, at: atDay(today - 12) });
  const bad2 = S.customers[17];
  S.blacklist.push({ id: uid("bl"), customerId: bad2.id, action: "BLACKLIST", scope: "ALL", reason: "معدات مفقودة لم تُعوَّض", by: owner.id, at: atDay(today - 8) });
  S.ratings.push({ id: uid("rt"), customerId: bad2.id, rating: 1, reason: "فقد معدات ورفض التعويض", by: owner.id, at: atDay(today - 8) });
  S.promissory.push({ id: uid("pn"), no: "PN-1024", customerId: ofq.id, projectId: pMall.id, amount: 5000000, at: atDay(today - 10), due: atDay(today + 50), status: "ACTIVE", notes: "ضمان عقد إيجار المجمع", attachment: true, by: fin.id });
  S.promissory.push({ id: uid("pn"), no: "PN-0990", customerId: S.customers[2].id, projectId: projectsOf(S.customers[2].id)[0].id, amount: 2500000, at: atDay(today - 70), due: null, status: "SETTLED", notes: "", attachment: false, by: fin.id });
  const fuOut = ["تم الاتصال - وعد بالسداد", "طلب عرض سعر إيجار", "لا يرد", "زيارة موقع", "طلب تمديد العقد"];
  S.customers.slice(0, 14).forEach((c, i) => {
    const rep = byId(S.reps, c.repId);
    const uidF = rep.followers[0];
    S.followups.push({ id: uid("fu"), customerId: c.id, projectId: projectsOf(c.id)[0]?.id || null, repId: rep.id, userId: uidF, outcome: pick(fuOut), notes: "", at: atDay(today - int(1, 20)), next: atDay(today + int(-2, 6)), done: false });
  });
  S.documents.push({ id: uid("doc"), customerId: ofq.id, projectId: pMall.id, title: "صورة سند لأمر PN-1024", fileName: "PN-1024.pdf", size: 182000, at: atDay(today - 10), by: fin.id });
  S.documents.push({ id: uid("doc"), customerId: ofq.id, projectId: null, title: "السجل التجاري", fileName: "CR.pdf", size: 240000, at: ofq.at, by: s1.id });

  // سجل دخول نموذجي
  for (const u of S.users) {
    u.lastLogin = atDay(today - int(0, 2), int(7, 9));
    S.logins.push({ username: u.username, ok: true, at: u.lastLogin, ip: "10.0.0." + int(2, 40) });
  }
  S.logins.push({ username: "seller2", ok: false, at: atDay(today - 1, 7), ip: "10.0.0.17", reason: "كلمة مرور خاطئة" });
  S.idem = {};
  VER++;
  return S;
}

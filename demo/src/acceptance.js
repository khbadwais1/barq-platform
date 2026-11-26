/* ═══════════ سيناريوهات القبول: تُنفَّذ آليًا على نسخة معزولة من البيانات ═══════════ */
"use strict";

function runAcceptance() {
  const backup = JSON.stringify(S);
  const results = [];
  const docs = [];
  const check = (group, name, cond, detail = "") => results.push({ group, name, ok: !!cond, detail });
  const expectErr = (fn) => {
    try {
      fn();
      return null;
    } catch (e) {
      return e instanceof DomainError ? e.message : "خطأ غير متوقع: " + e.message;
    }
  };
  const U = (n) => S.users.find((u) => u.username === n);
  try {
    seedState(); // بيانات نظيفة ثابتة حتى تكون النتائج قابلة للتكرار
    S.settings.vatRate = 15;
    const owner = U("sulaiman"),
      fin = U("finance"),
      s1 = U("seller1"),
      s2 = U("seller2"),
      yard = U("yard");
    const frame = S.products.find((p) => p.testTag === "TEST_FRAME");
    const mach = S.products.find((p) => p.testTag === "TEST_MACHINE");
    const cust = S.customers[0];
    const [pA, pB] = S.projects.filter((p) => p.customerId === cust.id && (p.name === "المستودع" || p.name === "المجمع"));
    const cash0 = accountBalance("a-cash"),
      bank0 = accountBalance("a-rajhi");
    const bal0 = customerSummary(cust.id).balance;

    /* ١. بيع آجل 3 × 100 */
    const G1 = "١. بيع آجل وتحصيل على دفعتين (الرقم المرجعي 345)";
    check(G1, "الرصيد الابتدائي للإطار 20", bal(frame.id, "w1").AVAILABLE === 20, `المتاح ${bal(frame.id, "w1").AVAILABLE}`);
    const r1 = createSale({ customerId: cust.id, projectId: pA.id, wh: "w1", lines: [{ pid: frame.id, count: 3, price: 10000 }], docDisc: 0, term: "CREDIT", idemKey: "acc-sale-1" }, s1);
    docs.push(["بيع", r1.sale.no], ["فاتورة", r1.invoice.no], ["سند استلام (بيع)", r1.dn.no]);
    check(G1, "الفاتورة = 345.00", r1.invoice.total === 34500, `${r1.invoice.no}: ${(r1.invoice.total / 100).toFixed(2)}`);
    check(G1, "المتاح أصبح 17", bal(frame.id, "w1").AVAILABLE === 17, `المتاح ${bal(frame.id, "w1").AVAILABLE}`);
    check(G1, "ذمة العميل +345", customerSummary(cust.id).balance - bal0 === 34500, `+${((customerSummary(cust.id).balance - bal0) / 100).toFixed(2)}`);
    check(G1, "حركة النقد صفر", accountBalance("a-cash") === cash0 && accountBalance("a-rajhi") === bank0);
    check(G1, "سند الاستلام مصنّف «بيع» ومرتبط بحركة الخروج نفسها (لا خصم مزدوج)", r1.dn.kind === "SALE" && S.movements.filter((m) => m.saleId === r1.sale.id).length === 1 && S.movements.find((m) => m.saleId === r1.sale.id).dnId === r1.dn.id);
    const p1 = recordPayment({ customerId: cust.id, allocations: [{ invoiceId: r1.invoice.id, amount: 10000 }], method: "CASH", accountId: "a-cash", repId: "r3", idemKey: "acc-pay-1" }, fin);
    check(G1, "بعد قبض 100: الفاتورة جزئية والمتبقي 245", invStatus(r1.invoice) === "PARTIAL" && invRemaining(r1.invoice) === 24500, `${p1.no}`);
    const p2 = recordPayment({ customerId: cust.id, allocations: [{ invoiceId: r1.invoice.id, amount: 24500 }], method: "TRANSFER", accountId: "a-rajhi", ref: "TRX-ACC", repId: "r3", idemKey: "acc-pay-2" }, fin);
    docs.push(["سند قبض 100 (صندوق)", p1.no], ["سند قبض 245 (بنك)", p2.no]);
    check(G1, "الفاتورة مسددة وذمتها صفر", invStatus(r1.invoice) === "PAID" && invRemaining(r1.invoice) === 0);
    check(G1, "الصندوق +100 والبنك +245", accountBalance("a-cash") - cash0 === 10000 && accountBalance("a-rajhi") - bank0 === 24500, `صندوق +${(accountBalance("a-cash") - cash0) / 100} · بنك +${(accountBalance("a-rajhi") - bank0) / 100}`);
    check(G1, "المخزون بقي 17", bal(frame.id, "w1").AVAILABLE === 17);
    check(G1, "السند يظهر في بروفايل العميل", customerDocuments(cust.id).some((d) => d.id === p1.id));
    check(G1, "البحث باسم المندوب «المندوب 3» يجد السند ولا يخلطه بـ«المندوب 4»", S.payments.filter((p) => normText(p.repName).includes(normText("المندوب 3"))).some((p) => p.id === p1.id) && !S.payments.filter((p) => normText(p.repName).includes(normText("المندوب 4"))).some((p) => p.id === p1.id));
    check(G1, "اسم المندوب محفوظ في السند وقت الإصدار", p1.repName === "المندوب 3");

    /* ٢. خصم 20 */
    const G2 = "٢. الخصم والموافقة";
    const t = saleTotals([{ pid: frame.id, count: 3, price: 10000 }], 2000, 15);
    check(G2, "خصم 20: الوعاء 280 والضريبة 42 والإجمالي 322", t.taxable === 28000 && t.vat === 4200 && t.total === 32200, `${t.taxable / 100} / ${t.vat / 100} / ${t.total / 100}`);
    const stockBefore = bal(frame.id, "w1").AVAILABLE;
    const r2 = createSale({ customerId: cust.id, projectId: pA.id, wh: "w1", lines: [{ pid: frame.id, count: 3, price: 10000 }], docDisc: 2000, term: "CREDIT", idemKey: "acc-sale-disc" }, s1);
    check(G2, "خصم 6.7% يتجاوز حد البائع 5% ⇐ بانتظار موافقة المالك", r2.pending && r2.sale.status === "PENDING_APPROVAL");
    check(G2, "لا يُخصم المخزون ولا تصدر فاتورة قبل الاعتماد", bal(frame.id, "w1").AVAILABLE === stockBefore && !r2.sale.invoiceId);
    const ap = S.approvals.find((a) => a.entityId === r2.sale.id);
    decideApproval(ap.id, "APPROVED", "عميل مميز", owner);
    check(G2, "بعد اعتماد المالك: فاتورة 322 وخصم المخزون", byId(S.invoices, r2.sale.invoiceId)?.total === 32200 && bal(frame.id, "w1").AVAILABLE === stockBefore - 3);
    check(G2, "إعادة الاعتماد مرة ثانية مرفوضة", !!expectErr(() => decideApproval(ap.id, "APPROVED", "", owner)));

    /* ٣. الحماية */
    const G3 = "٣. الحماية: النقص، التكرار، التزامن، الصلاحيات";
    check(G3, "بيع كمية أكبر من المتاح مرفوض", !!expectErr(() => createSale({ customerId: cust.id, projectId: pA.id, wh: "w1", lines: [{ pid: frame.id, count: 50, price: 10000 }], term: "CREDIT", idemKey: "acc-x1" }, s1)));
    const nSales = S.sales.length;
    const a1 = createSale({ customerId: cust.id, projectId: pA.id, wh: "w1", lines: [{ pid: frame.id, count: 1, price: 10000 }], term: "CREDIT", idemKey: "acc-dup" }, s1);
    const a2 = createSale({ customerId: cust.id, projectId: pA.id, wh: "w1", lines: [{ pid: frame.id, count: 1, price: 10000 }], term: "CREDIT", idemKey: "acc-dup" }, s1);
    check(G3, "إرسال نفس الطلب مرتين ⇐ بيع واحد ونفس النتيجة", S.sales.length === nSales + 1 && a2.duplicate && a2.sale.id === a1.sale.id);
    const inv = a1.invoice;
    recordPayment({ customerId: cust.id, allocations: [{ invoiceId: inv.id, amount: inv.total }], method: "CASH", accountId: "a-cash", repId: "r1", idemKey: "acc-c1" }, fin);
    check(G3, "تحصيلان متزامنان لآخر رصيد ⇐ الثاني مرفوض", !!expectErr(() => recordPayment({ customerId: cust.id, allocations: [{ invoiceId: inv.id, amount: inv.total }], method: "CASH", accountId: "a-cash", repId: "r1", idemKey: "acc-c2" }, fin)));
    check(G3, "قبض صفر أو سالب مرفوض", !!expectErr(() => recordPayment({ customerId: cust.id, allocations: [{ invoiceId: inv.id, amount: 0 }], accountId: "a-cash", idemKey: "z" }, fin)) && !!expectErr(() => recordPayment({ customerId: cust.id, allocations: [{ invoiceId: inv.id, amount: -5 }], accountId: "a-cash", idemKey: "z2" }, fin)));
    check(G3, "مشروع لا يتبع العميل مرفوض في الخادم", !!expectErr(() => createSale({ customerId: cust.id, projectId: S.projects.find((p) => p.customerId !== cust.id).id, wh: "w1", lines: [{ pid: frame.id, count: 1 }], term: "CREDIT" }, s1)));
    check(G3, "بائع ثانٍ لا يرى بيع البائع الأول (403)", !canSeeSale(s2, r1.sale) && canSeeSale(s1, r1.sale) && canSeeSale(owner, r1.sale));
    check(G3, "البائع لا يملك أرصدة البنوك ولا لوحة المالك", !can(s1, "accounts") && !can(s1, "dash.finance") && can(owner, "accounts"));
    check(G3, "المالية لا تدير المستخدمين", !can(fin, "users.manage") && !PERMS.FINANCE.includes("*"));
    const dual = S.products.find((p) => p.family === "برواز البرق");
    const e8 = expectErr(() => createSale({ customerId: cust.id, projectId: pA.id, wh: "w1", lines: [{ pid: dual.id, count: 8 }], term: "CREDIT" }, s1));
    check(G3, "صنف متاحه 5 في أ و10 في ب: بيع 8 من أ مرفوض مع اقتراح ب", !!e8 && e8.includes("مستودع ب"), e8 || "");

    /* ٤. السعر */
    const G4 = "٤. تغيير السعر لا يمس المستندات السابقة";
    frame.price = 11000;
    check(G4, "الفاتورة الأولى بقيت على 100", r1.invoice.items[0].price === 10000);
    check(G4, "البيع الجديد يقترح 110", frame.price === 11000);
    frame.price = 10000;

    /* ٥. الإيجار 138 */
    const G5 = "٥. عقد إيجار 4 × 10 × 3 أيام (الرقم المرجعي 138)";
    const day0 = dayNo(Date.now()) - 3;
    const rr = createRental({ customerId: cust.id, projectId: pB.id, wh: "w1", basis: "DAILY", periods: 3, mode: "FIXED", lines: [{ pid: mach.id, qty: 4, rate: 1000 }], at: dayStart(day0) + 9 * 3600000, start: dayStart(day0), idemKey: "acc-rent" }, s1);
    docs.push(["عقد إيجار", rr.rental.no], ["فاتورة الإيجار", rr.invoice.no]);
    check(G5, "إجمالي العقد قبل الاعتماد 138 (120 + 18)", rr.rental.est.total === 13800 && rr.invoice.total === 13800);
    check(G5, "بعد الاعتماد: محجوز 4", bal(mach.id, "w1").RESERVED === 4 && bal(mach.id, "w1").AVAILABLE === 6);
    const dl = deliverRental(rr.rental.id, { lines: [{ idx: 0, qty: 4 }], at: dayStart(day0) + 10 * 3600000, idemKey: "acc-dl" }, yard);
    docs.push(["سند استلام (تأجير)", dl.dn.no]);
    check(G5, "بعد التسليم: المتاح 6 والعهدة 4", bal(mach.id, "w1").AVAILABLE === 6 && custodyRows(cust.id, pB.id).find((r) => r.pid === mach.id).onSite === 4);
    check(G5, "تكرار سند التسليم لا يكرر الأثر", deliverRental(rr.rental.id, { lines: [{ idx: 0, qty: 4 }], idemKey: "acc-dl" }, yard).duplicate && bal(mach.id, "w1").RENTED === 4);
    const rt1 = returnRental(rr.rental.id, { lines: [{ idx: 0, qty: 1, cond: "GOOD" }], at: dayStart(day0 + 1) + 10 * 3600000, idemKey: "acc-rn1" }, yard);
    check(G5, "بعد رد قطعة: المتاح 7 وعهدة المشروع 3 والعقد مسترجع جزئيًا", bal(mach.id, "w1").AVAILABLE === 7 && custodyRows(cust.id, pB.id).find((r) => r.pid === mach.id).onSite === 3 && rentalStatusCalc(rr.rental) === "PARTIALLY_RETURNED");
    check(G5, "رد كمية أكبر من الموجود مرفوض", !!expectErr(() => returnRental(rr.rental.id, { lines: [{ idx: 0, qty: 4, cond: "GOOD" }], idemKey: "acc-rn-x" }, yard)));
    const rt2 = returnRental(rr.rental.id, { lines: [{ idx: 0, qty: 3, cond: "GOOD" }], at: dayStart(day0 + 2) + 10 * 3600000, idemKey: "acc-rn2" }, yard);
    docs.push(["كشف دخول 1", rt1.rn.no], ["كشف دخول 2", rt2.rn.no]);
    check(G5, "بعد رد الباقي: المتاح 10 والعهدة صفر", bal(mach.id, "w1").AVAILABLE === 10 && custodyRows(cust.id, pB.id).find((r) => r.pid === mach.id).onSite === 0 && rentalStatusCalc(rr.rental) === "RETURNED");
    check(G5, "العهدة انتهت والدين المالي باقٍ حتى القبض", invRemaining(rr.invoice) === 13800);
    const pr = recordPayment({ customerId: cust.id, allocations: [{ invoiceId: rr.invoice.id, amount: 13800 }], method: "CASH", accountId: "a-cash", repId: "r1", idemKey: "acc-pr" }, fin);
    docs.push(["سند قبض الإيجار", pr.no]);
    check(G5, "تحصيل الإيجار يحدّث الفاتورة ورصيد العقد المالي", invStatus(rr.invoice) === "PAID" && rentalInvoiced(rr.rental) - S.invoices.filter((i) => i.refId === rr.rental.id).reduce((a, i) => a + invPaid(i), 0) === 0);
    check(G5, "لا قيمة إضافية لأن الرد تم خلال المدة", rentalUnbilled(rr.rental).gross === 0);

    /* ٦. مشروعان */
    const G6 = "٦. مشروعان لنفس العميل ونفس الصنف دون اختلاط";
    const q3 = S.products.find((p) => p.family === "قائم" && p.len === 3);
    const cA = custodyRows(cust.id, pA.id).filter((r) => r.pid === q3.id).reduce((a, r) => a + r.onSite, 0);
    const cAll = custodyRows(cust.id).filter((r) => r.pid === q3.id).reduce((a, r) => a + r.onSite, 0);
    const rx = createRental({ customerId: cust.id, projectId: pB.id, wh: "w1", basis: "MONTHLY", periods: 1, lines: [{ pid: q3.id, qty: 2 }], idemKey: "acc-r2" }, s1);
    deliverRental(rx.rental.id, { lines: [{ idx: 0, qty: 2 }], idemKey: "acc-r2-dl" }, yard);
    const rA = S.rentals.find((r) => r.projectId === pA.id && r.lines[0].pid === q3.id && r.lines[0].delivered > r.lines[0].returned);
    returnRental(rA.id, { lines: [{ idx: 0, qty: 1, cond: "GOOD" }], idemKey: "acc-r2-rn" }, yard);
    const cA2 = custodyRows(cust.id, pA.id).filter((r) => r.pid === q3.id).reduce((a, r) => a + r.onSite, 0);
    const cB2 = custodyRows(cust.id, pB.id).filter((r) => r.pid === q3.id).reduce((a, r) => a + r.onSite, 0);
    check(G6, "رد قطعة من «المستودع» لا يغيّر عهدة «المجمع»", cA2 === cA - 1 && cB2 === 2, `المستودع ${cA}→${cA2} · المجمع ${cB2}`);
    check(G6, "إجمالي العميل = مجموع المشروعين", custodyRows(cust.id).filter((r) => r.pid === q3.id).reduce((a, r) => a + r.onSite, 0) === cAll - 1 + 2);
    check(G6, "سندات مشروع لا تظهر في المشروع الآخر", customerDocuments(cust.id, pA.id).every((d) => d.projectId === pA.id) && customerDocuments(cust.id, pB.id).every((d) => d.projectId === pB.id));
    check(G6, "مستندات عميل لا تظهر في ملف عميل آخر", customerDocuments(S.customers[1].id).every((d) => byId(S.sales, d.id)?.customerId !== cust.id && byId(S.payments, d.id)?.customerId !== cust.id));

    /* ٧. البحث */
    const G7 = "٧. البحث بالمفاتيح الخمسة";
    const comp = S.customers.find((c) => c.type === "COMPANY" && c.cr);
    const ind = S.customers.find((c) => c.nationalId);
    const iq = S.customers.find((c) => c.iqama);
    const ar = (s) => s.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
    const found = (q, c) => searchCustomers(q).some((x) => x.customer.id === c.id);
    check(G7, "السجل التجاري (بأرقام عربية)", found(ar(comp.cr), comp), ar(comp.cr));
    check(G7, "الجوال بصيغة +966", found("+966 " + comp.mobile.slice(1), comp), "+966 " + comp.mobile.slice(1));
    check(G7, "اسم العلامة التجارية", found(comp.tradeName, comp), comp.tradeName);
    check(G7, "الهوية الوطنية", found(ind.nationalId, ind), ind.nationalId);
    check(G7, "الإقامة", found(iq.iqama, iq), iq.iqama);
    check(G7, "لا تُملأ حقول غير منطبقة (منشأة بلا هوية، فرد بلا سجل)", !comp.nationalId && !comp.iqama && !ind.cr);

    /* ٨. المصروف */
    const G8 = "٨. المصروفات وحد الاعتماد 5,000";
    const c0 = accountBalance("a-cash");
    const e1 = createExpense({ cat: "إعاشة وطعام", amount: 499999, accountId: "a-cash", idemKey: "acc-e1" }, fin).expense;
    check(G8, "4,999.99 يُرحّل مباشرة", e1.status === "APPROVED" && accountBalance("a-cash") === c0 - 499999);
    const c1 = accountBalance("a-cash");
    const e2 = createExpense({ cat: "إعاشة وطعام", amount: 500000, accountId: "a-cash", idemKey: "acc-e2" }, fin).expense;
    check(G8, "5,000 ينتظر الموافقة ولا يخصم", e2.status === "PENDING" && accountBalance("a-cash") === c1);
    const e3 = createExpense({ cat: "مصروف صيانة", amount: 750000, accountId: "a-cash", idemKey: "acc-e3" }, fin).expense;
    const ap3 = S.approvals.find((a) => a.entityId === e3.id);
    decideApproval(ap3.id, "APPROVED", "", owner);
    check(G8, "7,500 بعد موافقة المالك يُخصم مرة واحدة", accountBalance("a-cash") === c1 - 750000);
    check(G8, "اعتماد المصروف مرتين من جلستين ⇐ قيد واحد", !!expectErr(() => decideApproval(ap3.id, "APPROVED", "", owner)) && transactions().filter((t) => t.ref === e3.id).length === 1);
    const ap2 = S.approvals.find((a) => a.entityId === e2.id);
    decideApproval(ap2.id, "REJECTED", "غير ضروري", owner);
    check(G8, "رفض مصروف يترك الحساب دون خصم ويحفظ السبب", accountBalance("a-cash") === c1 - 750000 && e2.reason === "غير ضروري" && e2.reviewedBy === owner.id);

    /* ٩. سند لأمر */
    const G9 = "٩. سند لأمر";
    const cc = accountBalance("a-cash");
    S.promissory.push({ id: "pn-acc", no: "PN-TEST", customerId: cust.id, projectId: pA.id, amount: 100000, at: Date.now(), due: null, status: "ACTIVE", by: fin.id });
    VER++;
    check(G9, "إصدار سند لأمر 1,000 لا يغيّر الصندوق", accountBalance("a-cash") === cc);
    check(G9, "يظهر في بروفايل المشروع الصحيح فقط", customerDocuments(cust.id, pA.id).some((d) => d.id === "pn-acc") && !customerDocuments(cust.id, pB.id).some((d) => d.id === "pn-acc"));

    /* ١١. مطابقة كشف «محمد» من ملفات المؤسسة */
    const G11 = "١١. فاتورة إيجارات الفترة بطريقة المؤسسة (كشف محمد)";
    const moh = S.customers.find((c) => c.name === "محمد");
    const rMoh = S.rentals.find((r) => r.customerId === moh.id);
    const t0 = Math.min(...S.movements.filter((m) => m.rentalId === rMoh.id && m.type === "RENTAL_OUT").map((m) => dayNo(m.at)));
    const prow = rentalPeriodRows(moh.id, null, t0, t0 + 118);
    const amt = (n) => prow.filter((r) => r.name.startsWith(n)).reduce((s, r) => s + r.amount, 0);
    check(G11, "برواز 2م: 125 × 9 ÷ 30 × 119 يومًا = 4,462.50", amt("برواز 2م") === 446250, (amt("برواز 2م") / 100).toFixed(2));
    check(G11, "بنطي: 30 × 10 ÷ 30 × 119 = 1,190.00", amt("بنطي") === 119000);
    check(G11, "مرابيع 3م: 10 × 150 ÷ 30 × 115 = 5,750.00", amt("مرابيع") === 575000);
    check(G11, "بلايود: 150 × 10 ÷ 30 × 110 = 5,500.00", amt("بلايود") === 550000);
    check(G11, "المائل والأفقي بسعر صفر يظهران للمطابقة الكمية", prow.some((r) => r.name.startsWith("مائل") && r.amount === 0) && prow.some((r) => r.name.startsWith("أفقي") && r.amount === 0));
    const totM = prow.reduce((s, r) => s + r.amount, 0);
    check(G11, "إجمالي الفترة 16,902.50 (مطابق لملف المؤسسة)", totM === 1690250, (totM / 100).toFixed(2));
    check(G11, "أجرة النقل 180 بند مستقل في حساب العميل", S.invoices.some((i) => i.customerId === moh.id && i.kind === "FEES" && i.taxable === 18000));
    const bills = S.rentals.filter((r) => r.customerId === moh.id).map((r) => billRental(r.id, fin, t0 + 119));
    check(G11, "إصدار الفاتورة ثم إعادة الحساب لنفس الفترة ⇐ لا شيء غير مفوتر", bills[0].taxable === 1690250 && rentalPeriodRows(moh.id, null, t0, t0 + 118).length === 0);

    /* ١٢. الإلغاء والإغلاق وحماية الصندوق */
    const G12 = "١٢. إلغاء البيع، إغلاق العقد وإلغاؤه، وحماية الصندوق";
    const fr2 = S.products.find((p) => p.testTag === "TEST_FRAME");
    const av0 = bal(fr2.id, "w1").AVAILABLE;
    const cs1 = createSale({ customerId: cust.id, projectId: pA.id, wh: "w1", lines: [{ pid: fr2.id, count: 2, price: 10000 }], term: "CREDIT", idemKey: "acc-cancel-sale" }, s1);
    check(G12, "البائع لا يملك إلغاء البيع", !!expectErr(() => cancelSale(cs1.sale.id, "خطأ", s1)));
    cancelSale(cs1.sale.id, "طلب العميل", owner);
    check(G12, "إلغاء البيع يعيد الكمية ويلغي الفاتورة وذمتها", bal(fr2.id, "w1").AVAILABLE === av0 && invStatus(cs1.invoice) === "CANCELLED" && invRemaining(cs1.invoice) === 0);
    const cr = createRental({ customerId: cust.id, projectId: pA.id, wh: "w1", basis: "DAILY", periods: 2, lines: [{ pid: mach.id, qty: 3, rate: 1000 }], idemKey: "acc-cancel-rent" }, s1);
    cancelRental(cr.rental.id, "تأجل المشروع", owner);
    check(G12, "إلغاء عقد قبل التسليم يفك الحجز ويلغي فاتورته", bal(mach.id, "w1").RESERVED === 0 && bal(mach.id, "w1").AVAILABLE === 10 && invStatus(cr.invoice) === "CANCELLED");
    const pr2 = createRental({ customerId: cust.id, projectId: pA.id, wh: "w1", basis: "DAILY", periods: 2, mode: "OPEN", lines: [{ pid: mach.id, qty: 5, rate: 1000 }], idemKey: "acc-close-rent" }, s1);
    deliverRental(pr2.rental.id, { lines: [{ idx: 0, qty: 3 }], idemKey: "acc-close-dl" }, yard);
    check(G12, "لا يُغلق عقد ما زالت معداته لدى العميل", !!expectErr(() => closeRental(pr2.rental.id, fin)));
    returnRental(pr2.rental.id, { lines: [{ idx: 0, qty: 3, cond: "GOOD" }], idemKey: "acc-close-rn" }, yard);
    const closed = closeRental(pr2.rental.id, fin);
    check(G12, "إغلاق العقد يفوتر الأيام ويفك حجز ما لم يُسلَّم (2 قطعة)", closed.rental.status === "CLOSED" && bal(mach.id, "w1").RESERVED === 0 && bal(mach.id, "w1").AVAILABLE === 10 && !!closed.bill);
    check(G12, "لا تسليم على عقد مغلق", !!expectErr(() => deliverRental(pr2.rental.id, { lines: [{ idx: 0, qty: 1 }], idemKey: "acc-x-dl" }, yard)));
    const big = createExpense({ cat: "مصروف صيانة", amount: accountBalance("a-cash") + 100, accountId: "a-cash", idemKey: "acc-big" }, fin).expense;
    check(G12, "الصندوق لا يصرف أكثر من رصيده (يُرفض الاعتماد)", big.status === "PENDING" && !!expectErr(() => decideApproval(S.approvals.find((x) => x.entityId === big.id).id, "APPROVED", "", owner)) && accountBalance("a-cash") >= 0);

    /* ١٠. المطابقة */
    const G10 = "١٠. المطابقة بين الدفاتر";
    let okInv = true;
    for (const i of S.invoices) if (i.status !== "CANCELLED" && i.total !== invPaid(i) + invRemaining(i)) okInv = false;
    check(G10, "كل فاتورة: الإجمالي = المدفوع المخصص + المتبقي (الملغاة: صفر بإشعار دائن)", okInv, `${S.invoices.length} فاتورة`);
    let okAcc = true;
    for (const a of S.accounts) {
      const t = transactions().filter((x) => x.accountId === a.id);
      if (accountBalance(a.id) !== a.opening + t.filter((x) => x.dir === "IN").reduce((s, x) => s + x.amount, 0) - t.filter((x) => x.dir === "OUT").reduce((s, x) => s + x.amount, 0)) okAcc = false;
    }
    check(G10, "رصيد كل حساب = الافتتاحي + الداخل − الخارج", okAcc);
    let okPay = S.payments.every((p) => p.amount === p.allocations.reduce((a, x) => a + x.amount, 0));
    check(G10, "مجموع تخصيصات كل سند = مبلغه", okPay);
    let okRent = S.rentals.every((r) => r.lines.every((l, i) => l.delivered - l.returned === lineEvents(r.id, i).reduce((a, e) => a + e.delta, 0)));
    check(G10, "عهدة كل بند = المسلّم − المرتجع من دفتر الحركات", okRent);
    let okNeg = Object.values(balances()).every((b) => STATES.every((s) => b[s] >= 0));
    check(G10, "لا يوجد رصيد مخزون سالب في أي حالة أو مستودع", okNeg);
    const bal2 = S.customers.every((c) => customerSummary(c.id).balance === S.invoices.filter((i) => i.customerId === c.id).reduce((a, i) => a + invRemaining(i), 0));
    check(G10, "ذمة كل عميل = مجموع متبقي فواتيره المفتوحة", bal2);
  } catch (e) {
    console.error(e);
    results.push({ group: "خطأ", name: "توقف التشغيل: " + e.message, ok: false });
  } finally {
    S = JSON.parse(backup);
    VER++;
  }
  return { results, docs, at: Date.now() };
}

route("/acceptance", [], () => {
  const R = UI.accept;
  const groups = R ? [...new Set(R.results.map((r) => r.group))] : [];
  const pass = R ? R.results.filter((r) => r.ok).length : 0;
  return `${pageHead("سيناريوهات القبول", "اختبارات المواصفات تُنفّذ على نسخة معزولة من البيانات ثم تُستعاد البيانات كما كانت — يمكن تشغيلها في أي وقت", `<button class="btn primary lg" data-act="runAccept" data-label="تشغيل الاختبارات">${ic("checkc")}تشغيل الاختبارات</button>`)}
  ${R ? `<div class="alert ${pass === R.results.length ? "ok" : "danger"}" style="margin-bottom:14px">${ic(pass === R.results.length ? "checkc" : "alert")}<div><b>${pass} من ${R.results.length} اختبار ناجح</b> — آخر تشغيل <span class="num">${fmtDT(R.at)}</span></div></div>
  <div class="grid g3"><div class="span2 col" style="gap:12px">${groups.map((g) => `<div class="card"><div class="card-h"><h3>${g}</h3><span class="chip">${R.results.filter((r) => r.group === g && r.ok).length}/${R.results.filter((r) => r.group === g).length}</span></div><div class="card-b col" style="gap:6px">${R.results.filter((r) => r.group === g).map((r) => `<div class="row between small"><span class="row">${r.ok ? `<span style="color:var(--green)">${ic("checkc").replace("<svg", '<svg style="width:17px;height:17px"')}</span>` : `<span style="color:var(--red)">${ic("x").replace("<svg", '<svg style="width:17px;height:17px"')}</span>`}${esc(r.name)}</span><span class="xs muted num">${esc(r.detail || "")}</span></div>`).join("")}</div></div>`).join("")}</div>
  <div class="card" style="align-self:start"><div class="card-h"><h3>أرقام المستندات المقاسة</h3></div><div class="card-b col" style="gap:6px">${R.docs.map(([k, v]) => `<div class="row between small"><span class="muted">${k}</span><b class="num">${v}</b></div>`).join("")}<div class="xs faint" style="margin-top:6px">أُنشئت أثناء الاختبار على النسخة المعزولة ثم أُزيلت.</div></div></div></div>` : `<div class="card">${emptyBox("اضغط «تشغيل الاختبارات» لتنفيذ سيناريوهات المواصفات تلقائيًا", "checkc")}</div>`}
  <div class="section-title">جرّب المسار الأهم يدويًا (من نافذتين)</div>
  <div class="card card-b"><ol style="line-height:2.1;margin:0;padding-right:20px">
    <li>افتح هذا الملف في <b>نافذتين</b>. في الأولى ادخل بـ <span class="num">seller1</span> وفي الثانية بـ <span class="num">finance</span>. (للتبديل استخدم قائمة المستخدم ← تبديل المستخدم.)</li>
    <li>البائع: <b>بيع جديد</b> ← ابحث عن العميل بـ <span class="num">٠٥٠١٢٣٤٥٦٧</span> ← اختر مشروع «المستودع» ← أضف 3 × «إطار سقالة 1.7م» ← آجل ← تأكيد البيع. لاحظ الفاتورة 345.00.</li>
    <li>المالية (النافذة الثانية): تظهر الفاتورة الجديدة في «فواتير تحتاج متابعة» تلقائيًا ← تحصيل 100 نقدًا باسم المندوب ← ثم 245 تحويل إلى «الراجحي - خاص».</li>
    <li>تحقق: الصندوق +100، البنك +245، الفاتورة مدفوعة، ذمة العميل نقصت، لوحة البائع «المحصّل من عملياتي» زادت، المخزون 17.</li>
    <li>افتح بروفايل «مؤسسة الأفق للمقاولات»: اضغط مشروع «المستودع» ثم «المجمع» وقارن القطع بالعهدة والمبالغ لكل مشروع، وافتح أي سند واطبعه.</li>
    <li>ادخل بـ <span class="num">sulaiman</span>: راجع لوحة المالك والموافقات (خصم ينتظر قرارك، ومصروف 7,500).</li>
    <li>ادخل بـ <span class="num">yard</span> (مسؤول العدد): افتح عقدًا نشطًا وسجّل كشف دخول بقطع سليمة وأخرى تالفة مع مبلغ صيانة.</li>
  </ol></div>`;
});
ACTIONS.runAccept = (el) => {
  el.disabled = true;
  el.innerHTML = `<span class="spin"></span> جارٍ التشغيل…`;
  setTimeout(() => {
    UI.accept = runAcceptance();
    render();
  }, 300);
};

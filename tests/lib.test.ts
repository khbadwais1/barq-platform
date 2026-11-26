// اختبارات وحدات لقواعد الحساب في النظام الكامل (src/lib) — مرتبطة بقواعد العمل في BUSINESS_RULES.md
import { describe, expect, it } from "vitest";
import { computeSaleTotals, computeRentalEstimate, pieceDays, accrualAmount, PricingError } from "../src/lib/pricing";
import { normalizeMobile, normalizeId, toLatinDigits, normalizeArabicText } from "../src/lib/normalize";
import { r2, D } from "../src/lib/money";
import { resolvePeriod, riyadhDayNumber, daysOverdue } from "../src/lib/dates";
import { growthPct } from "../src/lib/format";

describe("BR-001 حساب البيع والضريبة", () => {
  it("3 × 100 بضريبة 15% = 345", () => {
    const t = computeSaleTotals([{ count: 3, unitPrice: 100, pricingUnit: "PIECE" }], 0, 15);
    expect(t.taxableAmount.toFixed(2)).toBe("300.00");
    expect(t.vatAmount.toFixed(2)).toBe("45.00");
    expect(t.total.toFixed(2)).toBe("345.00");
  });
  it("خصم 20 على المستند: وعاء 280 وضريبة 42 وإجمالي 322", () => {
    const t = computeSaleTotals([{ count: 3, unitPrice: 100, pricingUnit: "PIECE" }], 20, 15);
    expect(t.taxableAmount.toFixed(2)).toBe("280.00");
    expect(t.vatAmount.toFixed(2)).toBe("42.00");
    expect(t.total.toFixed(2)).toBe("322.00");
  });
  it("التسعير بالمتر: العدد × الطول × السعر", () => {
    const t = computeSaleTotals([{ count: 10, unitPrice: 18, pricingUnit: "METER", lengthM: 4 }], 0, 15);
    expect(t.lines[0].meters?.toFixed(2)).toBe("40.00");
    expect(t.grossAmount.toFixed(2)).toBe("720.00");
  });
  it("لا تُقبل كمية صفر أو سعر سالب أو خصم أكبر من البند", () => {
    expect(() => computeSaleTotals([{ count: 0, unitPrice: 1, pricingUnit: "PIECE" }], 0, 15)).toThrow(PricingError);
    expect(() => computeSaleTotals([{ count: 1, unitPrice: -1, pricingUnit: "PIECE" }], 0, 15)).toThrow(PricingError);
    expect(() => computeSaleTotals([{ count: 1, unitPrice: 10, pricingUnit: "PIECE", discount: 11 }], 0, 15)).toThrow(PricingError);
    expect(() => computeSaleTotals([{ count: 1, unitPrice: 10, pricingUnit: "PIECE" }], 11, 15)).toThrow(PricingError);
  });
  it("التقريب نصف للأعلى بمنزلتين بلا أخطاء كسور", () => {
    expect(r2("0.005").toFixed(2)).toBe("0.01");
    expect(D("0.1").plus("0.2").toFixed(2)).toBe("0.30");
  });
});

describe("BR-010 تسعير الإيجار", () => {
  it("4 × 10 × 3 أيام بضريبة 15% = 138", () => {
    const e = computeRentalEstimate([{ quantity: 4, rate: 10 }], 3, 0, 15);
    expect(e.taxable.toFixed(2)).toBe("120.00");
    expect(e.total.toFixed(2)).toBe("138.00");
  });
  it("قطعة × يوم: المرتجع يخرج من العدّ", () => {
    // سُلّمت 4 يوم 0، رُدت 1 يوم 2 ⇒ (4×2) + (3×1) = 11 قطعة×يوم حتى يوم 3
    expect(pieceDays([{ day: 0, delta: 4 }, { day: 2, delta: -1 }], 0, 3)).toBe(11);
  });
  it("BR-015 كشف المؤسسة: 125 × 9 شهريًا × 119 يومًا ÷ 30 = 4462.50", () => {
    expect(accrualAmount(125 * 119, 9, "MONTHLY").toFixed(2)).toBe("4462.50");
    expect(accrualAmount(10 * 115, 150, "MONTHLY").toFixed(2)).toBe("5750.00");
  });
});

describe("BR-020 البحث بالمفاتيح الخمسة", () => {
  it("الجوال بكل الصيغ يتوحد إلى 05XXXXXXXX", () => {
    for (const v of ["0501234567", "501234567", "+966501234567", "00966 50 123 4567", "٠٥٠١٢٣٤٥٦٧"]) expect(normalizeMobile(v)).toBe("0501234567");
  });
  it("المعرّفات تحفظ الأصفار البادئة وتقبل الأرقام العربية", () => {
    expect(normalizeId("٠٠١٢٣")).toBe("00123");
    expect(toLatinDigits("٤٦٥٠١٨٤٤٠٨")).toBe("4650184408");
  });
  it("تطبيع النص العربي للبحث", () => {
    expect(normalizeArabicText("مؤسسة الأُفق")).toBe(normalizeArabicText("مؤسسه الافق"));
  });
});

describe("BR-030 الفترات بتوقيت الرياض", () => {
  const now = new Date("2026-11-25T22:30:00Z"); // 01:30 فجر 26/11 بتوقيت الرياض
  it("اليوم يبدأ منتصف الليل بتوقيت الرياض", () => {
    const p = resolvePeriod("today", undefined, undefined, now);
    expect(p.from.toISOString()).toBe("2026-11-25T21:00:00.000Z");
    expect(p.to.getTime() - p.from.getTime()).toBe(86400000);
  });
  it("أيام التأخير بالتقويم المحلي", () => {
    expect(daysOverdue(new Date("2026-11-20T10:00:00Z"), now)).toBe(6);
    expect(riyadhDayNumber(now)).toBe(riyadhDayNumber(new Date("2026-11-26T05:00:00Z")));
  });
  it("المقارنة غير متاحة عند غياب مقام صالح", () => {
    expect(growthPct(100, 0)).toBeNull();
    expect(growthPct(150, 100)).toBe(50);
  });
});

/**
 * قواعد التسعير — دوال نقية تُستخدم في الواجهة (حساب لحظي) وفي الخادم (التحقق والحفظ).
 * الخادم يعيد الحساب دائمًا ولا يثق بأرقام الواجهة.
 */
import { D, r2, sum, Decimal, type DecimalLike } from "./money";

export type PricingUnitT = "PIECE" | "METER";

export interface SaleLineInput {
  count: number;
  unitPrice: DecimalLike;
  pricingUnit: PricingUnitT;
  lengthM?: DecimalLike | null;
  discount?: DecimalLike;
}

export interface SaleLineResult {
  meters: Decimal | null;
  priceQty: Decimal;
  lineGross: Decimal;
  discount: Decimal;
  lineNet: Decimal;
}

export interface SaleTotals {
  lines: SaleLineResult[];
  grossAmount: Decimal;
  itemsDiscount: Decimal;
  docDiscount: Decimal;
  taxableAmount: Decimal;
  vatRate: Decimal;
  vatAmount: Decimal;
  total: Decimal;
  totalDiscount: Decimal;
  /** نسبة الخصم الكلي من الإجمالي قبل الخصم */
  discountPct: Decimal;
}

export class PricingError extends Error {}

/** الكمية بالمتر = العدد × طول القطعة */
export function metersOf(count: number, lengthM?: DecimalLike | null): Decimal | null {
  if (lengthM === null || lengthM === undefined || D(lengthM).isZero()) return null;
  return r2(D(lengthM).times(count));
}

export function computeSaleTotals(
  lines: SaleLineInput[],
  docDiscount: DecimalLike,
  vatRatePct: DecimalLike,
): SaleTotals {
  const results: SaleLineResult[] = lines.map((l) => {
    if (!Number.isInteger(l.count) || l.count <= 0) throw new PricingError("العدد يجب أن يكون رقمًا صحيحًا أكبر من صفر");
    const price = D(l.unitPrice);
    if (price.isNegative()) throw new PricingError("السعر لا يمكن أن يكون سالبًا");
    const meters = metersOf(l.count, l.lengthM);
    const priceQty = l.pricingUnit === "METER" && meters ? meters : D(l.count);
    const lineGross = r2(priceQty.times(price));
    const discount = r2(l.discount ?? 0);
    if (discount.isNegative()) throw new PricingError("الخصم لا يمكن أن يكون سالبًا");
    if (discount.greaterThan(lineGross)) throw new PricingError("خصم البند أكبر من قيمته");
    return { meters, priceQty, lineGross, discount, lineNet: lineGross.minus(discount) };
  });
  const grossAmount = sum(results.map((r) => r.lineGross));
  const itemsDiscount = sum(results.map((r) => r.discount));
  const net = grossAmount.minus(itemsDiscount);
  const doc = r2(docDiscount);
  if (doc.isNegative()) throw new PricingError("خصم المستند لا يمكن أن يكون سالبًا");
  if (doc.greaterThan(net)) throw new PricingError("خصم المستند أكبر من الصافي");
  const taxableAmount = net.minus(doc);
  const vatRate = D(vatRatePct);
  const vatAmount = r2(taxableAmount.times(vatRate).dividedBy(100));
  const totalDiscount = itemsDiscount.plus(doc);
  return {
    lines: results,
    grossAmount,
    itemsDiscount,
    docDiscount: doc,
    taxableAmount,
    vatRate,
    vatAmount,
    total: taxableAmount.plus(vatAmount),
    totalDiscount,
    discountPct: grossAmount.isZero() ? new Decimal(0) : r2(totalDiscount.dividedBy(grossAmount).times(100)),
  };
}

// ───────────────────────── الإيجار ─────────────────────────

export type PricingBasisT = "DAILY" | "WEEKLY" | "MONTHLY";

export const BASIS_DAYS: Record<PricingBasisT, number> = { DAILY: 1, WEEKLY: 7, MONTHLY: 30 };
export const BASIS_LABEL: Record<PricingBasisT, string> = { DAILY: "يومي", WEEKLY: "أسبوعي", MONTHLY: "شهري" };
export const BASIS_UNIT: Record<PricingBasisT, string> = { DAILY: "يوم", WEEKLY: "أسبوع", MONTHLY: "شهر" };

export interface RentalLineInput {
  quantity: number;
  rate: DecimalLike;
}

/** القيمة التقديرية للعقد = Σ الكمية × السعر × عدد الفترات − الخصم، ثم الضريبة */
export function computeRentalEstimate(
  lines: RentalLineInput[],
  plannedPeriods: number,
  discount: DecimalLike,
  vatRatePct: DecimalLike,
) {
  if (!Number.isInteger(plannedPeriods) || plannedPeriods <= 0) throw new PricingError("عدد الفترات غير صالح");
  const lineTotals = lines.map((l) => {
    if (!Number.isInteger(l.quantity) || l.quantity <= 0) throw new PricingError("الكمية يجب أن تكون أكبر من صفر");
    if (D(l.rate).isNegative()) throw new PricingError("السعر لا يمكن أن يكون سالبًا");
    return r2(D(l.rate).times(l.quantity).times(plannedPeriods));
  });
  const gross = sum(lineTotals);
  const disc = r2(discount);
  if (disc.isNegative() || disc.greaterThan(gross)) throw new PricingError("الخصم غير صالح");
  const taxable = gross.minus(disc);
  const vat = r2(taxable.times(D(vatRatePct)).dividedBy(100));
  return { lineTotals, gross, discount: disc, taxable, vat, total: taxable.plus(vat) };
}

export interface CustodyEvent {
  /** رقم يوم الرياض */
  day: number;
  /** + للتسليم، − للرد */
  delta: number;
}

/**
 * «قطعة × يوم» في المدى [fromDay, toDay).
 * القطعة المسلمة يوم D والمرتجعة يوم R تُحسب R − D يومًا (يوم الرد لا يُحتسب).
 */
export function pieceDays(events: CustodyEvent[], fromDay: number, toDay: number): number {
  if (toDay <= fromDay) return 0;
  const sorted = [...events].sort((a, b) => a.day - b.day);
  let total = 0;
  let onSite = 0;
  let cursor = fromDay;
  for (const e of sorted) {
    if (e.day <= fromDay) {
      onSite += e.delta;
      continue;
    }
    if (e.day >= toDay) break;
    total += onSite * (e.day - cursor);
    cursor = e.day;
    onSite += e.delta;
  }
  total += onSite * (toDay - cursor);
  return Math.max(0, total);
}

/** قيمة الإيجار المستحقة لقطع×أيام بسعر أساس معيّن */
export function accrualAmount(pieceDaysCount: number, rate: DecimalLike, basis: PricingBasisT): Decimal {
  return r2(D(rate).times(pieceDaysCount).dividedBy(BASIS_DAYS[basis]));
}

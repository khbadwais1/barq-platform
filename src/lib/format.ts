import { D, type DecimalLike } from "./money";

const sarFmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const intFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** مبلغ بالريال: 1,234.50 */
export function fmtMoney(v: DecimalLike | null | undefined): string {
  return sarFmt.format(D(v).toNumber());
}
export function fmtSAR(v: DecimalLike | null | undefined): string {
  return `${fmtMoney(v)} ر.س`;
}
export function fmtInt(v: number | null | undefined): string {
  return intFmt.format(v ?? 0);
}
export function fmtCompact(v: number): string {
  return compactFmt.format(v);
}
export function fmtPct(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

/** نسبة النمو؛ null إذا لم يكن للمقام قيمة صالحة (المقارنة غير متاحة) */
export function growthPct(current: number, previous: number): number | null {
  if (!previous || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

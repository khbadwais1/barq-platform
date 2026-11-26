import Decimal from "decimal.js";

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

export type DecimalLike = Decimal | string | number | { toString(): string };

/** يحوّل أي قيمة (Prisma.Decimal / string / number) إلى Decimal */
export function D(v: DecimalLike | null | undefined): Decimal {
  if (v === null || v === undefined || v === "") return new Decimal(0);
  if (v instanceof Decimal) return v;
  return new Decimal(typeof v === "number" ? v : v.toString());
}

/** تقريب موحد: منزلتان عشريتان، نصف للأعلى */
export function r2(v: DecimalLike): Decimal {
  return D(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function sum(values: DecimalLike[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(D(v)), new Decimal(0));
}

/** يحوّل إلى نص بمنزلتين لتخزينه في Prisma Decimal */
export function toDb(v: DecimalLike): string {
  return r2(v).toFixed(2);
}

export function toNum(v: DecimalLike | null | undefined): number {
  return D(v).toNumber();
}

export { Decimal };

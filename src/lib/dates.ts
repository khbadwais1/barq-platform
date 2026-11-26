/** توقيت الرياض ثابت UTC+3 بدون توقيت صيفي */
export const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** رقم اليوم بتوقيت الرياض (أيام منذ 1970) — يُستخدم لحساب أيام الإيجار */
export function riyadhDayNumber(d: Date): number {
  return Math.floor((d.getTime() + RIYADH_OFFSET_MS) / DAY_MS);
}

/** بداية يوم الرياض (كوقت UTC) لرقم يوم */
export function dayNumberToDate(day: number): Date {
  return new Date(day * DAY_MS - RIYADH_OFFSET_MS);
}

export function startOfRiyadhDay(d: Date): Date {
  return dayNumberToDate(riyadhDayNumber(d));
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

/** يحوّل "YYYY-MM-DD" إلى بداية ذلك اليوم بتوقيت الرياض */
export function parseRiyadhDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - RIYADH_OFFSET_MS);
}

/** YYYY-MM-DD بتوقيت الرياض */
export function toRiyadhISODate(d: Date): string {
  const t = new Date(d.getTime() + RIYADH_OFFSET_MS);
  return t.toISOString().slice(0, 10);
}

function riyadhParts(d: Date) {
  const t = new Date(d.getTime() + RIYADH_OFFSET_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), day: t.getUTCDate() };
}

function riyadhMonthStart(y: number, m: number): Date {
  return new Date(Date.UTC(y, m, 1) - RIYADH_OFFSET_MS);
}

export type PeriodKey = "today" | "7d" | "30d" | "month" | "lastMonth" | "custom";

export interface Period {
  key: PeriodKey;
  from: Date; // شامل
  to: Date; // حصري
  label: string;
  prevFrom: Date;
  prevTo: Date;
}

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: "اليوم",
  "7d": "آخر 7 أيام",
  "30d": "آخر 30 يومًا",
  month: "هذا الشهر",
  lastMonth: "الشهر الماضي",
  custom: "فترة مخصصة",
};

/** يحسب حدود الفترة والفترة السابقة المماثلة لها بتوقيت الرياض */
export function resolvePeriod(
  key: string | undefined,
  fromStr?: string,
  toStr?: string,
  now: Date = new Date(),
): Period {
  const today = startOfRiyadhDay(now);
  const tomorrow = addDays(today, 1);
  const k = (key ?? "30d") as PeriodKey;
  let from: Date;
  let to: Date;
  let prevFrom: Date;
  let prevTo: Date;
  switch (k) {
    case "today":
      from = today;
      to = tomorrow;
      prevFrom = addDays(today, -1);
      prevTo = today;
      break;
    case "7d":
      from = addDays(tomorrow, -7);
      to = tomorrow;
      prevFrom = addDays(from, -7);
      prevTo = from;
      break;
    case "month": {
      const { y, m } = riyadhParts(now);
      from = riyadhMonthStart(y, m);
      to = tomorrow;
      prevFrom = riyadhMonthStart(y, m - 1);
      // نفس عدد الأيام من الشهر السابق للمقارنة العادلة
      prevTo = new Date(Math.min(prevFrom.getTime() + (to.getTime() - from.getTime()), from.getTime()));
      break;
    }
    case "lastMonth": {
      const { y, m } = riyadhParts(now);
      from = riyadhMonthStart(y, m - 1);
      to = riyadhMonthStart(y, m);
      prevFrom = riyadhMonthStart(y, m - 2);
      prevTo = from;
      break;
    }
    case "custom": {
      if (fromStr && toStr) {
        from = parseRiyadhDate(fromStr);
        to = addDays(parseRiyadhDate(toStr), 1);
        if (to <= from) to = addDays(from, 1);
        const len = to.getTime() - from.getTime();
        prevFrom = new Date(from.getTime() - len);
        prevTo = from;
        break;
      }
      return resolvePeriod("30d", undefined, undefined, now);
    }
    case "30d":
    default:
      from = addDays(tomorrow, -30);
      to = tomorrow;
      prevFrom = addDays(from, -30);
      prevTo = from;
      return { key: "30d", from, to, prevFrom, prevTo, label: PERIOD_LABELS["30d"] };
  }
  return { key: k, from, to, prevFrom, prevTo, label: PERIOD_LABELS[k] };
}

const gregFmt = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
  timeZone: "Asia/Riyadh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const gregTimeFmt = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
  timeZone: "Asia/Riyadh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const hijriFmt = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", {
  timeZone: "Asia/Riyadh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return gregFmt.format(new Date(d));
}
export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return gregTimeFmt.format(new Date(d));
}
export function fmtHijri(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return hijriFmt.format(new Date(d));
}

/** عدد أيام التأخير بتوقيت الرياض (0 إذا لم يتأخر) */
export function daysOverdue(dueDate: Date, now: Date = new Date()): number {
  return Math.max(0, riyadhDayNumber(now) - riyadhDayNumber(dueDate));
}

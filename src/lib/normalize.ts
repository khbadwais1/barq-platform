const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** يحوّل الأرقام العربية والفارسية إلى لاتينية */
export function toLatinDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (ch) => {
    const a = ARABIC_DIGITS.indexOf(ch);
    if (a >= 0) return String(a);
    return String(PERSIAN_DIGITS.indexOf(ch));
  });
}

/** معرّف رقمي (هوية/إقامة/سجل): أرقام لاتينية فقط مع حفظ الأصفار البادئة */
export function normalizeId(input: string | null | undefined): string | null {
  if (!input) return null;
  const v = toLatinDigits(input).replace(/[^0-9A-Za-z]/g, "");
  return v.length ? v : null;
}

/**
 * يوحّد الجوال السعودي إلى 05XXXXXXXX.
 * يقبل: 0501234567 / 501234567 / +966501234567 / 00966501234567 / ٠٥٠١٢٣٤٥٦٧
 */
export function normalizeMobile(input: string | null | undefined): string {
  if (!input) return "";
  let v = toLatinDigits(input).replace(/[^0-9]/g, "");
  if (v.startsWith("00966")) v = v.slice(5);
  else if (v.startsWith("966")) v = v.slice(3);
  if (v.length === 9 && v.startsWith("5")) v = "0" + v;
  return v;
}

/** تطبيع نص عربي للبحث: إزالة التشكيل وتوحيد الألف والياء والتاء المربوطة */
export function normalizeArabicText(input: string): string {
  return toLatinDigits(input)
    .replace(/[ً-ٰٟ]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function maskMobile(mobile: string): string {
  if (mobile.length < 6) return "••••";
  return mobile.slice(0, 3) + "•••" + mobile.slice(-3);
}

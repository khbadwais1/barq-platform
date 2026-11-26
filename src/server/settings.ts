import { prisma, type Tx } from "@/lib/prisma";

export interface AppSettings {
  companyName: string;
  companyNameEn: string;
  vatNumber: string;
  crNumber: string;
  address: string;
  phones: string;
  /** نسبة ضريبة القيمة المضافة % */
  vatRate: number;
  /** المصروف بهذه القيمة أو أكثر يحتاج اعتماد المالك */
  expenseApprovalThreshold: number;
  /** الحد الافتراضي لخصم البائع % */
  sellerMaxDiscountPct: number;
  /** أيام الاستحقاق الافتراضية للبيع الآجل */
  defaultCreditDays: number;
  /** تنبيه قبل الاستحقاق بعدد أيام */
  dueSoonDays: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  companyName: "مؤسسة سقالات البرق",
  companyNameEn: "Al-Barq Scaffolding",
  vatNumber: "300000000000003",
  crNumber: "4650184408",
  address: "المدينة المنورة - طريق المطار القديم - طريق عبدالله بن الربيع - بجوار حمام الهنا",
  phones: "0565615030 - 0545649033",
  vatRate: 15,
  expenseApprovalThreshold: 5000,
  sellerMaxDiscountPct: 5,
  defaultCreditDays: 30,
  dueSoonDays: 3,
};

export async function getSettings(db: Tx = prisma): Promise<AppSettings> {
  const rows = await db.setting.findMany();
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out as unknown as AppSettings;
}

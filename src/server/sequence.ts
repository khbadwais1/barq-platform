import type { Tx } from "@/lib/prisma";

/**
 * ترقيم متسلسل داخل المعاملة. الصف مقفول حتى نهاية المعاملة،
 * فلا يحصل مستندان على نفس الرقم، وفشل المعاملة يلغي الزيادة.
 */
export async function nextNumber(tx: Tx, prefix: string, pad = 5, date: Date = new Date()): Promise<string> {
  const year = new Date(date.getTime() + 3 * 3600_000).getUTCFullYear();
  const key = `${prefix}-${year}`;
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "DocumentSequence" ("key", "value") VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE SET "value" = "DocumentSequence"."value" + 1
    RETURNING "value"`;
  return `${key}-${String(rows[0].value).padStart(pad, "0")}`;
}

/** رقم بسيط بلا سنة (للعملاء والمشاريع والأصناف) */
export async function nextCode(tx: Tx, prefix: string, pad = 4): Promise<string> {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "DocumentSequence" ("key", "value") VALUES (${prefix}, 1)
    ON CONFLICT ("key") DO UPDATE SET "value" = "DocumentSequence"."value" + 1
    RETURNING "value"`;
  return `${prefix}-${String(rows[0].value).padStart(pad, "0")}`;
}

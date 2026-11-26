import type { Prisma } from "@prisma/client";
import type { Tx } from "@/lib/prisma";

export interface Actor {
  id: string;
  role: string;
  name?: string;
}

function toJson(v: unknown): Prisma.InputJsonValue | undefined {
  if (v === undefined || v === null) return undefined;
  return JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
}

export async function audit(
  tx: Tx,
  actor: Actor | null,
  action: string,
  entityType: string,
  entityId: string | null,
  before?: unknown,
  after?: unknown,
) {
  await tx.auditLog.create({
    data: {
      userId: actor?.id,
      role: actor?.role,
      action,
      entityType,
      entityId,
      before: toJson(before),
      after: toJson(after),
    },
  });
}

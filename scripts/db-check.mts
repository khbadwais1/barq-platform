// فحص اتصال Prisma 7 بالقاعدة وقيود السلامة (تشغيل يدوي: npx tsx scripts/db-check.mts)
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const checks = await prisma.$queryRawUnsafe<{ conname: string }[]>(`select conname from pg_constraint where contype='c' and connamespace='public'::regnamespace order by 1`);
console.log("CHECK constraints:", checks.length);
let rejected = false;
try {
  await prisma.$transaction(async (tx) => {
    await tx.branch.create({ data: { id: "b-chk", code: "CHK", name: "فحص" } });
    await tx.warehouse.create({ data: { id: "w-chk", code: "CHK", name: "فحص", branchId: "b-chk" } });
    await tx.category.create({ data: { id: "c-chk", name: "فحص" } });
    await tx.product.create({ data: { id: "p-chk", sku: "CHK", name: "فحص", family: "فحص", categoryId: "c-chk", salePrice: 1, costPrice: 1, rentDaily: 1, rentWeekly: 1, rentMonthly: 1 } });
    await tx.stockBalance.create({ data: { productId: "p-chk", warehouseId: "w-chk", available: -1 } });
  });
} catch (e) {
  rejected = /stock_non_negative/.test(String(e));
}
const left = await prisma.branch.count({ where: { id: "b-chk" } });
console.log("negative stock rejected:", rejected, "| transaction rolled back:", left === 0);
await prisma.$disconnect();
process.exitCode = rejected && left === 0 ? 0 : 1;

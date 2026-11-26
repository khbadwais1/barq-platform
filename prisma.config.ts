// إعداد Prisma 7: عنوان قاعدة البيانات للترحيلات يُقرأ من البيئة (لا يُكتب في المخطط)
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") },
});

// تشغيل PostgreSQL محلي للتطوير بدون Docker. الاستخدام: npm run db:start
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const dataDir = path.resolve(".pgdata");
const fresh = !existsSync(path.join(dataDir, "PG_VERSION"));
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "barq",
  password: "barq_dev_password",
  port: 5433,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--no-locale"],
  onLog: () => {},
});

if (fresh) await pg.initialise();
await pg.start();
for (const db of ["barq", "barq_test"]) {
  try {
    await pg.createDatabase(db);
    console.log(`created database ${db}`);
  } catch {
    /* موجودة */
  }
}
console.log("PostgreSQL running on port 5433 (Ctrl+C to stop)");
const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);

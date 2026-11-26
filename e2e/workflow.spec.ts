// المسار الأهم في المواصفات، في متصفح حقيقي:
// البائع يسجل بيعًا ← الفاتورة تظهر للمالية ← المالية تحصّل ← الحساب والعميل واللوحات والمخزون تتحدث
// قواعد الأعمال: BR-001 BR-003 BR-004 BR-005 BR-008 BR-020
import { test, expect, type Page } from "@playwright/test";

async function loginAs(page: Page, username: string) {
  await page.goto("/#/login");
  await page.evaluate(() => localStorage.removeItem("barq-demo-session"));
  await page.reload();
  await page.locator(`[data-act="demoLogin"][data-u="${username}"]`).click();
  await expect(page.locator(".user-chip")).toBeVisible();
}
const appState = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("barq-demo-state-v6") || "{}"));

test("كل دور يدخل إلى لوحته، والرابط الممنوع يُرفض (403)", async ({ page }) => {
  const homes: Record<string, string> = { sulaiman: "/owner/dashboard", finance: "/finance/dashboard", seller1: "/seller/dashboard", yard: "/rentals" };
  for (const [u, home] of Object.entries(homes)) {
    await loginAs(page, u);
    await expect(page).toHaveURL(new RegExp(`#${home}$`));
  }
  await loginAs(page, "seller1");
  await page.goto("/#/owner/dashboard");
  await expect(page.getByText("403 — غير مصرح")).toBeVisible();
  await page.goto("/#/accounts");
  await expect(page.getByText("403 — غير مصرح")).toBeVisible();
});

test("الدخول بكتابة اسم المستخدم وكلمة المرور وزر «دخول»", async ({ page }) => {
  await page.goto("/#/login");
  await page.locator("#lu").fill("seller2");
  await page.locator("#lp").fill("2026");
  await page.getByRole("button", { name: "دخول", exact: true }).click();
  await expect(page).toHaveURL(/#\/seller\/dashboard$/);
});

test("كلمة مرور خاطئة تُرفض وتُسجّل", async ({ page }) => {
  await page.goto("/#/login");
  await page.locator("#lu").fill("finance");
  await page.locator("#lp").fill("خطأ");
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByText("اسم المستخدم أو كلمة المرور غير صحيحة")).toBeVisible();
});

test("بيع آجل 3 × 100 = 345 ثم تحصيل 100 نقدًا و245 بنك من نافذة أخرى", async ({ page, context }) => {
  // ── البائع: بيع جديد ──
  await loginAs(page, "seller1");
  await page.goto("/#/sales/new");
  await page.locator("#pos-cq").fill("٠٥٠١٢٣٤٥٦٧"); // أرقام عربية
  await page.locator('[data-act="posPickCustomer"]').first().click();
  const project = page.locator('select[data-act-change="posProject"]');
  const projectValue = await project.locator("option", { hasText: "المستودع" }).first().getAttribute("value");
  await project.selectOption(projectValue!);
  const frame = page.locator('.size[title^="إطار سقالة"]');
  for (let i = 0; i < 3; i++) await frame.click();
  const summary = page.locator(".pos-summary.desk");
  await expect(summary.locator(".sum-row.total")).toContainText("345.00");

  // نافذة المالية مفتوحة قبل الحفظ (جلسة أخرى في نفس المتصفح)
  const finance = await context.newPage();
  await finance.goto("/#/finance/dashboard");

  // ضغط مزدوج على التأكيد ⇐ بيع واحد فقط
  await summary.locator('[data-act="posConfirm"]').dblclick();
  await expect(page).toHaveURL(/#\/sales\/sale-/);
  await expect(page.getByText("تم تسجيل البيع بنجاح")).toBeVisible();
  const state1 = await appState(page);
  const frameId = state1.products.find((p: { testTag?: string }) => p.testTag === "TEST_FRAME").id;
  expect(state1.sales.filter((s: { lines: { pid: string }[] }) => s.lines.some((l) => l.pid === frameId))).toHaveLength(1);
  const available = state1.movements.filter((m: { pid: string; wh: string }) => m.pid === frameId && m.wh === "w1").reduce((a: number, m: { from: string | null; to: string | null; qty: number }) => a + (m.to === "AVAILABLE" ? m.qty : 0) - (m.from === "AVAILABLE" ? m.qty : 0), 0);
  expect(available).toBe(17);
  const invoiceHref = await page.locator('a[href^="#/invoices/"]').first().getAttribute("href");

  // ── المالية (النافذة الأخرى): تسجيل الدخول والفاتورة الجديدة ظاهرة ──
  await finance.evaluate(() => localStorage.removeItem("barq-demo-session"));
  await loginAs(finance, "finance");
  await finance.goto("/" + invoiceHref);
  await expect(finance.locator(".kpi").first()).toContainText("345.00");
  const cashBefore = await finance.evaluate(() => (globalThis as unknown as { accountBalance: (id: string) => number }).accountBalance("a-cash"));

  // دفعة 100 نقدًا باسم المندوب
  await finance.locator('.page-head [data-act="pay"]').click();
  const invId = invoiceHref!.split("/").pop();
  await finance.locator(`#pfa-${invId}`).fill("100");
  await finance.locator('select[data-act-change="pfRep"]').selectOption("r3");
  await finance.locator('[data-act="pfSave"]').click();
  await expect(finance.getByText(/تم تسجيل التحصيل/)).toBeVisible();
  await expect(finance.locator(".page-head .badge")).toContainText("مدفوعة جزئيًا");

  // دفعة 245 تحويل إلى الراجحي
  await finance.locator('.page-head [data-act="pay"]').click();
  await finance.locator('select[data-act-change="pfMethod"]').selectOption("TRANSFER");
  await finance.locator('select[data-act-change="pfAcc"]').selectOption("a-rajhi");
  await finance.locator("#pf-ref").fill("TRX-E2E");
  await finance.locator(`#pfa-${invId}`).fill("245");
  await finance.locator('[data-act="pfSave"]').click();
  await expect(finance.locator(".page-head .badge")).toContainText("مدفوعة");
  const cashAfter = await finance.evaluate(() => (globalThis as unknown as { accountBalance: (id: string) => number }).accountBalance("a-cash"));
  expect(cashAfter - cashBefore).toBe(10000); // +100.00 ر.س بالهللة

  // سند القبض يُعثر عليه باسم المندوب
  await finance.goto("/#/payments");
  await finance.locator("#tq-payments").fill("المندوب 3");
  await expect(finance.locator(".tbl tbody").first()).toContainText("المندوب 3");

  // ── المالك يرى البيع في لوحته ──
  await finance.evaluate(() => localStorage.removeItem("barq-demo-session"));
  await loginAs(finance, "sulaiman");
  await expect(finance.getByText("لوحة سليمان الجربوع")).toBeVisible();
});

test("تنزيل PDF يُنشئ ملف PDF حقيقيًا", async ({ page }) => {
  await loginAs(page, "finance");
  await page.goto("/#/vouchers");
  await page.locator(".tbl tbody tr.click").first().click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator('[data-act="pdf"]').click()]);
  expect(download.suggestedFilename()).toMatch(/^PV-\d{4}-\d{5}\.pdf$/);
  const path = await download.path();
  const fs = await import("node:fs");
  const buf = fs.readFileSync(path!);
  expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(buf.length).toBeGreaterThan(50_000);
});

test("اختبارات القبول داخل الديمو: كلها ناجحة", async ({ page }) => {
  await loginAs(page, "sulaiman");
  await page.goto("/#/acceptance");
  await page.locator('[data-act="runAccept"]').click();
  await expect(page.locator(".alert.ok")).toContainText(/(\d+) من \1 اختبار ناجح/, { timeout: 30_000 });
});

test("شاشة البيع على الجوال 390 بكسل بلا تمرير أفقي", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await loginAs(page, "seller1");
  for (const path of ["/#/seller/dashboard", "/#/customers", "/#/sales/new"]) {
    await page.goto(path);
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
  await expect(page.locator(".mobile-bar")).toBeVisible();
  await ctx.close();
});

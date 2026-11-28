// أدوات الموظف (CR-004) في متصفح حقيقي — قواعد الأعمال: BR-044 BR-015
import { test, expect, type Page } from "@playwright/test";

async function loginAs(page: Page, username: string) {
  await page.goto("/#/login");
  await page.evaluate(() => localStorage.removeItem("barq-demo-session"));
  await page.reload();
  await page.locator(`[data-act="demoLogin"][data-u="${username}"]`).click();
  await expect(page.locator(".user-chip")).toBeVisible();
}

test("الحاسبة وحاسبة الإيجار من زر الأدوات واختصار K", async ({ page }) => {
  await loginAs(page, "seller1");
  await page.keyboard.press("k");
  await expect(page.locator(".tools-panel")).toBeVisible();
  await page.locator("#tl-expr").fill("3×100+15%");
  await expect(page.locator(".calc-out")).toContainText("345.00");

  await page.locator('[data-act="tlTab"][data-k="rent"]').click();
  await page.locator("#tl-rq").fill("125");
  await page.locator("#tl-rm").fill("9");
  await page.locator("#tl-rd").fill("119");
  await expect(page.locator(".quote")).toContainText("4,462.50");
  await expect(page.locator(".quote")).toContainText("5,131.88");
  await page.locator("#tl-wa").fill("0501234567");
  const wa = page.locator(".tools-panel a.wa");
  await expect(wa).toHaveAttribute("href", /^https:\/\/wa\.me\/966501234567\?text=/);

  await page.keyboard.press("Escape");
  await expect(page.locator(".tools-panel")).toHaveCount(0);
});

test("الملاحظات والتذكيرات تبقى بعد إعادة التحميل وتظهر في التنبيهات", async ({ page }) => {
  await loginAs(page, "finance");
  await page.locator('[data-act="toggleTools"]').first().click();
  await page.locator('[data-act="tlTab"][data-k="notes"]').click();
  await page.locator("#tl-notes").fill("متابعة شيكات الأسبوع القادم");
  await page.locator('[data-act="tlTab"][data-k="todo"]').click();
  await page.locator("#tl-rmtext").fill("اتصل بمؤسسة الأفق بخصوص الدفعة");
  await page.locator('[data-act="rmAdd"]').click();
  await expect(page.getByText("تمت إضافة التذكير")).toBeVisible();
  await page.waitForTimeout(400);
  await page.reload();
  await page.locator('[data-act="toggleTools"]').first().click();
  await page.locator('[data-act="tlTab"][data-k="notes"]').click();
  await expect(page.locator("#tl-notes")).toHaveValue("متابعة شيكات الأسبوع القادم");
  await page.locator('[data-act="tlTab"][data-k="todo"]').click();
  await expect(page.locator(".todo").first()).toContainText("اتصل بمؤسسة الأفق");
});

test("المفضلة والملاحظة المثبتة وواتساب الفاتورة والوضع الليلي واختصار N", async ({ page }) => {
  await loginAs(page, "sulaiman");
  await page.goto("/#/customers");
  const firstName = await page.locator(".tbl tbody tr").nth(5).locator("td").nth(2).innerText();
  await page.locator(".tbl tbody tr").nth(5).locator('[data-act="fav"]').click();
  await expect(page.locator(".tbl tbody tr").first()).toContainText(firstName.trim());

  // ملاحظة مثبتة على العميل
  await page.locator(".tbl tbody tr").first().locator("a.link").click();
  await page.locator('.page-head [data-act="pinNote"]').click();
  await page.locator("#pn-text").fill("لا يُسلَّم إلا بحضور المهندس");
  await page.locator('[data-act="pnSave2"]').click();
  await expect(page.locator(".alert.pinned")).toContainText("لا يُسلَّم إلا بحضور المهندس");

  // واتساب من الفاتورة
  await page.goto("/#/invoices");
  await page.locator(".tbl tbody tr.click").first().click();
  await expect(page.locator(".page-head a.wa")).toHaveAttribute("href", /^https:\/\/wa\.me\/9665\d{8}\?text=.*INV-/);

  // الوضع الليلي يبقى بعد إعادة التحميل
  await page.locator(".user-chip").click();
  await page.locator('[data-act="toggleTheme"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  // اختصار N لبيع جديد (المالك يملك البيع)
  await page.locator("body").click({ position: { x: 5, y: 300 } });
  await page.keyboard.press("n");
  await expect(page).toHaveURL(/#\/sales\/new$/);
});

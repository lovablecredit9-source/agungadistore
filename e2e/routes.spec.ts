import { test, expect } from "../playwright-fixture";

// Smoke regression: setiap halaman utama harus tampil tanpa error JS dan tanpa geser horizontal.
const ROUTES = [
  "/", "/musik", "/produk", "/voucher", "/saldo", "/history", "/tiket", "/pusat-bantuan", "/streak",
  "/streak-shop", "/streak-membership", "/game", "/plus", "/fire-pass", "/seller", "/confess", "/anon-chat",
  "/spotlight", "/luck-royale-nyawa", "/diamond-royale", "/lucky-royale", "/admin/login",
];

for (const route of ROUTES) {
  test(`halaman ${route} tampil tanpa error`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).not.toHaveText(/^\s*$/, { timeout: 15000 });
    await page.waitForTimeout(1500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(2);
    expect(errors).toEqual([]);
  });
}

test("dashboard admin tidak terbuka tanpa login admin", async ({ page }) => {
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/admin\/login/, { timeout: 15000 });
});

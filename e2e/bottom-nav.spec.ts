import { test, expect } from "../playwright-fixture";

const LABELS = ["Home", "Shop", "Saldo", "Reward", "Musik", "Menu lainnya"];

for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 412, height: 915 }]) {
  test(`navigasi bawah HP ${size.width}px: tepat 6 item dan Musik berfungsi`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.setViewportSize(size);
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const nav = page.getByRole("navigation", { name: "Navigasi bawah" });
    await expect(nav).toBeVisible({ timeout: 15000 });
    await expect(nav.getByRole("button")).toHaveCount(6);
    for (const l of LABELS) await expect(nav.getByRole("button", { name: l, exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Navigasi bawah" })).toHaveCount(1);

    await nav.getByRole("button", { name: "Musik", exact: true }).click();
    await expect(page).toHaveURL(/\/musik/);
    await expect(nav.getByRole("button", { name: "Musik", exact: true })).toHaveAttribute("aria-current", "page");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/musik/);
    const navAfter = page.getByRole("navigation", { name: "Navigasi bawah" });
    await expect(navAfter.getByRole("button", { name: "Musik", exact: true })).toHaveAttribute("aria-current", "page", { timeout: 15000 });

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(2);
    expect(errors).toEqual([]);
  });
}

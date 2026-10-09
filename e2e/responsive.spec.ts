import { test, expect } from "../playwright-fixture";

const SIZES = [
  { width: 360, height: 800, desktop: false },
  { width: 390, height: 844, desktop: false },
  { width: 412, height: 915, desktop: false },
  { width: 768, height: 1024, desktop: false },
  { width: 1024, height: 768, desktop: true },
  { width: 1280, height: 800, desktop: true },
  { width: 1440, height: 900, desktop: true },
  { width: 1536, height: 864, desktop: true },
];

for (const s of SIZES) {
  test(`layout ${s.width}x${s.height}: ${s.desktop ? "sidebar, tanpa navigasi bawah" : "navigasi bawah, tanpa sidebar"}, tanpa geser samping`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.setViewportSize({ width: s.width, height: s.height });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Oke, Mengerti ✓" }).click({ timeout: 8000 }).catch(() => {});

    const bottom = page.getByRole("navigation", { name: "Navigasi bawah" });
    const side = page.getByRole("complementary", { name: "Navigasi samping" });
    if (s.desktop) {
      await expect(side).toBeVisible({ timeout: 15000 });
      await expect(bottom).toBeHidden();
      await expect(page.getByRole("button", { name: "Buka menu navigasi" })).toBeHidden();
    } else {
      await expect(bottom).toBeVisible({ timeout: 15000 });
      await expect(side).toBeHidden();
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}

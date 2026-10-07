import { test, expect } from "../playwright-fixture";

const LABELS = ["Home", "Shop", "Streak", "Saldo", "Musik", "Live Chat", "Menu lainnya"];
const SECTIONS: [string, RegExp][] = [["Streak", /\/streak/], ["Saldo", /\/saldo/], ["Musik", /\/musik/], ["Live Chat", /\/tiket/]];

for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 412, height: 915 }]) {
  test(`navigasi bawah HP ${size.width}px: tepat 7 item, Streak/Musik/Live Chat berfungsi`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.setViewportSize(size);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // Popup sambutan menyembunyikan isi halaman dari pembaca layar sampai ditutup.
    await page.getByRole("button", { name: "Oke, Mengerti ✓" }).click({ timeout: 8000 }).catch(() => {});

    const nav = page.getByRole("navigation", { name: "Navigasi bawah" });
    await expect(nav).toBeVisible({ timeout: 15000 });
    await expect(nav.getByRole("button")).toHaveCount(7);
    for (const l of LABELS) await expect(nav.getByRole("button", { name: l, exact: true })).toBeVisible();
    // Urutan wajib: Home | Shop | Streak | Saldo | Musik | Live Chat | Lainnya
    expect(await nav.getByRole("button").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))).toEqual(LABELS);
    await expect(nav.getByRole("button", { name: "Reward", exact: true })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Navigasi bawah" })).toHaveCount(1);

    for (const [label, url] of SECTIONS) {
      await nav.getByRole("button", { name: label, exact: true }).click();
      await expect(page).toHaveURL(url);
      await expect(nav.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
    }
    await nav.getByRole("button", { name: "Musik", exact: true }).click();
    await expect(page).toHaveURL(/\/musik/);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/musik/);
    const navAfter = page.getByRole("navigation", { name: "Navigasi bawah" });
    await expect(navAfter.getByRole("button", { name: "Musik", exact: true })).toHaveAttribute("aria-current", "page", { timeout: 15000 });

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(2);
    expect(errors).toEqual([]);
  });
}

import { expect, test } from "@playwright/test";
import { hermetic } from "./helpers";

const EVENT = { name: "Solana Breakpoint", dates: "15–17 Nov", place: "London", start: "2026-11-15" };

test("6 · no event configured: strip shows only slots and free remakes", async ({ page }) => {
  await hermetic(page);
  await page.goto("/");
  await expect(page.locator("#strip [data-strip]")).toHaveText("◆ 4 Desk slots open this month · 3 free remakes a day");
});

test("6 · strip shows the countdown before event.start", async ({ page }) => {
  await hermetic(page);
  await page.addInitScript((event) => (window.__CF_OVERRIDES__ = { event }), EVENT);
  await page.clock.setFixedTime(new Date("2026-10-22T12:00:00Z"));
  await page.goto("/");
  const strip = page.locator("#strip [data-strip]");
  await expect(strip).toBeVisible();
  await expect(strip).toHaveText("◆ Solana Breakpoint · 15–17 Nov · London — launch-week slots: 4 left · 23d 12h to go");
});

test("6 · strip shows the slots-only message after event.start", async ({ page }) => {
  await hermetic(page);
  await page.addInitScript((event) => (window.__CF_OVERRIDES__ = { event }), EVENT);
  await page.clock.setFixedTime(new Date("2026-11-20T09:00:00Z"));
  await page.goto("/");
  await expect(page.locator("#strip [data-strip]")).toHaveText("◆ 4 Desk slots open this month · 3 free remakes a day");
});

test("6 · strip is hidden when deskSlotsLeft = 0", async ({ page }) => {
  await hermetic(page);
  await page.addInitScript(() => (window.__CF_OVERRIDES__ = { deskSlotsLeft: 0 }));
  await page.goto("/");
  await expect(page.locator("#strip")).toBeHidden();
});

test("6 · founding block is hidden when foundingSlotsLeft = 0, and reflects the count otherwise", async ({ page }) => {
  await hermetic(page);
  await page.goto("/");
  await expect(page.locator("[data-founding]")).toHaveCount(1);
  await expect(page.locator("#founding-title")).toHaveText("5 of 5 founding Desks left: $990/month for 3 months.");
  await expect(page.locator(".pip")).toHaveCount(5);
  await expect(page.locator(".pip.is-taken")).toHaveCount(0);

  await page.addInitScript(() => (window.__CF_OVERRIDES__ = { foundingSlotsLeft: 1 }));
  await page.reload();
  await expect(page.locator("#founding-title")).toHaveText("1 of 5 founding Desks left: $990/month for 3 months.");
  await expect(page.locator(".pip.is-taken")).toHaveCount(4);

  await page.addInitScript(() => (window.__CF_OVERRIDES__ = { foundingSlotsLeft: 0 }));
  await page.reload();
  await expect(page.locator("[data-founding]")).toHaveCount(0);
});

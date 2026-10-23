import { expect, test } from "@playwright/test";
import { hermetic, isMobile, scrollToDepth } from "./helpers";

test("5 · sticky bar: hidden over the hero, shown mid-page, hidden over #book", async ({ page }, info) => {
  test.skip(!isMobile(info), "sticky bar is <768px only");
  await hermetic(page);
  await page.goto("/");
  const bar = page.locator("[data-sticky]");
  await expect(bar).toHaveAttribute("data-visible", "false");
  await expect(bar).toBeHidden();
  await page.locator("#compare").scrollIntoViewIfNeeded();
  await expect(bar).toHaveAttribute("data-visible", "true");
  await expect(bar).toBeVisible();
  const box = await bar.boundingBox();
  expect(Math.round(box!.height)).toBe(64);
  await page.evaluate(() => document.getElementById("book")!.scrollIntoView({ block: "center" }));
  await expect(bar).toHaveAttribute("data-visible", "false");
});

test("5 · nudge appears once after 60% scroll and never again after dismissal", async ({ page }) => {
  await hermetic(page);
  await page.goto("/");
  const nudge = page.locator("[data-nudge]");
  await scrollToDepth(page, 0.3);
  await page.waitForTimeout(400);
  await expect(nudge).toHaveCount(0);
  await scrollToDepth(page, 0.62);
  await expect(nudge).toBeVisible();
  await expect(nudge).toContainText("Want your last announcement animated, free?");
  await expect(page.locator("[data-nudge-region]")).toHaveAttribute("aria-live", "polite");
  // Focus is never stolen
  expect(await page.evaluate(() => document.activeElement === document.body || document.activeElement === null)).toBe(true);
  await nudge.getByRole("button", { name: "No thanks" }).click();
  await expect(nudge).toHaveCount(0);
  await scrollToDepth(page, 0.7);
  await page.waitForTimeout(500);
  await expect(nudge).toHaveCount(0);

  await page.reload();
  await scrollToDepth(page, 0.65);
  await page.waitForTimeout(800);
  await expect(nudge).toHaveCount(0);
  const events = await page.evaluate(() => (window.cfEvents ?? []).map((e) => e.name));
  expect(events).not.toContain("nudge_shown");
});

test("5 · nudge never shows after a CTA click in the session", async ({ page }) => {
  await hermetic(page);
  await page.goto("/");
  await page.locator(".hero__ctas .btn--primary").click();
  await scrollToDepth(page, 0.65);
  await page.waitForTimeout(800);
  await expect(page.locator("[data-nudge]")).toHaveCount(0);
});

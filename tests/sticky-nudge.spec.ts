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

test("5 · no pop-up: the free-remake offer lives in the top strip instead", async ({ page }) => {
  await hermetic(page);
  await page.goto("/");
  await scrollToDepth(page, 0.65);
  await page.waitForTimeout(1200);
  await expect(page.locator(".nudge, [data-nudge], [data-nudge-region]")).toHaveCount(0);
  await expect(page.locator("#strip [data-strip-cta]")).toHaveCount(1);
});

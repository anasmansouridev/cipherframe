import { expect, test } from "@playwright/test";
import { hermetic, scrollThrough } from "./helpers";

test.use({ contextOptions: { reducedMotion: "reduce" } });

test("7 · reduced motion: Tier C, nothing animating, no canvas, static timeline list", async ({ page }) => {
  await hermetic(page);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-tier", "C");
  await scrollThrough(page);
  await page.waitForTimeout(1500);
  const running = await page.evaluate(() =>
    document.getAnimations().filter((a) => a.playState === "running").map((a) => (a as CSSAnimation).animationName ?? a.constructor.name),
  );
  expect(running).toEqual([]);
  expect(await page.locator(".txfield canvas, [data-book-field] canvas, canvas").count()).toBe(0);
  const timeline = page.locator("[data-timeline]");
  await expect(timeline).toHaveAttribute("data-mode", "list");
  await expect(page.locator(".tl__stage")).toBeHidden();
  const steps = page.locator(".tl__step");
  await expect(steps).toHaveCount(5);
  for (let i = 0; i < 5; i++) await expect(steps.nth(i)).toBeVisible();
  expect(await page.locator("[data-tl-steps]").evaluate((el) => getComputedStyle(el).display)).toBe("grid");
  const events = await page.evaluate(() => (window.cfEvents ?? []).filter((e) => e.name === "tier_selected").map((e) => e.props.tier));
  expect(events).toEqual(["C"]);
});

import { expect, test } from "@playwright/test";
import { hermetic } from "./helpers";

test("concepts · when the browser blocks play(), the poster shows a play button and nothing is logged", async ({ page }) => {
  const errors = await hermetic(page);
  await page.addInitScript(() => {
    (window as unknown as { __CF_FORCE_TIER__: string }).__CF_FORCE_TIER__ = "B";
    HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException("play() blocked", "NotAllowedError"));
  });
  await page.goto("/");
  await page.waitForTimeout(1200);
  // Only a card that is on screen ever tries to play, so visit each one.
  for (let i = 0; i < 3; i++) {
    await page.evaluate((i) => document.querySelectorAll(".cv__media")[i].scrollIntoView({ block: "center", behavior: "instant" }), i);
    await expect(page.locator(".cv.is-manual").nth(0)).toBeVisible();
    await expect.poll(() => page.locator(".cv").nth(i).evaluate((c) => c.classList.contains("is-manual")), { timeout: 10_000 }).toBe(true);
  }
  await expect(page.locator(".cv.is-manual")).toHaveCount(3);
  await expect(page.locator(".cv__play").first()).toBeVisible();
  expect(await page.locator(".cv__play").first().evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  await expect(page.locator("[data-cv-sound]").first()).toBeHidden();
  await expect(page.locator("[data-cv-open]").first()).toHaveAccessibleName(/^Play video: /);
  expect(await page.locator(".cv__video").first().getAttribute("poster")).toMatch(/work-01-pinned\.jpg$/);
  expect(errors, "no console errors or uncaught rejections").toEqual([]);
});

import { expect, test } from "@playwright/test";
import { hermetic } from "./helpers";

test.use({ contextOptions: { reducedMotion: "reduce" } });

test("work (d) · reduced motion: no film autoplays or loads; the poster shows a play button; play works on tap", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (r) => /\/work\/[^/]+\.(mp4|webm)/.test(r.url()) && requested.push(r.url()));
  await hermetic(page);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-tier", "C");
  await page.evaluate(() => {
    const r = document.querySelector(".wv")!.getBoundingClientRect();
    scrollTo({ top: r.top + scrollY - 70, behavior: "instant" });
  });
  await page.waitForTimeout(2500);
  const states = () => page.evaluate(() => Array.from(document.querySelectorAll<HTMLVideoElement>(".wv video")).map((v) => ({ paused: v.paused, muted: v.muted })));
  expect((await states()).every((s) => s.paused)).toBe(true);
  expect(requested).toEqual([]);
  await expect(page.locator(".wv__play").first()).toBeVisible();
  expect(await page.locator(".wv__play").first().evaluate((el) => getComputedStyle(el).opacity)).toBe("1");

  await page.locator("[data-wv-toggle]").first().click();
  await expect.poll(async () => (await states())[0].paused).toBe(false);
  expect((await states())[0].muted).toBe(true); // still silent until the speaker button is used
  expect((await states()).slice(1).every((s) => s.paused)).toBe(true);
  expect(requested.length).toBeGreaterThan(0);
});

import { expect, test } from "@playwright/test";
import { hermetic } from "./helpers";

test.use({ contextOptions: { reducedMotion: "reduce" } });

test("concepts · reduced motion: nothing autoplays or downloads, each poster shows a play button, play opens the lightbox", async ({ page }) => {
  const films: string[] = [];
  const posters: string[] = [];
  page.on("request", (r) => {
    if (/\/work\/work-0\d-[a-z-]+\.(mp4|webm)/.test(r.url())) films.push(r.url());
    if (/\/work\/work-0\d-[a-z-]+\.jpg/.test(r.url())) posters.push(r.url());
  });
  const errors = await hermetic(page);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-tier", "C");
  await page.evaluate(() => document.querySelector(".concepts")!.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.waitForTimeout(2500);

  const state = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".cv")).map((c) => {
      const v = c.querySelector("video")!;
      return { paused: v.paused, ready: v.readyState, poster: v.getAttribute("poster"), manual: c.classList.contains("is-manual"), playOpacity: getComputedStyle(c.querySelector(".cv__play")!).opacity };
    }),
  );
  expect(state.every((s) => s.paused && s.ready === 0)).toBe(true);
  expect(state.every((s) => s.manual && s.playOpacity === "1")).toBe(true);
  expect(state.every((s) => /\/work\/work-0\d-[a-z-]+\.jpg$/.test(s.poster ?? ""))).toBe(true);
  expect(films, "no film bytes").toEqual([]);
  expect(posters.length, "posters only, and only for the cards that are near").toBeGreaterThan(0);
  await expect(page.locator(".cv__play").first()).toBeVisible();
  await expect(page.locator("[data-cv-sound]").first()).toBeHidden();
  await expect(page.locator("[data-cv-open]").first()).toHaveAccessibleName(/^Play video: /);

  await page.locator("[data-cv-open]").first().click();
  const dialog = page.locator("dialog.video-dialog");
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(800);
  expect(await dialog.locator("video").evaluate((v: HTMLVideoElement) => v.paused), "no autoplay in the lightbox either").toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-cv-open]").first()).toBeFocused();
  expect(errors).toEqual([]);
});

import { expect, test } from "@playwright/test";
import { hermetic, isMobile } from "./helpers";

test.use({ contextOptions: { reducedMotion: "reduce" } });

test("showcase · reduced motion: the film never loads or plays, the poster shows, the slider still works", async ({ page }, info) => {
  const requested: string[] = [];
  page.on("request", (r) => /\/showcase\/honeyb\/honeyb_after\.(mp4|webm)/.test(r.url()) && requested.push(r.url()));
  await hermetic(page);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-tier", "C");
  await page.evaluate(() => document.querySelector("[data-ba-video]")!.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.waitForTimeout(2500);

  const film = await page.evaluate(() => {
    const v = document.querySelector<HTMLVideoElement>("[data-ba-video]")!;
    return { paused: v.paused, ready: v.readyState, poster: v.getAttribute("poster") };
  });
  expect(film.paused).toBe(true);
  expect(film.ready).toBe(0);
  expect(film.poster).toBe("/showcase/honeyb/honeyb_after_poster.jpg");
  expect(requested).toEqual([]);
  await expect(page.locator("[data-ba-sound]")).toBeHidden(); // nothing plays, so no sound control

  if (isMobile(info)) {
    await page.getByRole("button", { name: "Motion", exact: true }).click();
    await expect(page.locator("[data-ba]")).toHaveAttribute("data-state", "motion");
    await page.waitForTimeout(800);
    expect((await page.evaluate(() => document.querySelector<HTMLVideoElement>("[data-ba-video]")!.paused))).toBe(true);
  } else {
    const handle = page.getByRole("slider", { name: "Compare static and motion" });
    await handle.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(handle).toHaveAttribute("aria-valuenow", "45");
  }
});

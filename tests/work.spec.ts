import { expect, test, type Page } from "@playwright/test";
import { CONFIG } from "../src/config.ts";
import { WORK_TAG_PERMISSION, WORK_TAG_UNOFFICIAL, workTag } from "../src/work.ts";
import { hermetic, viewportOf } from "./helpers";

const SLUGS = CONFIG.work.map((w) => w.slug);
const isVideoUrl = (u: string) => /\/work\/[^/]+\.(mp4|webm)(\?|$)/.test(u);

/** Pin the tier: under heavy parallel load the FPS probe may drop the page to Tier C (tap-only), which is correct but not what these tests exercise. */
const pinTierB = (page: Page) => page.addInitScript(() => ((window as unknown as { __CF_FORCE_TIER__: string }).__CF_FORCE_TIER__ = "B"));

/** Jump (no smooth scroll) so that the first film card sits near the top and is well over 50% visible. */
async function toFirstCard(page: Page): Promise<void> {
  await page.evaluate(() => {
    const r = document.querySelector(".wv")!.getBoundingClientRect();
    scrollTo({ top: r.top + scrollY - 70, behavior: "instant" });
  });
}
const states = (page: Page) =>
  page.evaluate(() => Array.from(document.querySelectorAll<HTMLVideoElement>(".wv video")).map((v) => ({ paused: v.paused, muted: v.muted, ready: v.readyState })));
const playingCount = async (page: Page) => (await states(page)).filter((s) => !s.paused).length;

test("work (a) · no video starts a network request on page load", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (r) => isVideoUrl(r.url()) && requested.push(r.url()));
  await hermetic(page);
  await page.goto("/");
  await page.waitForTimeout(3000);
  expect(requested).toEqual([]);
  expect((await states(page)).every((s) => s.paused && s.ready === 0)).toBe(true);
  await expect(page.locator(".wv")).toHaveCount(SLUGS.length);
});

test("work (b) · scrolling to the films autoplays the first visible one, muted, and only one plays", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (r) => isVideoUrl(r.url()) && requested.push(r.url().split("/").pop()!));
  await hermetic(page);
  await pinTierB(page);
  await page.goto("/");
  await page.waitForTimeout(1200);
  await toFirstCard(page);
  await expect.poll(() => playingCount(page), { timeout: 10_000 }).toBe(1);
  const s = await states(page);
  expect(s[0].paused).toBe(false);
  expect(s[0].muted).toBe(true);
  expect(s.slice(1).every((x) => x.paused)).toBe(true);
  expect(requested.some((u) => u.startsWith(SLUGS[0]))).toBe(true);
  expect(requested.filter((u) => !u.startsWith(SLUGS[0]))).toEqual([]); // the others stay unloaded
  await expect
    .poll(() => page.evaluate(() => (window.cfEvents ?? []).filter((e) => e.name === "work_video_play").map((e) => e.props.slug)))
    .toEqual([SLUGS[0]]);
});

test("work (b2) · tapping the film pauses and resumes it", async ({ page }) => {
  await hermetic(page);
  await pinTierB(page);
  await page.goto("/");
  await page.waitForTimeout(1200);
  await toFirstCard(page);
  await expect.poll(() => playingCount(page), { timeout: 10_000 }).toBe(1);
  const toggle = page.locator("[data-wv-toggle]").first();
  await expect(toggle).toHaveAccessibleName(/^Pause video/);
  await toggle.click();
  await expect.poll(async () => (await states(page))[0].paused).toBe(true);
  await expect(toggle).toHaveAccessibleName(/^Play video/);
  await toggle.click();
  await expect.poll(async () => (await states(page))[0].paused).toBe(false);
});

test("work (c) · the sound button unmutes only that film", async ({ page }) => {
  await hermetic(page);
  await pinTierB(page);
  await page.goto("/");
  await page.waitForTimeout(1200);
  await toFirstCard(page);
  await expect.poll(() => playingCount(page), { timeout: 10_000 }).toBe(1);

  const sound = page.locator("[data-wv-sound]");
  await expect(sound.first()).toHaveAccessibleName("Turn sound on");
  const box = (await sound.first().boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);

  await sound.first().click();
  await expect(sound.first()).toHaveAccessibleName("Turn sound off");
  let s = await states(page);
  expect(s.map((x) => x.muted)).toEqual([false, true, true]);
  expect(s[0].paused).toBe(false);

  // Another film's speaker: that one gets sound and plays; the first goes back to muted and stops.
  await sound.nth(1).click();
  await expect.poll(async () => (await states(page)).map((x) => x.muted)).toEqual([true, false, true]);
  s = await states(page);
  expect(s[1].paused).toBe(false);
  await expect.poll(async () => (await states(page))[0].paused).toBe(true);
  await expect(sound.first()).toHaveAccessibleName("Turn sound on");

  const events = await page.evaluate(() => (window.cfEvents ?? []).filter((e) => e.name === "work_video_sound_on").map((e) => e.props.slug));
  expect(events).toEqual([SLUGS[0], SLUGS[1]]);
});

test("work · 'View on X' opens the right account in a new tab and is tracked", async ({ page }) => {
  await hermetic(page);
  await page.goto("/");
  for (const w of CONFIG.work) {
    const link = page.locator(`[data-work-x="${w.slug}"]`);
    await expect(link).toHaveAttribute("href", w.xUrl);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
    await expect(link).toContainText("View on X");
  }
  await page.locator(`[data-work-x="${SLUGS[2]}"]`).click();
  const events = await page.evaluate(() => (window.cfEvents ?? []).filter((e) => e.name === "work_x_click").map((e) => e.props.slug));
  expect(events).toEqual([SLUGS[2]]);
});

test("work (e) · each card shows the tag for its permission value, and never the word client", async ({ page }) => {
  await hermetic(page);
  await page.goto("/");
  for (const w of CONFIG.work) {
    const tag = page.locator(`[data-slug="${w.slug}"] .tag`);
    await expect(tag).toHaveText(workTag(w.permission).text);
    await expect(tag).toHaveText(w.permission ? WORK_TAG_PERMISSION : WORK_TAG_UNOFFICIAL);
    if (!w.permission) {
      await expect(tag).toHaveClass(/tag--dashed/);
      expect(await tag.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe("dashed");
    }
  }
  expect(await page.locator("#work").innerText()).not.toMatch(/client/i);
  await expect(page.locator("#work .eyebrow").first()).toHaveText("RECENT WORK");
  await expect(page.locator(".concepts__title")).toHaveText("Studio concepts");
  await expect(page.locator(".concepts .work")).toHaveCount(3);
});

test("work (f) · no horizontal scroll at 360px, and the concept cards stack in one column", async ({ page }, info) => {
  test.skip(viewportOf(info).width !== 360, "360px only");
  await hermetic(page);
  await page.goto("/");
  await page.waitForTimeout(800);
  await toFirstCard(page);
  await page.waitForTimeout(600);
  await page.evaluate(() => document.querySelector(".concepts")!.scrollIntoView({ behavior: "instant" }));
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
    cards: Array.from(document.querySelectorAll(".wv")).map((c) => Math.round(c.getBoundingClientRect().right)),
    concepts: Array.from(document.querySelectorAll(".concepts .work")).map((c) => {
      const r = c.getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right) };
    }),
  }));
  expect(m.sw).toBeLessThanOrEqual(m.cw);
  expect(Math.max(...m.cards)).toBeLessThanOrEqual(360);
  expect(m.concepts).toHaveLength(3);
  expect(new Set(m.concepts.map((c) => c.left)).size, "one column").toBe(1);
  expect(Math.max(...m.concepts.map((c) => c.right))).toBeLessThanOrEqual(360);
});

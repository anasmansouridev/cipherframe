import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { hermetic, isMobile, scrollThrough } from "./helpers";

const POST_LINE = "Introducing HoneyB — the income orchestration layer for Bitcoin. Your bitcoin stays with your qualified custodian. Income arrives.";
const isFilm = (u: string) => /\/showcase\/honeyb\/honeyb_after\.(mp4|webm)(\?|$)/.test(u);

/** Pin the tier: under heavy parallel load the FPS probe may drop the page to Tier C (no autoplay), which is correct but not what these tests exercise. */
const pinTierB = (page: Page) => page.addInitScript(() => ((window as unknown as { __CF_FORCE_TIER__: string }).__CF_FORCE_TIER__ = "B"));

/** Jump (no smooth scroll) so the film sits in the middle of the screen. */
const toFilm = (page: Page) => page.evaluate(() => document.querySelector("[data-ba-video]")!.scrollIntoView({ block: "center", behavior: "instant" }));
const toTop = (page: Page) => page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
const film = (page: Page) => page.evaluate(() => { const v = document.querySelector<HTMLVideoElement>("[data-ba-video]")!; return { paused: v.paused, muted: v.muted, ready: v.readyState }; });
const split = (page: Page) => page.locator("[data-ba]").evaluate((el) => (el as HTMLElement).style.getPropertyValue("--split"));

test("showcase · the card is HoneyB, with the new post line and none of the old Arclight copy", async ({ page }) => {
  await hermetic(page);
  await page.goto("/");
  const section = page.locator("#difference");

  await expect(section.locator(".eyebrow")).toHaveText("SEE THE DIFFERENCE");
  await expect(section.locator("h2")).toHaveText("Same announcement. One gets scrolled past.");
  await expect(section.locator(".ba__label").first()).toHaveText("STATIC · what you post now");
  await expect(section.locator(".ba__label--right")).toHaveText("CIPHERFRAME · what you could post");
  await expect(section.locator(".ba__hint-desktop")).toHaveText("Drag the frame ⟷");
  await expect(section.locator(".ba__caption")).toHaveText("Your followers scroll fast. A still image asks them to stop. Motion gives them a reason to.");

  await expect(section.locator(".post__name")).toHaveText(["HoneyB", "HoneyB"]);
  await expect(section.locator(".post__text")).toHaveText([POST_LINE, POST_LINE]);
  await expect(section.getByRole("img", { name: "HoneyB logo", exact: true, includeHidden: true })).toHaveCount(2);

  // Brand rule for HoneyB: no yield / earn / APY, and no numbers, in the post copy.
  for (const text of await section.locator(".post__text").allTextContents()) expect(text).not.toMatch(/\b(yield|earn|apy)\b|\d/i);

  const html = await section.innerHTML();
  expect(html, "old sample copy must be gone").not.toMatch(/arclight|mainnet|flat__|kin__/i);
});

test("showcase · a ?c= project name personalises the page but never renames HoneyB", async ({ page }) => {
  await hermetic(page);
  await page.goto("/?c=Foo%20Labs&t=mainnet");
  await expect(page.locator("h1")).toHaveText("Foo Labs's mainnet deserves more than a JPEG.");
  await expect(page.locator("#difference .post__name")).toHaveText(["HoneyB", "HoneyB"]);
  await expect(page.locator("#difference")).not.toContainText("Foo Labs");
});

test("showcase · the static image and the film fill exactly the same 16:9 box", async ({ page }) => {
  await hermetic(page);
  await page.goto("/");
  await toFilm(page);
  await expect.poll(() => page.locator("#difference picture img").evaluate((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth)).toBe(1920);
  const boxes = await page.evaluate(() => {
    const r = (sel: string) => {
      const b = document.querySelector(sel)!.getBoundingClientRect();
      return { x: b.x, y: b.y, w: b.width, h: b.height };
    };
    return {
      still: r(".ba__layer--static .post__media"),
      motion: r(".ba__layer--motion .post__media"),
      img: r(".ba__layer--static .post__media img"),
      video: r(".ba__layer--motion .post__media video"),
    };
  });
  for (const k of ["x", "y", "w", "h"] as const) expect(Math.abs(boxes.still[k] - boxes.motion[k]), `media box ${k}`).toBeLessThanOrEqual(0.5);
  expect(Math.abs(boxes.still.w / boxes.still.h - 16 / 9)).toBeLessThan(0.03);
  // the image and the film fill their boxes edge to edge (inside the 1px border): no letterboxing
  expect(boxes.still.w - boxes.img.w).toBeLessThanOrEqual(2.5);
  expect(boxes.still.h - boxes.img.h).toBeLessThanOrEqual(2.5);
  expect(boxes.motion.w - boxes.video.w).toBeLessThanOrEqual(2.5);
  expect(boxes.motion.h - boxes.video.h).toBeLessThanOrEqual(2.5);
});

test("showcase · WebP and WebM are listed first, with PNG and MP4 as fallbacks", async ({ page }) => {
  await hermetic(page);
  await page.goto("/");
  const html = await page.locator("#difference").innerHTML();
  expect(html.indexOf("honeyb_before.webp")).toBeGreaterThan(-1);
  expect(html.indexOf("honeyb_before.webp")).toBeLessThan(html.indexOf("honeyb_before.png"));
  expect(html.indexOf("honeyb_after.webm")).toBeGreaterThan(-1);
  expect(html.indexOf("honeyb_after.webm")).toBeLessThan(html.indexOf("honeyb_after.mp4"));
  await toFilm(page);
  await expect.poll(() => page.locator("#difference picture img").evaluate((i) => (i as HTMLImageElement).currentSrc)).toMatch(/honeyb_before\.webp$/);
  const video = page.locator("[data-ba-video]");
  await expect(video).toHaveAttribute("poster", "/showcase/honeyb/honeyb_after_poster.jpg"); // set by script once the card is near
  await expect(video).toHaveAttribute("preload", "none");
  for (const attr of ["muted", "loop", "playsinline"]) expect(await video.evaluate((v, a) => v.hasAttribute(a), attr), attr).toBe(true);
});

test("showcase · the poster is not in the parsed HTML, so it cannot delay the first paint", async ({ request }) => {
  const html = await (await request.get("/")).text();
  const tag = html.match(/<video data-ba-video[^>]*>/)?.[0] ?? "";
  expect(tag).toContain('data-poster="/showcase/honeyb/honeyb_after_poster.jpg"');
  expect(tag).not.toMatch(/\sposter=/); // the Work films' own posters are separate
});

test("showcase · every asset is served, and the section's media weighs under 1.5 MB", async ({ page, request }) => {
  await hermetic(page);
  const files = ["honeyb_before.webp", "honeyb_before.png", "honeyb_after.webm", "honeyb_after.mp4", "honeyb_after_poster.jpg", "honeyb_avatar.png"];
  const sizes: Record<string, number> = {};
  for (const f of files) {
    const res = await request.get(`/showcase/honeyb/${f}`);
    expect(res.status(), f).toBe(200);
    expect(res.headers()["content-type"], f).toMatch(/^(image|video)\//);
    sizes[f] = fs.statSync(path.resolve("public/showcase/honeyb", f)).size;
  }
  const kit = ["honeyb_before.webp", "honeyb_after_poster.jpg", "honeyb_avatar.png"].reduce((n, f) => n + sizes[f], 0);
  expect(kit + sizes["honeyb_after.webm"], "Chrome / Firefox path").toBeLessThan(1.5 * 1024 * 1024);
  expect(kit + sizes["honeyb_after.mp4"], "Safari / iOS path").toBeLessThan(1.5 * 1024 * 1024);
});

test("showcase · nothing of the film downloads on load; it plays muted at 40% visible and pauses when scrolled away", async ({ page }, info) => {
  test.skip(isMobile(info), "desktop: the film shows in the split view");
  const requested: string[] = [];
  page.on("request", (r) => isFilm(r.url()) && requested.push(r.url().split("/").pop()!));
  const errors = await hermetic(page);
  await pinTierB(page);
  await page.goto("/");
  await page.waitForTimeout(2500);
  expect(requested, "no film bytes before the card is near").toEqual([]);
  expect((await film(page)).ready).toBe(0);

  await toFilm(page);
  await expect.poll(async () => (await film(page)).paused, { timeout: 10_000 }).toBe(false);
  expect((await film(page)).muted).toBe(true);
  expect(requested).toContain("honeyb_after.webm");

  await toTop(page);
  await expect.poll(async () => (await film(page)).paused, { timeout: 5000 }).toBe(true);
  await toFilm(page);
  await expect.poll(async () => (await film(page)).paused, { timeout: 10_000 }).toBe(false);
  expect(errors).toEqual([]);
});

test("showcase · the speaker button unmutes the film, leaves the divider alone, and re-mutes when scrolled away", async ({ page }, info) => {
  test.skip(isMobile(info), "desktop: the film shows in the split view");
  await hermetic(page);
  await pinTierB(page);
  await page.goto("/");
  await page.waitForTimeout(1200);
  await toFilm(page);
  await expect.poll(async () => (await film(page)).paused, { timeout: 10_000 }).toBe(false);
  await page.waitForTimeout(3200); // let the one-off divider peek finish so the position is stable

  const sound = page.locator("[data-ba-sound]");
  await expect(sound).toBeVisible();
  await expect(sound).toHaveAccessibleName("Turn sound on");
  const box = (await sound.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);

  const before = await split(page);
  await sound.click();
  expect((await film(page)).muted).toBe(false);
  await expect(sound).toHaveAccessibleName("Turn sound off");
  await expect(sound).toHaveClass(/is-on/);
  expect(await split(page), "pressing the button must not move the divider").toBe(before);
  expect((await film(page)).paused).toBe(false);

  await sound.click();
  expect((await film(page)).muted).toBe(true);
  await expect(sound).toHaveAccessibleName("Turn sound on");

  await sound.click();
  await toTop(page);
  await expect.poll(async () => (await film(page)).paused, { timeout: 5000 }).toBe(true);
  expect((await film(page)).muted, "a film that left the screen never keeps its sound").toBe(true);
  await expect(sound).toHaveAccessibleName("Turn sound on");
});

test("showcase · mobile: the film plays only on the Motion side, and tapping the picture switches sides", async ({ page }, info) => {
  test.skip(!isMobile(info), "mobile toggle (<768px)");
  await hermetic(page);
  await pinTierB(page);
  await page.goto("/");
  const ba = page.locator("[data-ba]");
  await expect(ba).toHaveAttribute("data-state", "static");
  expect((await film(page)).paused).toBe(true);

  // the hidden Motion layer must not catch taps or focus
  expect(await page.locator(".ba__layer--motion").evaluate((el) => getComputedStyle(el).visibility)).toBe("hidden");

  await toFilm(page);
  await expect(ba).toHaveAttribute("data-state", "motion", { timeout: 6000 }); // the 1.2s auto-switch
  await expect.poll(async () => (await film(page)).paused, { timeout: 10_000 }).toBe(false);
  expect((await film(page)).muted).toBe(true);

  await page.getByRole("button", { name: "Static", exact: true }).click();
  await expect(ba).toHaveAttribute("data-state", "static");
  await expect.poll(async () => (await film(page)).paused, { timeout: 5000 }).toBe(true);

  await page.locator(".ba__layer--static .post__media").click();
  await expect(ba).toHaveAttribute("data-state", "motion");
  await expect.poll(async () => (await film(page)).paused, { timeout: 10_000 }).toBe(false);
});

test("showcase · the page still has no horizontal scroll with the new card", async ({ page }) => {
  await hermetic(page);
  await page.goto("/");
  await scrollThrough(page);
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw).toBeLessThanOrEqual(cw);
});

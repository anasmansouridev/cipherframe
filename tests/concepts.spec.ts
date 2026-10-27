import { expect, test, type Page } from "@playwright/test";
import { CONFIG } from "../src/config.ts";
import { conceptFiles } from "../src/work.ts";
import { hermetic, isMobile, viewportOf } from "./helpers";

const SLUGS = CONFIG.concepts.map((c) => c.slug);
const isConceptMedia = (u: string) => /\/work\/work-0\d-[a-z-]+\.(mp4|webm|jpg)(\?|$)/.test(u);

/** Pin the tier: under heavy parallel load the FPS probe may drop the page to Tier C (no autoplay), which is correct but not what these tests exercise. */
const pinTierB = (page: Page) => page.addInitScript(() => ((window as unknown as { __CF_FORCE_TIER__: string }).__CF_FORCE_TIER__ = "B"));

/** Jump (no smooth scroll) so the card's picture sits in the middle of the screen. */
const toCard = (page: Page, i: number) =>
  page.evaluate((i) => document.querySelectorAll(".cv__media")[i].scrollIntoView({ block: "center", behavior: "instant" }), i);
const toTop = (page: Page) => page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));

/** How much of each picture is on screen, and what its video is doing. */
const snapshot = (page: Page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll(".cv")).map((c) => {
      const m = c.querySelector(".cv__media")!.getBoundingClientRect();
      const v = c.querySelector("video")!;
      const vis = Math.max(0, Math.min(m.bottom, innerHeight) - Math.max(m.top, 0)) / m.height;
      return { vis, paused: v.paused, muted: v.muted, ready: v.readyState, pressed: c.querySelector("[data-cv-sound]")?.getAttribute("aria-pressed") ?? null };
    }),
  );

/** Every picture that is clearly on screen plays; every one that is clearly off screen is paused. */
const settled = async (page: Page) => (await snapshot(page)).every((s) => (s.vis >= 0.6 ? !s.paused : s.vis <= 0.4 ? s.paused : true));

test("concepts · three cards in order, with the specified copy; the old illustrations are gone", async ({ page }) => {
  await hermetic(page);
  await pinTierB(page);
  await page.goto("/");
  await expect(page.locator(".concepts__title")).toHaveText("Studio concepts");
  const cards = page.locator(".concepts .work");
  await expect(cards).toHaveCount(3);
  await expect(cards.locator(".tag")).toHaveText(["ORIGINAL", "CONCEPT", "CONCEPT"]);
  await expect(cards.locator("h4")).toHaveText(["Static to motion · 48 hours.", "Brand film · HoneyB.", "Launch film · Trezor × Arc."]);
  await expect(cards.locator(".work__spec")).toHaveText(["15s · 16:9", "5s · 16:9 + 1:1", "7s · 16:9 + 1:1 · 3D"]);
  await expect(cards.locator(".work__body p:not(.work__spec)")).toHaveText([
    "A flat mainnet post turns into a full network announcement.",
    "Bars become the hive. Bitcoin stays, income arrives.",
    "A coin rides the arc and lands on the Trusted Display.",
  ]);
  await expect(cards.locator("[data-cv-open]").first()).toHaveAccessibleName("Open video: Static to motion · 48 hours.");
  const html = await page.locator("#work").innerHTML();
  expect(html).not.toMatch(/wm__|wm--|Play concept|Protocol explainer|Payment flow|Announcement · Mainnet/);
  await expect(page.locator(".concepts video")).toHaveCount(3);
  for (const v of await page.locator(".concepts video").all()) {
    for (const a of ["muted", "loop", "playsinline"]) expect(await v.evaluate((el, a) => el.hasAttribute(a), a), a).toBe(true);
    await expect(v).toHaveAttribute("preload", "none");
  }
});

test("concepts · the picture is 16:9 and fills the card's top; grid is 3 columns from 768px, 1 column with 24px gaps below", async ({ page }, info) => {
  await hermetic(page);
  await page.goto("/");
  const m = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>(".concepts .work"));
    return cards.map((c) => {
      const r = c.getBoundingClientRect();
      const media = c.querySelector<HTMLElement>(".work__media")!.getBoundingClientRect();
      const cs = getComputedStyle(c);
      return { x: r.x, y: r.y, w: r.width, h: r.height, bottom: r.bottom, mediaW: media.width, mediaH: media.height, radius: cs.borderTopLeftRadius, overflow: cs.overflow, mediaTop: media.top - r.top };
    });
  });
  for (const c of m) {
    expect(Math.abs(c.mediaW / c.mediaH - 16 / 9), "picture is 16:9").toBeLessThan(0.02);
    expect(c.mediaW, "picture spans the card").toBeGreaterThanOrEqual(c.w - 2.5);
    expect(c.radius).toBe("14px");
    expect(c.overflow, "the card clips the picture to its corners").toBe("hidden");
    expect(c.mediaTop, "picture sits at the very top").toBeLessThanOrEqual(1.5);
  }
  if (viewportOf(info).width >= 768) {
    expect(new Set(m.map((c) => Math.round(c.y))).size, "one row").toBe(1);
    expect(new Set(m.map((c) => Math.round(c.x))).size, "three columns").toBe(3);
  } else {
    expect(new Set(m.map((c) => Math.round(c.x))).size, "one column").toBe(1);
    expect(Math.round(m[1].y - m[0].bottom)).toBe(24);
    expect(Math.round(m[2].y - m[1].bottom)).toBe(24);
  }
});

test("concepts · nothing loads until a card is near; then only that card's poster is set", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (r) => isConceptMedia(r.url()) && requested.push(r.url().split("/").pop()!));
  await hermetic(page);
  await pinTierB(page);
  const html = await (await page.request.get("/")).text();
  for (const tag of html.match(/<video class="cv__video"[^>]*>/g) ?? []) expect(tag).not.toMatch(/\sposter=/);
  await page.goto("/");
  await page.waitForTimeout(2500);
  expect(requested, "no concept bytes on load").toEqual([]);
  expect((await snapshot(page)).every((s) => s.ready === 0)).toBe(true);
  expect(await page.locator(".cv__video").first().getAttribute("poster")).toBeNull();

  await toCard(page, 0);
  await expect(page.locator(".cv__video").first()).toHaveAttribute("poster", conceptFiles(SLUGS[0]).poster);
  await expect.poll(() => requested.some((u) => u === `${SLUGS[0]}.jpg`)).toBe(true);
});

test("concepts · only cards in view play, always muted; leaving the screen pauses", async ({ page }, info) => {
  const errors = await hermetic(page);
  await pinTierB(page);
  await page.goto("/");
  await page.waitForTimeout(1500);
  await toCard(page, 0);
  await expect.poll(() => settled(page), { timeout: 12_000 }).toBe(true);
  let s = await snapshot(page);
  expect(s[0].paused, "the first picture is on screen").toBe(false);
  expect(s.every((x) => x.muted), "every film is silent until its button is pressed").toBe(true);
  if (isMobile(info)) {
    // one column: moving to the last card must stop the first
    await toCard(page, 2);
    await expect.poll(() => settled(page), { timeout: 12_000 }).toBe(true);
    s = await snapshot(page);
    expect(s[2].paused).toBe(false);
    expect(s[0].paused, "card 1 is off screen now").toBe(true);
  } else {
    expect(s.every((x) => !x.paused), "all three are on screen on desktop").toBe(true);
  }
  await toTop(page);
  await expect.poll(async () => (await snapshot(page)).every((x) => x.paused), { timeout: 8000 }).toBe(true);
  expect(errors).toEqual([]);
});

test("concepts · the speaker button is 32px in the bottom-right and unmutes one film at a time", async ({ page }, info) => {
  test.skip(isMobile(info), "all three films are on screen together on desktop");
  const errors = await hermetic(page);
  await pinTierB(page);
  await page.goto("/");
  await page.waitForTimeout(1200);
  await toCard(page, 1);
  await expect.poll(async () => (await snapshot(page)).every((x) => !x.paused), { timeout: 12_000 }).toBe(true);

  const buttons = page.locator("[data-cv-sound]");
  await expect(buttons).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    await expect(buttons.nth(i)).toBeVisible({ timeout: 15_000 });
    await expect(buttons.nth(i)).toHaveAttribute("aria-pressed", "false");
    await expect(buttons.nth(i)).toHaveAccessibleName(/^Sound: /);
  }
  const geo = await page.evaluate(() => {
    const media = document.querySelector(".cv__media")!.getBoundingClientRect();
    const b = document.querySelector("[data-cv-sound]")!.getBoundingClientRect();
    return { w: b.width, h: b.height, right: media.right - b.right, bottom: media.bottom - b.bottom, radius: getComputedStyle(document.querySelector("[data-cv-sound]")!).borderTopLeftRadius, border: getComputedStyle(document.querySelector("[data-cv-sound]")!).borderTopWidth };
  });
  expect(geo.w).toBe(32);
  expect(geo.h).toBe(32);
  expect(geo.right).toBeGreaterThanOrEqual(0);
  expect(geo.right).toBeLessThanOrEqual(12);
  expect(geo.bottom).toBeGreaterThanOrEqual(0);
  expect(geo.bottom).toBeLessThanOrEqual(12);
  expect(geo.border).toBe("1px");

  await buttons.nth(1).click();
  await expect(buttons.nth(1)).toHaveAttribute("aria-pressed", "true");
  let s = await snapshot(page);
  expect(s.map((x) => x.muted)).toEqual([true, false, true]);
  expect(s.every((x) => !x.paused), "unmuting does not stop the others").toBe(true);

  await buttons.nth(2).click();
  s = await snapshot(page);
  expect(s.map((x) => x.muted), "unmuting one mutes the other two").toEqual([true, true, false]);
  expect(s.map((x) => x.pressed)).toEqual(["false", "false", "true"]);

  await buttons.nth(2).click();
  expect((await snapshot(page)).every((x) => x.muted)).toBe(true);

  await buttons.nth(0).click();
  await toTop(page);
  await expect.poll(async () => (await snapshot(page)).every((x) => x.paused), { timeout: 8000 }).toBe(true);
  s = await snapshot(page);
  expect(s.every((x) => x.muted), "a film that left the screen never keeps its sound").toBe(true);
  expect(s.every((x) => x.pressed === "false")).toBe(true);
  expect(errors).toEqual([]);
});

test("concepts · only one film on the whole page has sound: a Work film and a concept silence each other", async ({ page }, info) => {
  test.skip(isMobile(info), "desktop layout");
  await hermetic(page);
  await pinTierB(page);
  await page.goto("/");
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.querySelector(".wv")!.scrollIntoView({ block: "center", behavior: "instant" }));
  const workSound = page.locator("[data-wv-sound]").first();
  await expect.poll(() => page.evaluate(() => !document.querySelector<HTMLVideoElement>(".wv video")!.paused), { timeout: 12_000 }).toBe(true);
  await workSound.click();
  expect(await page.evaluate(() => document.querySelector<HTMLVideoElement>(".wv video")!.muted)).toBe(false);

  await toCard(page, 1);
  await expect.poll(async () => (await snapshot(page))[1].paused, { timeout: 12_000 }).toBe(false);
  const conceptSound = page.locator("[data-cv-sound]").nth(1);
  await expect(conceptSound).toBeVisible({ timeout: 15_000 }); // it shows once the film is really playing
  await conceptSound.click();
  expect(await page.evaluate(() => Array.from(document.querySelectorAll<HTMLVideoElement>(".wv video")).every((v) => v.muted)), "the Work film is silenced").toBe(true);
  expect((await snapshot(page))[1].muted).toBe(false);
});

test("concepts · the lightbox opens from the keyboard, plays with sound from 0, and closes three ways with focus returned", async ({ page }) => {
  const errors = await hermetic(page);
  await pinTierB(page);
  await page.goto("/");
  await page.waitForTimeout(1200);
  await toCard(page, 1);
  await expect.poll(async () => (await snapshot(page))[1].paused, { timeout: 12_000 }).toBe(false);

  const opener = page.locator("[data-cv-open]").nth(1);
  const dialog = page.locator("dialog.video-dialog");
  const open = async () => {
    await opener.focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
  };

  await open();
  await expect(dialog).toHaveAccessibleName("Brand film · HoneyB.");
  const v = dialog.locator("video");
  await expect(v).toHaveJSProperty("controls", true);
  await expect.poll(() => v.evaluate((el: HTMLVideoElement) => !el.paused), { timeout: 10_000 }).toBe(true);
  expect(await v.evaluate((el: HTMLVideoElement) => el.muted), "the lightbox has sound").toBe(false);
  expect(await v.evaluate((el: HTMLVideoElement) => (el.played.length ? el.played.start(0) : -1)), "starts from 0").toBe(0);
  expect(await v.evaluate((el: HTMLVideoElement) => Array.from(el.querySelectorAll("source")).map((s) => s.type))).toEqual(["video/webm", "video/mp4"]);
  const box = (await v.boundingBox())!;
  const vw = viewportOf_(page);
  expect(box.width).toBeLessThanOrEqual(vw * 0.9 + 1);
  expect(Math.abs(box.x + box.width / 2 - vw / 2), "centred").toBeLessThanOrEqual(2);
  expect((await snapshot(page)).every((s) => s.paused && s.muted), "the inline films stop while it is open").toBe(true);

  // keyboard only: focus stays inside the dialog, Escape closes it
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest("dialog"))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect.poll(async () => (await snapshot(page))[1].paused, { timeout: 10_000 }).toBe(false); // inline playback resumes

  // the close button
  await open();
  await dialog.getByRole("button", { name: "Close video" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();

  // a click on the dark overlay, outside the video
  await open();
  await page.mouse.click(3, 3);
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();

  // clicking the picture itself also opens it
  await toCard(page, 0);
  await page.locator(".cv__media").first().click({ position: { x: 24, y: 24 } });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAccessibleName("Static to motion · 48 hours.");
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-cv-open]").first()).toBeFocused();
  expect(errors).toEqual([]);
});

test("concepts · opening the lightbox silences every other film on the page", async ({ page }, info) => {
  test.skip(isMobile(info), "desktop layout");
  await hermetic(page);
  await pinTierB(page);
  await page.goto("/");
  await page.waitForTimeout(1200);
  await toCard(page, 0);
  await expect.poll(async () => (await snapshot(page)).every((x) => !x.paused), { timeout: 12_000 }).toBe(true);
  await expect(page.locator("[data-cv-sound]").first()).toBeVisible({ timeout: 15_000 });
  await page.locator("[data-cv-sound]").first().click();
  await page.locator("[data-cv-open]").nth(2).click();
  await expect(page.locator("dialog.video-dialog")).toBeVisible();
  expect((await snapshot(page)).every((s) => s.muted)).toBe(true);
});

test("concepts · no layout shift while posters and films load", async ({ page }) => {
  await hermetic(page);
  await pinTierB(page);
  await page.addInitScript(() => {
    const w = window as unknown as { __cvShift: number };
    w.__cvShift = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { hadRecentInput: boolean; value: number; sources?: { node?: Node }[] }[]) {
        if (e.hadRecentInput) continue;
        if ((e.sources ?? []).some((s) => s.node && (s.node.nodeType === 1 ? (s.node as Element) : s.node.parentElement)?.closest(".concepts"))) w.__cvShift += e.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/");
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.querySelector(".concepts")!.scrollIntoView({ block: "start", behavior: "instant" }));
  const before = await page.evaluate(() => Array.from(document.querySelectorAll(".cv")).map((c) => Math.round(c.getBoundingClientRect().height * 10) / 10));
  await expect.poll(() => settled(page), { timeout: 12_000 }).toBe(true);
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => Array.from(document.querySelectorAll(".cv")).map((c) => Math.round(c.getBoundingClientRect().height * 10) / 10));
  expect(after, "card heights do not change when the media arrives").toEqual(before);
  expect(await page.evaluate(() => (window as unknown as { __cvShift: number }).__cvShift)).toBe(0);
});

/** The viewport width, as the page sees it. */
function viewportOf_(page: Page): number {
  return page.viewportSize()!.width;
}

import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, hermetic, scrollThrough, viewportOf } from "./helpers";

test("1 · no horizontal scroll and no console errors from our code", async ({ page }) => {
  const errors = await hermetic(page);
  await page.goto("/");
  await expectNoHorizontalScroll(page);
  await scrollThrough(page);
  await expectNoHorizontalScroll(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  expect(errors).toEqual([]);
});

test("1b · no horizontal scroll when personalised with a 40-character project name", async ({ page }) => {
  await hermetic(page);
  await page.goto("/?c=Arclight%20Protocol%20Foundation%20Labs%20Inc&t=partnership");
  await expectNoHorizontalScroll(page);
  await scrollThrough(page);
  await expectNoHorizontalScroll(page);
});

for (const query of ["", "?c=Arclight&t=mainnet", "?c=Arclight%20Protocol%20Foundation%20Labs&t=partnership"]) {
  test(`2 · 360×640: H1, both hero CTAs and the risk line are above the fold ${query || "(default)"}`, async ({ page }, info) => {
    const vp = viewportOf(info);
    test.skip(vp.width !== 360 || vp.height !== 640, "360×640 only");
    await hermetic(page);
    await page.goto(`/${query}`);
    for (const sel of ["#hero-title", ".hero__ctas .btn--primary", ".hero__ctas .btn--secondary", ".risk"]) {
      const box = await page.locator(sel).boundingBox();
      expect(box, sel).not.toBeNull();
      expect(box!.y, `${sel} top`).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height, `${sel} bottom must be within 640px`).toBeLessThanOrEqual(640);
      await expect(page.locator(sel)).toBeVisible();
    }
    if (query) await expect(page.locator("[data-p='chip']")).toBeInViewport();
    await expect(page.locator(".hero .eyebrow")).toBeInViewport();
  });
}

test("anchors · the hero 'Book a 15-min call' lands on #book", async ({ page }) => {
  await hermetic(page);
  await page.goto("/");
  await page.waitForTimeout(2500); // let lazy motion (pinning, etc.) settle first
  await page.locator(".hero__ctas .btn--primary").click();
  await expect
    .poll(async () => Math.round(await page.locator("#book").evaluate((el) => el.getBoundingClientRect().top)), { timeout: 8000 })
    .toBeLessThanOrEqual(40);
  const top = await page.locator("#book").evaluate((el) => el.getBoundingClientRect().top);
  expect(top).toBeGreaterThanOrEqual(-40);
});

test("anchors · a DM deep link to #pricing stays on #pricing after lazy features load", async ({ page }) => {
  await hermetic(page);
  await page.goto("/?c=Arclight&t=launch&utm_source=x&utm_medium=dm&utm_campaign=dm3#pricing");
  await page.waitForTimeout(4000);
  const top = await page.locator("#pricing").evaluate((el) => el.getBoundingClientRect().top);
  expect(Math.abs(top)).toBeLessThanOrEqual(40);
});

test("anchors · Tier A (Lenis, WebGL, pinned timeline) keeps #pricing and #book anchors true", async ({ page }, info) => {
  test.skip(viewportOf(info).width < 1024, "Tier A desktop path");
  await hermetic(page);
  await page.addInitScript(() => ((window as unknown as { __CF_FORCE_TIER__: string }).__CF_FORCE_TIER__ = "A"));
  await page.goto("/?c=Arclight&utm_campaign=dm3#pricing");
  await page.waitForTimeout(4500);
  expect(Math.abs(await page.locator("#pricing").evaluate((el) => el.getBoundingClientRect().top))).toBeLessThanOrEqual(40);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(600);
  await page.locator(".hero__ctas .btn--primary").click();
  await expect
    .poll(async () => Math.abs(Math.round(await page.locator("#book").evaluate((el) => el.getBoundingClientRect().top))), { timeout: 8000 })
    .toBeLessThanOrEqual(40);
});

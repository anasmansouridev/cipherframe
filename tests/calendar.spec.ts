import { expect, test, type Page } from "@playwright/test";
import { hermetic, isMobile } from "./helpers";

/**
 * Cal.com is blocked in tests, so a stand-in iframe plays the part of its embed: like Cal's, it is as tall as its
 * content (a day view that lists every slot), and it is injected after the page has set up the embed.
 */
async function toCalendar(page: Page): Promise<void> {
  await page.evaluate(() => document.querySelector(".cal")!.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.waitForTimeout(2000); // initCal runs in idle time, then waits for the box to be near
}
const injectFrame = (page: Page, height: number) =>
  page.evaluate((h) => {
    const f = document.createElement("iframe");
    f.srcdoc = `<body style="margin:0;background:#222;color:#fff"><div style="height:${h}px">9:00am … 5:45pm</div></body>`;
    f.style.cssText = `display:block;border:0;width:100%;height:${h}px`;
    document.getElementById("cal-inline")!.append(f);
  }, height);
const metrics = (page: Page) =>
  page.evaluate(() => {
    const cal = document.querySelector<HTMLElement>(".cal")!;
    const embed = document.querySelector<HTMLElement>("[data-cal-embed]")!;
    const hint = document.querySelector<HTMLElement>("[data-cal-hint]")!;
    return {
      calH: Math.round(cal.getBoundingClientRect().height),
      pageH: document.documentElement.scrollHeight,
      embedScrollH: embed.scrollHeight,
      embedClientH: embed.clientHeight,
      top: Math.round(embed.scrollTop),
      hint: !hint.hidden,
      overflowY: getComputedStyle(embed).overflowY,
      scrollY: Math.round(scrollY),
    };
  });

test("calendar · a tall embed sits in a fixed-height window, so the page does not grow", async ({ page }) => {
  await hermetic(page);
  await page.goto("/");
  await toCalendar(page);
  const before = await metrics(page);
  expect(before.calH).toBeGreaterThanOrEqual(500);
  expect(before.calH).toBeLessThanOrEqual(620);
  await injectFrame(page, 3000);
  await page.waitForTimeout(400);
  const after = await metrics(page);
  expect(after.embedScrollH, "the embed really is that tall").toBeGreaterThanOrEqual(3000);
  expect(after.calH, "the window keeps its height").toBe(before.calH);
  expect(Math.abs(after.pageH - before.pageH), "the page is no longer").toBeLessThanOrEqual(1);
  expect(after.overflowY).toBe("auto");
  expect(after.embedClientH).toBeGreaterThan(400);
});

test("calendar · it scrolls vertically inside its window (wheel and scrollbar), and a cue shows while there is more below", async ({ page }, info) => {
  test.skip(isMobile(info), "wheel and scrollbar are desktop input");
  await hermetic(page);
  await page.addInitScript(() => ((window as unknown as { __CF_FORCE_TIER__: string }).__CF_FORCE_TIER__ = "A")); // Lenis smooth scroll is on
  await page.goto("/");
  await toCalendar(page);
  await injectFrame(page, 3000);
  await expect(page.locator("[data-cal-hint]")).toBeVisible();
  await expect(page.locator("[data-cal-hint]")).toHaveText("Scroll for more");

  const box = (await page.locator("[data-cal-embed]").boundingBox())!;
  const y0 = (await metrics(page)).scrollY;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 600);
  await expect.poll(async () => (await metrics(page)).top, { timeout: 5000 }).toBeGreaterThan(300);
  expect((await metrics(page)).scrollY, "the wheel moved the calendar, not the page").toBe(y0);

  await page.locator("[data-cal-embed]").evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect(page.locator("[data-cal-hint]")).toBeHidden();
  await page.locator("[data-cal-embed]").evaluate((el) => (el.scrollTop = 0));
  await expect(page.locator("[data-cal-hint]")).toBeVisible();
});

test("calendar · no cue and no scrolling when the embed fits its window", async ({ page }) => {
  await hermetic(page);
  await page.goto("/");
  await toCalendar(page);
  await injectFrame(page, 300);
  await page.waitForTimeout(400);
  const m = await metrics(page);
  expect(m.hint).toBe(false);
  expect(m.embedScrollH).toBeLessThanOrEqual(m.embedClientH + 1);
});

test("calendar · the scroll window is reachable by touch: it is a native scroller with room beside it for the page to scroll", async ({ page }, info) => {
  test.skip(!isMobile(info), "phones");
  await hermetic(page);
  await page.goto("/");
  await toCalendar(page);
  await injectFrame(page, 3000);
  const m = await page.evaluate(() => {
    const cal = document.querySelector<HTMLElement>(".cal")!.getBoundingClientRect();
    const embed = document.querySelector<HTMLElement>("[data-cal-embed]")!;
    return { calW: Math.round(cal.width), vw: innerWidth, touch: getComputedStyle(embed).touchAction, overflowY: getComputedStyle(embed).overflowY, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
  });
  expect(m.overflowY).toBe("auto");
  expect(m.touch, "no touch-action override: swipes scroll it natively").toBe("auto");
  expect(m.calW, "a gutter on each side of the window, so the page can still be scrolled").toBeLessThan(m.vw - 24);
  expect(m.sw).toBeLessThanOrEqual(m.cw);
});

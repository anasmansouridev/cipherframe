import { expect, type Page, type TestInfo } from "@playwright/test";

/** Third-party requests (Cal.com, Tally, Cloudflare) are aborted so tests are hermetic. */
export async function hermetic(page: Page): Promise<string[]> {
  const errors: string[] = [];
  await page.route(/^(?!http:\/\/localhost:4173)/, (route) => route.abort());
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    // Aborted third-party requests are expected here; they're not errors from our code.
    if (/Failed to load resource|net::ERR_FAILED|ERR_BLOCKED/i.test(text)) return;
    errors.push(`console: ${text}`);
  });
  return errors;
}

export const viewportOf = (info: TestInfo) => info.project.use.viewport ?? { width: 1280, height: 800 };
export const isMobile = (info: TestInfo) => viewportOf(info).width < 768;

/** Scroll through the whole page in steps so every lazy feature initialises. */
export async function scrollThrough(page: Page, step = 0.8): Promise<void> {
  await page.evaluate(async (step) => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * step) {
      window.scrollTo(0, y);
      await sleep(120);
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    await sleep(400);
  }, step);
}

export async function scrollToDepth(page: Page, depth: number): Promise<void> {
  await page.evaluate((d) => {
    const h = document.documentElement.scrollHeight;
    window.scrollTo(0, Math.max(0, h * d - innerHeight));
  }, depth);
}

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw, "page must not scroll horizontally").toBeLessThanOrEqual(cw);
}

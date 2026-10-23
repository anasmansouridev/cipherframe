import { expect, test } from "@playwright/test";
import { hermetic } from "./helpers";

const QUERY = "?c=Arclight&t=mainnet&utm_source=x&utm_medium=dm&utm_campaign=dm1";

test("4 · c, t and UTMs are appended to both Tally URLs", async ({ page }) => {
  await hermetic(page);
  await page.goto(`/${QUERY}`);
  for (const kind of ["remake", "clip"]) {
    const hrefs = await page.locator(`a[data-tally='${kind}']`).evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).href));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      const u = new URL(href);
      expect(u.hostname).toBe("tally.so");
      expect(u.searchParams.get("c")).toBe("Arclight");
      expect(u.searchParams.get("t")).toBe("mainnet");
      expect(u.searchParams.get("utm_source")).toBe("x");
      expect(u.searchParams.get("utm_medium")).toBe("dm");
      expect(u.searchParams.get("utm_campaign")).toBe("dm1");
    }
    await expect(page.locator(`a[data-tally='${kind}']`).first()).toHaveAttribute("target", "_blank");
  }
});

test("4 · first-touch UTMs survive in sessionStorage", async ({ page }) => {
  await hermetic(page);
  await page.goto(`/${QUERY}`);
  await page.goto("/#pricing");
  const href = await page.locator("a[data-tally='clip']").first().getAttribute("href");
  expect(new URL(href!).searchParams.get("utm_campaign")).toBe("dm1");
});

test("4 · Cal.com gets forwardQueryParams, the attribution config and a fallback link", async ({ page }) => {
  await hermetic(page);
  await page.goto(`/${QUERY}`);
  await page.locator("#book").scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => (window as unknown as { Cal?: { config?: { forwardQueryParams?: boolean } } }).Cal?.config?.forwardQueryParams)).toBe(true);
  const inline = await page.evaluate(() => {
    const cal = (window as unknown as { Cal: { ns: Record<string, { q: unknown[][] }> } }).Cal;
    return cal.ns.intro.q.map((args) => Array.from(args as ArrayLike<unknown>)).find((a) => a[0] === "inline")?.[1] as { calLink: string; config: Record<string, string> };
  });
  expect(inline.calLink).toBe("cipherframe/intro");
  expect(inline.config).toMatchObject({ layout: "month_view", theme: "dark", c: "Arclight", t: "mainnet", utm_campaign: "dm1" });
  const fallback = page.locator("[data-cal-fallback]");
  await expect(fallback).toBeVisible();
  await expect(fallback).toHaveText("Calendar not loading? Open it in your browser →");
  const u = new URL((await fallback.getAttribute("href"))!);
  expect(u.origin + u.pathname).toBe("https://cal.com/cipherframe/intro");
  expect(u.searchParams.get("utm_source")).toBe("x");
});

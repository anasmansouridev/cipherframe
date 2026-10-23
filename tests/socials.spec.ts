import { expect, test } from "@playwright/test";
import { CONFIG } from "../src/config.ts";
import { hermetic } from "./helpers";

/**
 * Social accounts are optional. Whatever is left empty in src/config.ts must disappear from the
 * page cleanly: no "Message  on X" line, no empty links, no empty meta tag. Works for any config.
 */
const s = CONFIG.social;
const hasX = Boolean(s.xHandle && (s.xDmUrl || s.xUrl));

test("socials · empty handles leave no dead UI; set handles appear", async ({ page }) => {
  await hermetic(page);
  await page.goto("/");

  await expect(page.locator(".book__dm")).toHaveCount(hasX ? 1 : 0);
  await expect(page.locator("meta[name='twitter:site']")).toHaveCount(s.xHandle ? 1 : 0);

  // No link anywhere points nowhere
  const dead = await page.locator("a").evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute("href")).filter((h) => !h || h === "#"));
  expect(dead).toEqual([]);

  // The official-accounts box lists only what is configured, and always the site itself
  const box = page.locator("#official");
  await expect(box).toContainText(new URL(CONFIG.domain).host);
  await expect(box.locator("a[href*='x.com'], a[href*='twitter.com']")).toHaveCount(s.xHandle && s.xUrl ? 1 : 0);
  await expect(box.locator("a[href*='t.me']")).toHaveCount(s.telegramHandle && s.telegramUrl ? 1 : 0);
  await expect(box.locator("a[href*='linkedin.com']")).toHaveCount(s.linkedinUrl ? 1 : 0);
});

test("socials · the footer email is on the site's own domain", async ({ page }) => {
  await hermetic(page);
  await page.goto("/");
  const host = new URL(CONFIG.domain).host;
  await expect(page.locator(".footer__email a")).toHaveAttribute("href", `mailto:${CONFIG.email}`);
  expect(CONFIG.email.endsWith(`@${host}`), `email ${CONFIG.email} should be on ${host}`).toBe(true);
});

import { expect, test } from "@playwright/test";
import { hermetic } from "./helpers";

test("3 · ?c=Arclight&t=mainnet personalises the H1, chip and final H2", async ({ page }) => {
  await hermetic(page);
  await page.goto("/?c=Arclight&t=mainnet");
  await expect(page.locator("h1")).toHaveText("Arclight's mainnet deserves more than a JPEG.");
  await expect(page.locator("[data-p='chip']")).toBeVisible();
  await expect(page.locator("[data-p='chip']")).toHaveText("◆ Prepared for Arclight");
  await expect(page.locator("#book-title")).toHaveText("Arclight, your next announcement is already written. Make it move.");
});

test("3 · ?c only uses the 'next announcement' headline", async ({ page }) => {
  await hermetic(page);
  await page.goto("/?c=Arclight");
  await expect(page.locator("h1")).toHaveText("Arclight's next announcement deserves more than a JPEG.");
});

test("3 · hostile c and t produce default copy, no alert and no injected nodes", async ({ page }) => {
  await hermetic(page);
  let dialog = false;
  page.on("dialog", async (d) => {
    dialog = true;
    await d.dismiss();
  });
  await page.goto("/");
  const baseline = await page.evaluate(() => ({ scripts: document.scripts.length, imgs: document.images.length }));
  await page.goto("/?c=<script>alert(1)</script>&t=evil");
  await expect(page.locator("h1")).toHaveText("Stop launching into silence.");
  await expect(page.locator("[data-p='chip']")).toBeHidden();
  await expect(page.locator("#book-title")).toHaveText("Your next announcement is already written. Make it move.");
  const after = await page.evaluate(() => ({
    scripts: document.scripts.length,
    imgs: document.images.length,
    text: document.body.innerText.includes("alert(1)"),
    html: document.documentElement.outerHTML.includes("alert(1)"),
  }));
  expect(after.scripts).toBe(baseline.scripts);
  expect(after.imgs).toBe(baseline.imgs);
  expect(after.text).toBe(false);
  expect(after.html).toBe(false);
  await page.waitForTimeout(500);
  expect(dialog).toBe(false);
});

test("3 · t outside the whitelist is ignored", async ({ page }) => {
  await hermetic(page);
  await page.goto("/?c=Arclight&t=constructor");
  await expect(page.locator("h1")).toHaveText("Arclight's next announcement deserves more than a JPEG.");
});

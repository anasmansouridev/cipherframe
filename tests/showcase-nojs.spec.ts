import { expect, test } from "@playwright/test";

test.use({ javaScriptEnabled: false });

test("showcase · without script the card still shows both pictures, and the poster is the film box's background", async ({ page }) => {
  const posters: string[] = [];
  page.on("request", (r) => /honeyb_after_poster\.jpg/.test(r.url()) && posters.push(r.url()));
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/no-js/);
  await expect(page.locator(".ba__layer--static .post__media img")).toBeVisible();
  expect(await page.locator(".post__media--video").evaluate((el) => getComputedStyle(el).backgroundImage)).toContain("honeyb_after_poster.jpg");
  await page.locator("[data-ba]").scrollIntoViewIfNeeded();
  await expect.poll(() => posters.length).toBeGreaterThan(0);
  await expect(page.locator("[data-ba-sound]")).toBeHidden(); // nothing plays, so no sound control
});

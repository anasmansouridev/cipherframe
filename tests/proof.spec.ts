import { expect, test } from "@playwright/test";
import { hermetic } from "./helpers";

test("9 · testimonials and logos are absent from the DOM while their CONFIG arrays are empty", async ({ page }) => {
  await hermetic(page);
  await page.goto("/");
  await expect(page.locator("[data-testimonials], .testimonial")).toHaveCount(0);
  await expect(page.locator("[data-logos], .logos")).toHaveCount(0);
  await expect(page.locator("[data-remakes]")).toHaveCount(0);
  await expect(page.locator(".work .tag")).toHaveText(["CONCEPT", "CONCEPT", "CONCEPT"]);
});

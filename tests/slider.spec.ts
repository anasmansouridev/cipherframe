import { expect, test } from "@playwright/test";
import { hermetic, isMobile } from "./helpers";

test("8 · slider works with the keyboard (←/→ change aria-valuenow)", async ({ page }, info) => {
  test.skip(isMobile(info), "desktop slider (≥768px)");
  await hermetic(page);
  await page.goto("/");
  const handle = page.getByRole("slider", { name: "Compare static and motion" });
  await handle.scrollIntoViewIfNeeded();
  await handle.focus();
  await expect(handle).toHaveAttribute("aria-valuemin", "0");
  await expect(handle).toHaveAttribute("aria-valuemax", "100");
  await page.keyboard.press("ArrowLeft");
  await expect(handle).toHaveAttribute("aria-valuenow", "45");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(handle).toHaveAttribute("aria-valuenow", "55");
  const split = await page.locator("[data-ba]").evaluate((el) => (el as HTMLElement).style.getPropertyValue("--split"));
  expect(split).toBe("55%");
  const events = await page.evaluate(() => (window.cfEvents ?? []).map((e) => e.name));
  expect(events.filter((n) => n === "slider_interact")).toHaveLength(1);
});

test("8 · mobile toggle switches between Static and Motion", async ({ page }, info) => {
  test.skip(!isMobile(info), "mobile toggle (<768px)");
  await hermetic(page);
  await page.goto("/");
  const ba = page.locator("[data-ba]");
  await expect(ba).toHaveAttribute("data-state", "static");
  const motion = page.getByRole("button", { name: "Motion", exact: true });
  const still = page.getByRole("button", { name: "Static", exact: true });
  await motion.scrollIntoViewIfNeeded();
  await motion.click();
  await expect(ba).toHaveAttribute("data-state", "motion");
  await expect(motion).toHaveAttribute("aria-pressed", "true");
  await still.click();
  await expect(ba).toHaveAttribute("data-state", "static");
  await page.locator("[data-ba-frame]").click({ position: { x: 40, y: 40 } });
  await expect(ba).toHaveAttribute("data-state", "motion");
});

test("8 · mobile auto-switches to Motion after entering the viewport", async ({ page }, info) => {
  test.skip(!isMobile(info), "mobile toggle (<768px)");
  await hermetic(page);
  await page.goto("/");
  await page.locator("[data-ba-frame]").scrollIntoViewIfNeeded();
  await expect(page.locator("[data-ba]")).toHaveAttribute("data-state", "motion", { timeout: 4000 });
});

import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { hermetic, isMobile, scrollThrough } from "./helpers";

/**
 * Fails the build if the site drifts from the Cipherframe design system
 * (tokens, radii, no shadows, no mint↔blue gradients, no 3D, contrast).
 */

const forceTierA = (page: Page) =>
  page.addInitScript(() => ((window as unknown as { __CF_FORCE_TIER__: string }).__CF_FORCE_TIER__ = "A"));

const once = (name: string) => test.skip(name !== "chromium-1280x800", "runs once");
const twoViewports = (name: string) => test.skip(!["chromium-390x844", "chromium-1440x900"].includes(name), "two representative viewports");

test("brand 1 · Button/Primary is signal-mint with a cta-ink label", async ({ page }) => {
  await hermetic(page);
  await page.goto("/");
  for (const sel of [".hero__ctas .btn--primary", "#desk .btn--primary", ".price--featured .btn--primary"]) {
    const s = await page.locator(sel).evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color }));
    expect(s.bg, sel).toBe("rgb(43, 228, 160)");
    expect(s.color, sel).toBe("rgb(4, 20, 13)");
  }
});

test("brand 2 · radii: glass card 14px, button 10px; buttons 48px tall (56px for phone primary CTAs)", async ({ page }, info) => {
  await hermetic(page);
  await page.goto("/");
  const radius = (sel: string) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
  expect(await radius(".pain.glass")).toBe("14px");
  expect(await radius(".price.glass")).toBe("14px");
  expect(await radius(".btn--primary")).toBe("10px");
  expect(await radius(".btn--secondary")).toBe("10px");
  expect(await radius(".tag")).toBe("6px");
  const height = (sel: string) => page.locator(sel).first().evaluate((el) => Math.round(el.getBoundingClientRect().height));
  const phone = isMobile(info);
  expect(await height(".hero__ctas .btn--primary")).toBe(phone ? 56 : 48);
  expect(await height(".hero__ctas .btn--secondary")).toBe(phone ? 56 : 48);
  expect(await height("#book .option .btn")).toBe(phone ? 56 : 48);
  expect(await height("#desk .btn--primary")).toBe(48);
  expect(await height("#guarantee .btn--primary")).toBe(48);
  expect(await height(".price .btn")).toBe(48);
  expect(await page.locator(".pill").first().evaluate((el) => Math.round(el.getBoundingClientRect().height))).toBe(28);
  expect(await page.locator(".tag").first().evaluate((el) => Math.round(el.getBoundingClientRect().height))).toBe(24);
});

test("brand 3 · no element has a box-shadow", async ({ page }, info) => {
  twoViewports(info.project.name);
  await hermetic(page);
  await forceTierA(page);
  await page.goto("/?c=Arclight&t=mainnet");
  await scrollThrough(page);
  await page.waitForTimeout(800);
  const offenders = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll("*"))) {
      for (const pseudo of [null, "::before", "::after"] as const) {
        const v = getComputedStyle(el, pseudo).boxShadow;
        if (v && v !== "none") out.push(`${el.tagName.toLowerCase()}.${(el as HTMLElement).className}${pseudo ?? ""}: ${v}`);
      }
    }
    return out;
  });
  expect(offenders).toEqual([]);
});

test("brand 4 · no gradient mixes signal-mint and packet-blue, and no conic-gradient exists", async ({ page }, info) => {
  twoViewports(info.project.name);
  await hermetic(page);
  await forceTierA(page);
  await page.goto("/");
  await scrollThrough(page);
  const problems = await page.evaluate(() => {
    const MINT = /#2be4a0|rgba?\(\s*43,\s*228,\s*160/i;
    const BLUE = /#7b9bff|rgba?\(\s*123,\s*155,\s*255/i;
    const out: string[] = [];
    const texts: string[] = [];
    const walk = (rules: CSSRuleList) => {
      for (const r of Array.from(rules)) {
        if ("cssRules" in r && (r as CSSGroupingRule).cssRules?.length) walk((r as CSSGroupingRule).cssRules);
        texts.push(r.cssText);
      }
    };
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        walk(sheet.cssRules);
      } catch {
        /* cross-origin sheet */
      }
    }
    document.querySelectorAll<HTMLElement>("[style]").forEach((el) => texts.push(el.getAttribute("style") ?? ""));
    for (const t of texts) {
      if (/conic-gradient/i.test(t)) out.push(`conic-gradient: ${t.slice(0, 120)}`);
      for (const g of t.match(/(?:repeating-)?(?:linear|radial)-gradient\((?:[^()]|\([^()]*\))*\)/gi) ?? [])
        if (MINT.test(g) && BLUE.test(g)) out.push(`mint↔blue gradient: ${g}`);
    }
    // SVG gradients
    document.querySelectorAll("linearGradient, radialGradient").forEach((g) => {
      const stops = Array.from(g.querySelectorAll("stop")).map((s) => s.getAttribute("stop-color") ?? "");
      if (stops.some((c) => MINT.test(c)) && stops.some((c) => BLUE.test(c))) out.push(`svg gradient #${g.id}`);
    });
    return out;
  });
  expect(problems).toEqual([]);
});

test("brand 5 · no perspective, preserve-3d or rotateX/rotateY transforms (including on hover)", async ({ page }, info) => {
  twoViewports(info.project.name);
  await hermetic(page);
  await forceTierA(page);
  await page.goto("/");
  await scrollThrough(page);
  if (!isMobile(info)) {
    for (const sel of [".pillar", ".work", ".price--featured"]) {
      await page.locator(sel).first().scrollIntoViewIfNeeded();
      const box = (await page.locator(sel).first().boundingBox())!;
      await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.2, { steps: 4 });
      await page.waitForTimeout(150);
    }
  }
  const offenders = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const cs = getComputedStyle(el);
      const name = `${el.tagName.toLowerCase()}.${(el as HTMLElement).className}`;
      if (cs.perspective !== "none") out.push(`${name} perspective ${cs.perspective}`);
      if (cs.transformStyle === "preserve-3d") out.push(`${name} preserve-3d`);
      if (cs.transform.startsWith("matrix3d")) out.push(`${name} ${cs.transform}`);
      if (/rotate[XY]\(/i.test((el as HTMLElement).getAttribute?.("style") ?? "")) out.push(`${name} inline rotateX/Y`);
    }
    return out;
  });
  expect(offenders).toEqual([]);
});

test("brand 6 · none of the old token names survive (build output and sources)", () => {
  once(test.info().project.name);
  const OLD = ["--bg", "--surface", "--line", "--text", "--muted", "--mint", "--blue", "--coral", "--r-card", "--r-btn", "--r-pill", "--grad-signal"];
  const re = new RegExp(`(?<![\\w-])(${OLD.map((o) => o.replace(/-/g, "\\-")).join("|")})(?![\\w-])`);
  const files: string[] = [];
  const collect = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) collect(p);
      else if (/\.(css|ts|html|mjs|js)$/.test(e.name) && e.name !== "brand.spec.ts") files.push(p); // this file lists the old names
    }
  };
  for (const d of ["dist", "src", "scripts", "tests"]) collect(path.resolve(d));
  files.push(path.resolve("index.html"));
  const hits = files.flatMap((f) => {
    const m = fs.readFileSync(f, "utf8").match(re);
    return m ? [`${path.relative(process.cwd(), f)}: ${m[1]}`] : [];
  });
  expect(hits).toEqual([]);
  // The main stylesheet defines the design-system tokens (the lazy grain chunk has none)
  const main = fs.readdirSync(path.resolve("dist/assets")).filter((f) => /^index-.*\.css$/.test(f));
  expect(main).toHaveLength(1);
  const css = fs.readFileSync(path.resolve("dist/assets", main[0]), "utf8");
  for (const token of ["--midnight", "--ice", "--steel", "--signal-mint", "--packet-blue", "--alert-coral", "--radius-card", "--focus-ring"])
    expect(css, token).toContain(token);
});

test("brand 7 · Button/Ghost has a 1px steel border that turns ice on hover", async ({ page }, info) => {
  await hermetic(page);
  await page.goto("/");
  const ghost = page.locator(".hero__ctas .btn--secondary");
  const border = () => ghost.evaluate((el) => ({ color: getComputedStyle(el).borderTopColor, width: getComputedStyle(el).borderTopWidth }));
  expect(await border()).toEqual({ color: "rgb(163, 175, 198)", width: "1px" });
  if (!isMobile(info)) {
    await ghost.hover();
    await expect.poll(async () => (await border()).color).toBe("rgb(234, 240, 250)");
  }
});

test("brand 8 · contrast: text pairs ≥ 4.5:1; control border and focus ring ≥ 3:1", async ({ page }, info) => {
  twoViewports(info.project.name);
  await hermetic(page);
  await page.goto("/");
  // The real focus ring, read from a keyboard-focused primary button
  await page.keyboard.press("Tab");
  await page.locator(".hero__ctas .btn--primary").focus();
  const ring = await page.locator(".hero__ctas .btn--primary").evaluate((el) => {
    const cs = getComputedStyle(el);
    return { color: cs.outlineColor, width: cs.outlineWidth, offset: cs.outlineOffset };
  });
  expect(ring).toEqual({ color: "rgb(123, 155, 255)", width: "2px", offset: "2px" });

  const result = await page.evaluate((ringColor) => {
    type RGBA = [number, number, number, number];
    const parse = (v: string): RGBA => {
      v = v.trim();
      const hex = v.match(/^#([0-9a-f]{3,8})$/i);
      if (hex) {
        let h = hex[1];
        if (h.length <= 4) h = [...h].map((c) => c + c).join("");
        const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
        return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
      }
      const p = v.match(/rgba?\(([^)]+)\)/)![1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return [p[0], p[1], p[2], p[3] ?? 1];
    };
    const over = (top: RGBA, bottom: RGBA): RGBA => {
      const a = top[3] + bottom[3] * (1 - top[3]);
      return [0, 1, 2].map((i) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / a).concat(a) as RGBA;
    };
    const lum = ([r, g, b]: RGBA) => {
      const f = (x: number) => ((x /= 255) <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a: RGBA, b: RGBA) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    const root = getComputedStyle(document.documentElement);
    const v = (n: string) => parse(root.getPropertyValue(n));
    const midnight = v("--midnight");
    const glass = over([23, 33, 63, 0.55], midnight);
    const pairs: [string, RGBA, RGBA, number][] = [
      ["ice / midnight", v("--ice"), midnight, 4.5],
      ["steel / midnight", v("--steel"), midnight, 4.5],
      ["signal-mint / midnight", v("--signal-mint"), midnight, 4.5],
      ["cta-ink / signal-mint", v("--cta-ink"), v("--signal-mint"), 4.5],
      ["packet-blue / midnight", v("--packet-blue"), midnight, 4.5],
      ["alert-coral / midnight", v("--alert-coral"), midnight, 4.5],
      ["ice / glass", v("--ice"), glass, 4.5],
      ["steel / glass", v("--steel"), glass, 4.5],
      ["steel / panel", v("--steel"), v("--panel"), 4.5],
      ["CONFIRMED: mint / mint-wash", v("--signal-mint"), over(v("--mint-wash"), midnight), 4.5],
      ["IN FLIGHT: blue / blue-wash", v("--packet-blue"), over(v("--blue-wash"), midnight), 4.5],
      ["REVERTED: coral / coral-wash", v("--alert-coral"), over(v("--coral-wash"), midnight), 4.5],
      ["ghost button border (steel) / midnight", v("--steel"), midnight, 3],
      ["focus ring / midnight", parse(ringColor), midnight, 3],
    ];
    return pairs.map(([name, fg, bg, min]) => ({ name, ratio: Math.round(ratio(fg, bg) * 100) / 100, min }));
  }, ring.color);
  for (const r of result) expect(r.ratio, `${r.name} = ${r.ratio}:1`).toBeGreaterThanOrEqual(r.min);
  // The rendered pills use exactly these washes
  const pills = await page.evaluate(() =>
    ["pill--mint", "pill--blue", "pill--coral"].map((c) => {
      const el = document.querySelector(`.${c}`)!;
      return getComputedStyle(el).backgroundColor;
    }),
  );
  expect(pills).toEqual(["rgba(43, 228, 160, 0.12)", "rgba(123, 155, 255, 0.12)", "rgba(255, 107, 87, 0.12)"]);
});

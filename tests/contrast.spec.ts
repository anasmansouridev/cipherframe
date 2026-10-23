import { expect, test } from "@playwright/test";
import { hermetic, scrollThrough } from "./helpers";

/**
 * Text contrast ≥ 4.5:1 (3:1 for large text), including on glass. Composites every
 * ancestor's background colour and gradient layers over --midnight, then checks each visible text node.
 * Runs with Tier A forced, where glass is most transparent (the worst case).
 */
test("contrast: every visible text node passes WCAG AA on its composited background", async ({ page }, info) => {
  test.skip(!["chromium-390x844", "chromium-1440x900"].includes(info.project.name), "two representative viewports");
  await hermetic(page);
  await page.addInitScript(() => ((window as unknown as { __CF_FORCE_TIER__: string }).__CF_FORCE_TIER__ = "A"));
  await page.goto("/?c=Arclight&t=mainnet");
  await scrollThrough(page);
  await page.waitForTimeout(1500);
  const failures = await page.evaluate(() => {
    type RGBA = [number, number, number, number];
    const parse = (c: string): RGBA | null => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return c === "transparent" ? [0, 0, 0, 0] : null;
      const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return [p[0], p[1], p[2], p[3] ?? 1];
    };
    const over = (top: RGBA, bottom: RGBA): RGBA => {
      const a = top[3] + bottom[3] * (1 - top[3]);
      if (!a) return [0, 0, 0, 0];
      return [0, 1, 2].map((i) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / a).concat(a) as RGBA;
    };
    const lum = ([r, g, b]: RGBA) => {
      const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a: RGBA, b: RGBA) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    const gradientAvg = (img: string): RGBA | null => {
      if (!img || img === "none" || img.includes("url(")) return null;
      const stops = [...img.matchAll(/rgba?\([^)]+\)/g)].map((m) => parse(m[0])!);
      if (!stops.length) return null;
      const n = stops.length;
      return [0, 1, 2, 3].map((i) => stops.reduce((s, c) => s + c[i], 0) / n) as RGBA;
    };
    const backgroundOf = (el: Element): RGBA => {
      const chain: Element[] = [];
      for (let e: Element | null = el; e; e = e.parentElement) chain.unshift(e);
      let bg: RGBA = [10, 15, 30, 1];
      for (const e of chain) {
        const cs = getComputedStyle(e);
        const color = parse(cs.backgroundColor);
        if (color && color[3] > 0) bg = over(color, bg);
        const grad = gradientAvg(cs.backgroundImage);
        if (grad && grad[3] > 0) bg = over(grad, bg);
      }
      return bg;
    };
    const visible = (el: Element) => {
      for (let e: Element | null = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.99) return false;
        if (cs.clip === "rect(0px, 0px, 0px, 0px)" || (cs.position === "absolute" && e.classList.contains("sr-only"))) return false;
      }
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    };
    const out: string[] = [];
    let checked = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set<Element>();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || seen.has(el) || !n.textContent?.trim()) continue;
      seen.add(el);
      if (el.closest("script, style, svg, .grain, .skip, [data-cal-embed]") || !visible(el)) continue;
      const cs = getComputedStyle(el);
      const bg = backgroundOf(el);
      const fg = over(parse(cs.color)!, bg);
      const size = parseFloat(cs.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
      const r = ratio(fg, bg);
      checked++;
      if (r < (large ? 3 : 4.5)) out.push(`${r.toFixed(2)} "${n.textContent.trim().slice(0, 40)}" <${el.tagName.toLowerCase()} class="${el.className}">`);
    }
    return { out, checked };
  });
  expect(failures.checked, "the walker must actually check the page").toBeGreaterThan(150);
  expect(failures.out).toEqual([]);
});

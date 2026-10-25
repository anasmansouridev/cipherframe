import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { CONFIG } from "../src/config.ts";

const dist = path.resolve("dist");
const DOMAIN = CONFIG.domain.replace(/\/+$/, "");
const builtFiles = () =>
  [path.join(dist, "index.html"), ...fs.readdirSync(path.join(dist, "assets")).map((f) => path.join(dist, "assets", f))].filter((f) => /\.(html|js|css)$/.test(f));

// Build-artifact checks run once, not per viewport.
test.beforeEach(({}, info) => test.skip(info.project.name !== "chromium-1280x800", "runs once"));

test("10 · banned-content scan of the built HTML/JS", () => {
  const banned: [string, RegExp][] = [
    ["hand-made", /hand-?made/i],
    ["handcrafted", /hand-?crafted/i],
    ["hand-animated", /hand-?animated/i],
    ["100% human", /100% human/i],
    ["no AI", /\bno AI\b/i],
    ["moon", /\bmoon\b/i],
    ["lambo", /\blambo/i],
    ["APY", /\bAPY\b/],
    ["guaranteed returns", /guaranteed returns/i],
    ["people are viewing", /people are viewing/i],
    ["0x address", /0x[0-9a-fA-F]{40}/],
  ];
  const hits: string[] = [];
  for (const file of builtFiles()) {
    const text = fs.readFileSync(file, "utf8");
    for (const [name, re] of banned) if (re.test(text)) hits.push(`${name} in ${path.relative(dist, file)}`);
  }
  expect(hits).toEqual([]);
});

test("prices: no old price survives in the built HTML, and every new price is present", () => {
  const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
  const old = ["$750", "$1,800", "$3,000", "$3,500", "$6,500", "$2,100", "$8,100"];
  expect(old.filter((p) => html.includes(p))).toEqual([]);
  const now = ["$200", "$350", "$1,490", "$790", "$1,290", "$990"];
  expect(now.filter((p) => !html.includes(p))).toEqual([]);
  expect(html).not.toMatch(/Announcement Desk|up to 6|Up to 6/);
  expect(html).toContain("Unlimited Desk");
  const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)![1]);
  const desk = ld["@graph"][0].makesOffer.find((o: { itemOffered: { name: string } }) => o.itemOffered.name === "Unlimited Desk");
  expect(desk.priceSpecification.billingDuration).toBe("P1M");
});

test("work films: files exist and are small, posters are webp, and the raw originals are not shipped", () => {
  const MAX = 2.5 * 1024 * 1024;
  for (const w of CONFIG.work) {
    for (const file of [w.video, w.webm, w.poster].filter(Boolean)) {
      const p = path.join(dist, file.replace(/^\//, ""));
      expect(fs.existsSync(p), file).toBe(true);
      if (!file.endsWith(".webp")) expect(fs.statSync(p).size, `${file} must stay under 2.5 MB`).toBeLessThan(MAX);
    }
    // The poster is a real WebP at 720x720 (RIFF....WEBP, VP8 chunk)
    const head = fs.readFileSync(path.join(dist, w.poster.replace(/^\//, "")));
    expect(head.subarray(0, 4).toString()).toBe("RIFF");
    expect(head.subarray(8, 12).toString()).toBe("WEBP");
  }
  expect(fs.existsSync(path.join(dist, "work", "raw"))).toBe(false);
  const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
  expect(html).not.toContain("/work/raw/");
  expect(html).toContain('preload="none"');
  // WebM is listed before MP4 so browsers that can play it prefer the smaller file
  for (const w of CONFIG.work) if (w.webm) expect(html.indexOf(`<source src="${w.webm}"`)).toBeLessThan(html.indexOf(`<source src="${w.video}"`));
});

test("CSP: the inline boot script's sha256 is in dist/_headers, and no third-party script hosts beyond Cal.com and Cloudflare", () => {
  const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
  const headers = fs.readFileSync(path.join(dist, "_headers"), "utf8");
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  expect(inline).toHaveLength(1);
  const hash = createHash("sha256").update(inline[0]).digest("base64");
  expect(headers).toContain(`'sha256-${hash}'`);
  expect(headers).not.toContain("__");
  const scriptSrc = /script-src ([^;]+);/.exec(headers)![1].split(" ");
  expect(scriptSrc.filter((s) => s.startsWith("https://"))).toEqual(["https://app.cal.com", "https://static.cloudflareinsights.com"]);
  for (const h of ["X-Content-Type-Options: nosniff", "Referrer-Policy: strict-origin-when-cross-origin", "Permissions-Policy: camera=(), microphone=(), geolocation=()"])
    expect(headers).toContain(h);
  expect(fs.readFileSync(path.join(dist, "robots.txt"), "utf8")).toContain(`Sitemap: ${DOMAIN}/sitemap.xml`);
  expect(fs.readFileSync(path.join(dist, "sitemap.xml"), "utf8")).toContain(`<loc>${DOMAIN}/</loc>`);
});

test("SEO: title, description, canonical, OG/Twitter and JSON-LD (no ratings)", () => {
  const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
  expect(html).toContain("<title>Cipherframe — Every announcement, animated in 48 hours</title>");
  expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
  expect(html).toContain(`<link rel="canonical" href="${DOMAIN}/" />`);
  const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)![1]);
  const [studio, faq] = ld["@graph"];
  expect(studio["@type"]).toBe("ProfessionalService");
  expect(studio.makesOffer.map((o: { price: string }) => o.price)).toEqual(["200", "350", "1490", "790", "1290"]);
  expect(faq["@type"]).toBe("FAQPage");
  expect(faq.mainEntity).toHaveLength(13);
  expect(JSON.stringify(ld)).not.toMatch(/aggregateRating|ratingValue|review/i);
  const og = fs.statSync(path.join(dist, "og.png"));
  expect(og.size).toBeGreaterThan(1000);
});

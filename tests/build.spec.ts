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
  expect(studio.makesOffer.map((o: { price: string }) => o.price)).toEqual(["750", "1800", "3000", "3500", "6500"]);
  expect(faq["@type"]).toBe("FAQPage");
  expect(faq.mainEntity).toHaveLength(13);
  expect(JSON.stringify(ld)).not.toMatch(/aggregateRating|ratingValue|review/i);
  const og = fs.statSync(path.join(dist, "og.png"));
  expect(og.size).toBeGreaterThan(1000);
});

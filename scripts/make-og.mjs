// Renders public/og.png (1200×630) from HTML with the self-hosted fonts. Run: node scripts/make-og.mjs
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

// setContent pages can't read file:// URLs, so the fonts go in as data URIs.
const font = (p) => `data:font/woff2;base64,${fs.readFileSync(path.resolve("node_modules/@fontsource", p)).toString("base64")}`;
const html = `<!doctype html><html><head><style>
@font-face{font-family:SG;src:url(${font("space-grotesk/files/space-grotesk-latin-600-normal.woff2")})}
@font-face{font-family:JB;src:url(${font("jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2")})}
@font-face{font-family:IN;src:url(${font("inter/files/inter-latin-400-normal.woff2")})}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#0A0F1E;color:#EAF0FA;font-family:IN;position:relative;overflow:hidden}
.grid{position:absolute;inset:0;background-image:linear-gradient(to right,rgba(38,50,79,.35) 1px,transparent 1px),linear-gradient(to bottom,rgba(38,50,79,.35) 1px,transparent 1px);background-size:40px 40px;-webkit-mask-image:radial-gradient(ellipse 70% 80% at 70% 50%,#000 20%,transparent 75%)}
.a1{position:absolute;width:900px;height:900px;left:-300px;top:-450px;background:radial-gradient(circle,rgba(43,228,160,.14),transparent 62%)}
.a2{position:absolute;width:900px;height:900px;right:-350px;top:-150px;background:radial-gradient(circle,rgba(123,155,255,.12),transparent 62%)}
.wrap{position:absolute;left:80px;top:72px;right:80px;bottom:64px;display:flex;flex-direction:column}
.logo{display:flex;align-items:center;gap:14px;font:600 34px SG;letter-spacing:-.02em}
.eyebrow{margin-top:64px;font:500 18px JB;letter-spacing:.08em;color:#2BE4A0}
h1{margin-top:18px;font:600 70px/1.02 SG;letter-spacing:-.03em;max-width:720px}
.u{position:relative;white-space:nowrap}.u:after{content:"";position:absolute;left:0;right:0;bottom:-8px;height:6px;border-radius:6px;background:#2BE4A0}
.foot{margin-top:auto;font:500 18px JB;color:#A3AFC6;letter-spacing:.03em}
svg.hex{position:absolute;right:90px;top:150px}
</style></head><body><div class="grid"></div><div class="a1"></div><div class="a2"></div>
<svg class="hex" width="330" height="330" viewBox="0 0 330 330"><defs><radialGradient id="g"><stop offset="0" stop-color="#2BE4A0" stop-opacity=".35"/><stop offset="1" stop-color="#2BE4A0" stop-opacity="0"/></radialGradient></defs>
<circle cx="165" cy="165" r="165" fill="url(#g)"/><path d="M165 40 273 102.5v125L165 290 57 227.5v-125Z" fill="rgba(43,228,160,.06)" stroke="#2BE4A0" stroke-width="4"/>
<g transform="translate(95 95) scale(5)"><path d="M8 4H4v20h4" fill="none" stroke="#EAF0FA" stroke-width="2.5"/><path d="M20 4h4v20h-4" fill="none" stroke="#EAF0FA" stroke-width="2.5"/><path d="M14 8.5 19.5 14 14 19.5 8.5 14Z" fill="#2BE4A0"/></g></svg>
<div class="wrap">
<div class="logo"><svg width="40" height="40" viewBox="0 0 28 28"><path d="M8 4H4v20h4" fill="none" stroke="#EAF0FA" stroke-width="2.5"/><path d="M20 4h4v20h-4" fill="none" stroke="#EAF0FA" stroke-width="2.5"/><path d="M14 8.5 19.5 14 14 19.5 8.5 14Z" fill="#2BE4A0"/></svg>cipherframe</div>
<div class="eyebrow">MOTION DESIGN FOR CRYPTO TEAMS WHO SHIP</div>
<h1>Every announcement, animated in 48 <span class="u">hours.</span></h1>
<div class="foot">Flat prices from $200 · Paid in USDC or card</div>
</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: "public/og.png" });
await browser.close();
console.log("public/og.png written");

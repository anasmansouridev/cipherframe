// Lighthouse, mobile emulation with simulated throttling, against the production build.
// Usage: npm run build && npm run lighthouse   (CHROME_PATH overrides the browser)
import { spawn } from "node:child_process";
import fs from "node:fs";
import { chromium } from "@playwright/test";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

const PORT = 4174;
const base = `http://localhost:${PORT}`;
const urls = [`${base}/`, `${base}/?c=Arclight&t=mainnet&utm_source=x&utm_medium=dm&utm_campaign=dm1`];
const targets = { performance: 90, accessibility: 95, "best-practices": 95, seo: 95 };

const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
const waitFor = async (url, tries = 60) => {
  for (let i = 0; i < tries; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server did not start at ${url}`);
};

let failed = false;
const results = [];
try {
  await waitFor(base);
  const chrome = await chromeLauncher.launch({
    chromePath: process.env.CHROME_PATH || chromium.executablePath(),
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
  });
  for (const url of urls) {
    const runs = [];
    for (let i = 0; i < 3; i++) {
      const { lhr, report } = await lighthouse(url, { port: chrome.port, output: "html", logLevel: "error" });
      runs.push({ lhr, report });
    }
    // Median run by performance score
    runs.sort((a, b) => a.lhr.categories.performance.score - b.lhr.categories.performance.score);
    const { lhr, report } = runs[1];
    const name = url === urls[0] ? "default" : "personalised";
    fs.writeFileSync(`lighthouse-${name}.html`, report);
    const scores = Object.fromEntries(Object.entries(lhr.categories).map(([k, v]) => [k, Math.round(v.score * 100)]));
    const metrics = {
      LCP: lhr.audits["largest-contentful-paint"].displayValue,
      CLS: lhr.audits["cumulative-layout-shift"].displayValue,
      TBT: lhr.audits["total-blocking-time"].displayValue,
      FCP: lhr.audits["first-contentful-paint"].displayValue,
      SI: lhr.audits["speed-index"].displayValue,
    };
    results.push({ name, url, scores, metrics, allPerf: runs.map((r) => Math.round(r.lhr.categories.performance.score * 100)) });
    console.log(`\n${name}: ${url}`);
    for (const [k, min] of Object.entries(targets)) {
      const ok = scores[k] >= min;
      failed ||= !ok;
      console.log(`  ${ok ? "✓" : "✗"} ${k.padEnd(15)} ${scores[k]} (target ≥ ${min})`);
    }
    console.log(`  LCP ${metrics.LCP} · CLS ${metrics.CLS} · TBT ${metrics.TBT} · FCP ${metrics.FCP} · SI ${metrics.SI}`);
    console.log(`  performance across 3 runs: ${runs.map((r) => Math.round(r.lhr.categories.performance.score * 100)).join(", ")}`);
    const fails = Object.values(lhr.audits).filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode === "binary");
    if (fails.length) console.log(`  failing audits: ${fails.map((a) => a.id).join(", ")}`);
  }
  await chrome.kill();
} finally {
  server.kill();
}
fs.writeFileSync("lighthouse-summary.json", JSON.stringify(results, null, 2));
if (failed) process.exit(1);

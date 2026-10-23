// Prints gzipped sizes of the build and enforces the budgets (initial JS ≤ 90 KB, CSS ≤ 35 KB, fonts ≤ 120 KB).
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const dist = path.resolve("dist");
const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const gz = (buf) => zlib.gzipSync(buf, { level: 9 }).length;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const files = fs.readdirSync(path.join(dist, "assets")).map((f) => path.join("assets", f));

const initialRefs = new Set(
  [...html.matchAll(/(?:src|href)="\/?(assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]),
);
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("");
const rows = [];
let initialJs = gz(Buffer.from(inline));
let css = 0;
let fonts = 0;
for (const f of files) {
  const buf = fs.readFileSync(path.join(dist, f));
  const size = gz(buf);
  const ext = path.extname(f);
  const initial = initialRefs.has(f);
  if (ext === ".js" && initial) initialJs += size;
  if (ext === ".css") css += size;
  if (ext === ".woff2") fonts += buf.length;
  rows.push({ file: f, gzip: ext === ".woff2" ? buf.length : size, kind: ext === ".woff2" ? "font (raw)" : initial ? "initial" : ext === ".js" ? "lazy" : "asset" });
}
rows.sort((a, b) => b.gzip - a.gzip);
console.log("\nBundle report (gzip -9)");
for (const r of rows) console.log(`  ${r.kind.padEnd(10)} ${kb(r.gzip).padStart(9)}  ${r.file}`);
console.log(`  inline boot script ${kb(gz(Buffer.from(inline)))}`);
console.log(`  HTML ${kb(gz(Buffer.from(html)))}`);
const budgets = [
  ["Initial JS", initialJs, 90 * 1024],
  ["CSS", css, 35 * 1024],
  ["Fonts", fonts, 120 * 1024],
];
let fail = false;
for (const [name, value, max] of budgets) {
  const ok = value <= max;
  fail ||= !ok;
  console.log(`${ok ? "✓" : "✗"} ${name}: ${kb(value)} (budget ${kb(max)})`);
}
fs.writeFileSync(path.join(dist, "..", "bundle-report.json"), JSON.stringify({ initialJs, css, fonts, rows }, null, 2));
if (fail) process.exit(1);

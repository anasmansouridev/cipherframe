// Encodes the Work-section films for the web from the originals in public/work/raw/<slug>.mp4:
//   public/work/<slug>.mp4          H.264 720x720 30fps CRF 26, AAC 128k, +faststart
//   public/work/<slug>.webm         VP9 + Opus (the page lists it first; kept only if not larger than 1.25× the MP4)
//   public/work/<slug>-poster.webp  720x720 poster from the final logo frame (~4.6s)
// Needs ffmpeg with libx264, libvpx-vp9, libopus and libwebp on PATH (or FFMPEG=/path/to/ffmpeg).
// The raw files are committed but never shipped: the build deletes dist/work/raw.
// Usage: npm run work            (all slugs)   |   npm run work -- spout 0xbow
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ffmpeg = process.env.FFMPEG || "ffmpeg";
const rawDir = path.resolve("public/work/raw");
const outDir = path.resolve("public/work");
const POSTER_AT = process.env.POSTER_AT || "4.6";
const kb = (f) => `${(fs.statSync(f).size / 1024).toFixed(0)} KB`;

const slugs = process.argv.slice(2).length
  ? process.argv.slice(2)
  : fs.readdirSync(rawDir).filter((f) => f.endsWith(".mp4")).map((f) => f.replace(/\.mp4$/, ""));
if (!slugs.length) throw new Error(`no .mp4 files in ${rawDir}`);

function run(args) {
  const r = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "inherit", "inherit"] });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(" ")}`);
}

for (const slug of slugs) {
  const src = path.join(rawDir, `${slug}.mp4`);
  if (!fs.existsSync(src)) throw new Error(`missing ${src}`);
  const mp4 = path.join(outDir, `${slug}.mp4`);
  const webm = path.join(outDir, `${slug}.webm`);
  const poster = path.join(outDir, `${slug}-poster.webp`);
  const scale = "scale=720:720:flags=lanczos,fps=30,format=yuv420p";

  run(["-i", src, "-vf", scale, "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-profile:v", "high", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "128k", "-ar", "48000", mp4]);
  run(["-i", src, "-vf", scale, "-c:v", "libvpx-vp9", "-crf", "34", "-b:v", "0", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", "-c:a", "libopus", "-b:a", "96k", webm]);
  run(["-ss", POSTER_AT, "-i", src, "-frames:v", "1", "-vf", "scale=720:720:flags=lanczos", "-c:v", "libwebp", "-quality", "78", poster]);

  if (fs.statSync(webm).size > fs.statSync(mp4).size * 1.25) {
    fs.rmSync(webm);
    console.log(`${slug}: webm much larger than mp4, dropped`);
  }
  console.log(`${slug}: mp4 ${kb(mp4)}${fs.existsSync(webm) ? ` · webm ${kb(webm)}` : ""} · poster ${kb(poster)}`);
}

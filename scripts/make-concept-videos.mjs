// Encodes the "Studio concepts" films for the web from the originals in public/work/raw/concepts/<slug>.mp4:
//   public/work/<slug>.mp4   H.264 1280px wide, CRF 23, AAC 128k (kept when the original has sound), +faststart
//   public/work/<slug>.webm  VP9 + Opus (the page lists it first; Chrome, Edge and Firefox take it)
//   public/work/<slug>.jpg   1280px poster, about JPEG quality 80 (-q:v 6), from the frame named in POSTERS
// Each file must stay under MAX_BYTES: if the first pass is over, it re-encodes at 30 fps, then with a higher CRF.
// Needs ffmpeg with libx264, libvpx-vp9, libopus (on PATH, or FFMPEG=/path/to/ffmpeg). The raw originals are committed
// but never shipped: the build deletes dist/work/raw.
// Usage: npm run concepts            (all)   |   npm run concepts -- work-03-trezor-arc
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ffmpeg = process.env.FFMPEG || "ffmpeg";
const rawDir = path.resolve("public/work/raw/concepts");
const outDir = path.resolve("public/work");
const MAX_BYTES = 3 * 1000 * 1000;
// Seconds into the film, or "end" for its final frame.
const POSTERS = { "work-01-pinned": "1.0", "work-02-honeyb": "end", "work-03-trezor-arc": "6.9" };
const kb = (f) => `${(fs.statSync(f).size / 1000).toFixed(0)} KB`;

const slugs = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(POSTERS);

function run(args) {
  const r = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "inherit", "inherit"] });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(" ")}`);
}

/** Tries each setting in turn until the file is under MAX_BYTES; returns the one that was used. */
function encode(src, out, attempts, build) {
  for (const a of attempts) {
    run(build(a));
    if (fs.statSync(out).size <= MAX_BYTES) return a;
  }
  throw new Error(`${path.basename(out)} is still over ${MAX_BYTES} bytes after ${attempts.length} attempts`);
}

for (const slug of slugs) {
  const src = path.join(rawDir, `${slug}.mp4`);
  if (!fs.existsSync(src)) throw new Error(`missing ${src}`);
  const mp4 = path.join(outDir, `${slug}.mp4`);
  const webm = path.join(outDir, `${slug}.webm`);
  const poster = path.join(outDir, `${slug}.jpg`);
  const scale = (fps) => `scale=1280:-2:flags=lanczos${fps ? `,fps=${fps}` : ""},format=yuv420p`;

  const used = encode(src, mp4, [{ crf: 23 }, { crf: 23, fps: 30 }, { crf: 26, fps: 30 }], ({ crf, fps }) => [
    "-i", src, "-vf", scale(fps), "-c:v", "libx264", "-preset", "slow", "-crf", String(crf), "-profile:v", "high", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "128k", "-ar", "48000", mp4,
  ]);
  encode(src, webm, [{ crf: 33 }, { crf: 33, fps: 30 }, { crf: 37, fps: 30 }], ({ crf, fps }) => [
    "-i", src, "-vf", scale(fps), "-c:v", "libvpx-vp9", "-crf", String(crf), "-b:v", "0", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", "-c:a", "libopus", "-b:a", "96k", webm,
  ]);

  // The film is BT.709 limited range; JPEG is BT.601 full range. Without the explicit matrix the colours drift.
  const at = POSTERS[slug] ?? "1.0";
  const seek = at === "end" ? ["-sseof", "-0.05"] : ["-ss", at];
  run([...seek, "-i", src, "-frames:v", "1", "-update", "1", "-vf", "scale=1280:-2:flags=lanczos:in_color_matrix=bt709:in_range=tv:out_color_matrix=bt601:out_range=pc,format=yuvj420p", "-q:v", process.env.POSTER_Q || "6", poster]);

  console.log(`${slug}: mp4 ${kb(mp4)}${used.fps ? ` (${used.fps} fps, CRF ${used.crf})` : ` (CRF ${used.crf})`} · webm ${kb(webm)} · poster ${kb(poster)}`);
}

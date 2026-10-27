// Derives the web assets of the "See the difference" showcase from the two masters that are
// committed in public/showcase/<slug>/:
//   <slug>_before.png  1920x1080 static post (shipped as the <img> fallback)
//   <slug>_after.mp4   1920x1080 motion piece, H.264 + AAC, faststart (shipped as the Safari / iOS source)
// and writes next to them:
//   <slug>_before.webp        the static post as WebP
//   <slug>_after.webm         VP9 + Opus (the page lists it before the MP4)
//   <slug>_after_poster.jpg   the final frame of the film at 1280x720 (shown until it plays, and under reduced motion;
//                             browsers fetch it at page load, so it is kept small)
//   <slug>_avatar.png         256x256 logo on white for the post header (crop box below: logo bbox + padding)
// Needs ffmpeg with libvpx-vp9, libopus and libwebp on PATH (or FFMPEG=/path/to/ffmpeg).
// Usage: npm run showcase
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ffmpeg = process.env.FFMPEG || "ffmpeg";
const slug = "honeyb";
const dir = path.resolve("public/showcase", slug);
const kb = (f) => `${(fs.statSync(f).size / 1024).toFixed(0)} KB`;
const at = (name) => path.join(dir, `${slug}_${name}`);

// The static post's background (#FFF3DF) and the logo orange, used to key the avatar onto white.
const CREAM = { r: 255, g: 243, b: 223 };
const ORANGE = { r: 244, g: 112, b: 0 };
// 300x300 around the logo (bbox 866,279 to 1053,466), above the headline that starts at y 529.
const AVATAR_CROP = "crop=300:300:810:223";
// Alpha comes from the blue channel (cream 223 to orange 0); the result is the logo over white.
const alpha = `clip((${CREAM.b}-b(X,Y))/${CREAM.b},0,1)`;
const keyOnWhite = (c, ch) => `${ch}='255-${alpha}*(255-${c})'`;

function run(args) {
  const r = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "inherit", "inherit"] });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(" ")}`);
}

for (const f of ["before.png", "after.mp4"]) if (!fs.existsSync(at(f))) throw new Error(`missing ${at(f)}`);

run(["-i", at("before.png"), "-c:v", "libwebp", "-quality", "84", "-compression_level", "6", at("before.webp")]);
run(["-i", at("after.mp4"), "-c:v", "libvpx-vp9", "-crf", "36", "-b:v", "0", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", "-pix_fmt", "yuv420p", "-c:a", "libopus", "-b:a", "96k", at("after.webm")]);
// The film is BT.709 limited range; JPEG is BT.601 full range. Without the explicit matrix the orange drifts duller.
run(["-sseof", "-0.05", "-i", at("after.mp4"), "-frames:v", "1", "-update", "1", "-vf", "scale=1280:-2:flags=lanczos:in_color_matrix=bt709:in_range=tv:out_color_matrix=bt601:out_range=pc,format=yuvj420p", "-q:v", "3", at("after_poster.jpg")]);
run([
  "-i", at("before.png"), "-frames:v", "1",
  "-vf", `${AVATAR_CROP},scale=256:256:flags=lanczos,format=gbrp,geq=${keyOnWhite(ORANGE.r, "r")}:${keyOnWhite(ORANGE.g, "g")}:b='255-${alpha}*(255-${ORANGE.b})',format=rgb24`,
  at("avatar.png"),
]);

for (const f of ["before.png", "before.webp", "after.mp4", "after.webm", "after_poster.jpg", "avatar.png"]) console.log(`${slug}_${f}`.padEnd(30), kb(at(f)));

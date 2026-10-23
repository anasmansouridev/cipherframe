/**
 * M1 Tier B: the same transaction field in Canvas 2D with ~600 particles.
 * No pointer interaction; the scroll-out convergence is a simple fade-scale.
 */
import { FIELD_W, HEX, PATHS, bezier, flashReject, rng, visibleLoop, type HeroController } from "./field";

function sprite(color: string, size: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

export function mountCanvas(host: HTMLElement, count = 600): HeroController | null {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  const blue = sprite("rgba(123,155,255,0.9)", 16);
  const mint = sprite("rgba(43,228,160,0.95)", 16);
  const coralSprite = sprite("rgba(255,107,87,1)", 24);

  const rand = rng(5);
  const ps = Array.from({ length: count }, () => ({
    path: Math.floor(rand() * 4),
    phase: rand(),
    speed: 0.11 + rand() * 0.08,
    size: 4 + rand() * 6,
    a: rand() * Math.PI * 2,
    r: 0.4 + rand() * 0.6,
    wob: rand() * Math.PI * 2,
  }));

  let scale = 1;
  const resize = () => {
    const r = host.getBoundingClientRect();
    if (!r.width) return;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    scale = (r.width * dpr) / FIELD_W;
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  let time = 0;
  let coralT = -1;
  let nextCoral = 2.5;
  let coralPath = 0;
  let flashed = false;

  const loop = visibleLoop(host, (dt) => {
    time += dt;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "lighter";
    for (const p of ps) {
      const t = (p.phase + time * p.speed) % 1;
      let x: number;
      let y: number;
      if (t < 0.78) {
        const k = t / 0.78;
        [x, y] = bezier(PATHS[p.path], k);
        const w = Math.sin(Math.PI * k);
        x += Math.sin(time * 1.4 + p.wob + k * 6) * 10 * w;
        y += Math.cos(time * 1.1 + p.wob + k * 5) * 12 * w;
      } else {
        const k = (t - 0.78) / 0.22;
        const ang = p.a + time * 0.8;
        const rad = (118 - 80 * k) * p.r;
        const d = PATHS[p.path][3];
        const m = Math.min(1, k / 0.4);
        x = d[0] + (HEX.x + Math.cos(ang) * rad - d[0]) * m;
        y = d[1] + (HEX.y + Math.sin(ang) * rad - d[1]) * m;
      }
      const alpha = Math.min(1, t / 0.06) * (1 - Math.max(0, (t - 0.92) / 0.08));
      ctx.globalAlpha = alpha * 0.85;
      const s = p.size * dpr;
      ctx.drawImage(t > 0.76 ? mint : blue, x * scale - s / 2, y * scale - s / 2, s, s);
    }
    if (coralT < 0 && time > nextCoral) {
      coralT = 0;
      coralPath = Math.floor(Math.random() * 4);
      flashed = false;
    }
    if (coralT >= 0) {
      coralT += dt / 1.8;
      const along = coralT < 0.62 ? 0.35 + (coralT / 0.62) * 0.65 : 1 - ((coralT - 0.62) / 0.38) * 0.3;
      const [x, y] = bezier(PATHS[coralPath], along);
      if (coralT >= 0.62 && !flashed) {
        flashed = true;
        flashReject(host, x, y);
      }
      ctx.globalAlpha = coralT < 0.62 ? Math.min(1, coralT * 6) : Math.max(0, 1 - (coralT - 0.62) / 0.38);
      const s = 20 * dpr;
      ctx.drawImage(coralSprite, x * scale - s / 2, y * scale - s / 2, s, s);
      if (coralT >= 1) {
        coralT = -1;
        nextCoral = time + 4.2 + Math.random() * 1.6;
      }
    }
    ctx.globalAlpha = 1;
  });

  requestAnimationFrame(() => host.classList.add("is-live"));

  return {
    kind: "canvas",
    setScroll(p: number) {
      const k = Math.min(1, Math.max(0, p / 0.9));
      canvas.style.opacity = String(1 - k);
      canvas.style.transform = `scale(${1 - k * 0.25})`;
    },
    destroy() {
      loop.stop();
      ro.disconnect();
      host.classList.remove("is-live");
      canvas.remove();
    },
  };
}


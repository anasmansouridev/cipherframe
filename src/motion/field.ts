/**
 * Shared geometry for the "transaction field" (hero + final CTA). Coordinates are in
 * field units: a 1000×900 box matching the SVG viewBox in index.html, so the canvas,
 * the static SVG and the HTML node labels always line up.
 */
export const FIELD_W = 1000;
export const FIELD_H = 900;
export const HEX = { x: 600, y: 450, r: 130 };

type P = [number, number];
/** Four cubic paths: WALLET, BRIDGE, POOL, VAULT → hexagon (same as .txfield__paths). */
export const PATHS: [P, P, P, P][] = [
  [[150, 150], [330, 150], [400, 400], [480, 430]],
  [[150, 370], [320, 370], [400, 440], [480, 445]],
  [[150, 560], [320, 560], [400, 470], [480, 460]],
  [[150, 770], [330, 770], [410, 510], [480, 475]],
];

export function bezier(path: [P, P, P, P], t: number): P {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * path[0][0] + b * path[1][0] + c * path[2][0] + d * path[3][0],
    a * path[0][1] + b * path[1][1] + c * path[2][1] + d * path[3][1],
  ];
}

/** Seeded PRNG so every render of the field looks the same. */
export function rng(seed = 7): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Points on the Cipherframe mark (28×28 viewBox), scaled and centred on the hexagon.
 * kind 0 = bracket stroke (text colour), 1 = diamond (mint).
 */
export function markTargets(count: number, rand: () => number, size = 330): Float32Array {
  const out = new Float32Array(count * 3);
  const s = size / 28;
  const map = (x: number, y: number): P => [HEX.x + (x - 14) * s, HEX.y + (y - 14) * s];
  const brackets: P[][] = [
    [[8, 4], [4, 4], [4, 24], [8, 24]],
    [[20, 4], [24, 4], [24, 24], [20, 24]],
  ];
  const segs: { a: P; b: P; len: number }[] = [];
  for (const line of brackets)
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i];
      const b = line[i + 1];
      segs.push({ a, b, len: Math.hypot(b[0] - a[0], b[1] - a[1]) });
    }
  const total = segs.reduce((n, sg) => n + sg.len, 0);
  for (let i = 0; i < count; i++) {
    let x: number;
    let y: number;
    let kind: number;
    if (rand() < 0.38) {
      let d = rand() * total;
      let sg = segs[0];
      for (const candidate of segs) {
        sg = candidate;
        if (d <= candidate.len) break;
        d -= candidate.len;
      }
      const k = Math.min(1, d / sg.len);
      x = sg.a[0] + (sg.b[0] - sg.a[0]) * k + (rand() - 0.5) * 0.9;
      y = sg.a[1] + (sg.b[1] - sg.a[1]) * k + (rand() - 0.5) * 0.9;
      kind = 0;
    } else {
      // Uniform point in the diamond M14 8.5 19.5 14 14 19.5 8.5 14Z (a square rotated 45°)
      const u = rand() - 0.5;
      const v = rand() - 0.5;
      const half = 5.5;
      x = 14 + (u - v) * half;
      y = 14 + (u + v) * half;
      kind = 1;
    }
    const [px, py] = map(x, y);
    out[i * 3] = px;
    out[i * 3 + 1] = py;
    out[i * 3 + 2] = kind;
  }
  return out;
}

export interface HeroController {
  kind: "webgl" | "canvas";
  /** 0 = hero in view, 1 = hero scrolled out. Drives converge → dissolve. */
  setScroll(progress: number): void;
  destroy(): void;
}

export const isPhone = (): boolean => matchMedia("(pointer: coarse)").matches || innerWidth < 768;

/** Run a rAF loop only while the host is on screen and the tab is visible. */
export function visibleLoop(host: Element, frame: (dt: number) => void): { stop(): void; running(): boolean } {
  let raf = 0;
  let last = 0;
  let onScreen = false;
  let stopped = false;
  const tick = (now: number) => {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    frame(dt);
    raf = requestAnimationFrame(tick);
  };
  const sync = () => {
    const should = !stopped && onScreen && !document.hidden;
    if (should && !raf) {
      last = 0;
      raf = requestAnimationFrame(tick);
    } else if (!should && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
  const io = new IntersectionObserver((entries) => {
    onScreen = entries.some((e) => e.isIntersecting);
    sync();
  });
  io.observe(host);
  document.addEventListener("visibilitychange", sync);
  return {
    stop() {
      stopped = true;
      sync();
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
    },
    running: () => raf !== 0,
  };
}

/** The coral "reverted" moment: a ring at the hexagon edge and a REVERTED pill flash. */
export function flashReject(host: HTMLElement, x: number, y: number): void {
  const ring = host.querySelector<HTMLElement>("[data-ring]");
  const pill = host.querySelector<HTMLElement>("[data-reverted]");
  if (ring) {
    ring.style.left = `${(x / FIELD_W) * 100}%`;
    ring.style.top = `${(y / FIELD_H) * 100}%`;
    ring.classList.remove("is-on");
    void ring.offsetWidth;
    ring.classList.add("is-on");
  }
  if (pill) {
    pill.classList.add("is-on");
    window.setTimeout(() => pill.classList.remove("is-on"), 900);
  }
}

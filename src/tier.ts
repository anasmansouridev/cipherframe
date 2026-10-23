export type Tier = "A" | "B" | "C";

type NetInfo = { saveData?: boolean; effectiveType?: string };
type Nav = Navigator & { connection?: NetInfo; deviceMemory?: number };

function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** WebGL2 check. `cheap` avoids creating a context (used before first paint). */
export function hasWebGL2(cheap = false): boolean {
  if (typeof WebGL2RenderingContext === "undefined") return false;
  if (cheap) return true;
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** Test hook (Playwright addInitScript only; never read from the URL): pin a tier and skip the FPS probe. */
export function forcedTier(): Tier | null {
  const t = (window as Window & { __CF_FORCE_TIER__?: string }).__CF_FORCE_TIER__;
  return t === "A" || t === "B" || t === "C" ? t : null;
}

export function detectTier(cheap = false): Tier {
  const forced = forcedTier();
  if (forced) return forced;
  const nav = navigator as Nav;
  const conn = nav.connection;
  if (
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    conn?.saveData ||
    ["slow-2g", "2g", "3g"].includes(conn?.effectiveType ?? "")
  )
    return "C";
  if (!hasWebGL2(cheap)) return "B";
  const cores = navigator.hardwareConcurrency || 0;
  if (matchMedia("(pointer: fine)").matches && cores >= 8) return "A";
  const mem = nav.deviceMemory;
  if (mem !== undefined && mem >= 6 && cores >= 6) return "A";
  if (mem === undefined && isIOS()) return "A"; // pending the FPS probe
  return "B";
}

export const getTier = (): Tier => (document.documentElement.dataset.tier as Tier) || "B";

const listeners = new Set<(t: Tier) => void>();
export function setTier(t: Tier): void {
  const root = document.documentElement;
  if (root.dataset.tier === t) return;
  root.dataset.tier = t;
  root.classList.toggle("motion-ok", t !== "C");
  listeners.forEach((fn) => fn(t));
}
export const onTierChange = (fn: (t: Tier) => void): void => void listeners.add(fn);

export function lowerTier(t: Tier): Tier {
  return t === "A" ? "B" : "C";
}

/** Average rAF rate over ~1s while the page is visible. */
export function measureFps(duration = 1000): Promise<number> {
  return new Promise((resolve) => {
    let frames = 0;
    let start = 0;
    const tick = (now: number) => {
      if (document.hidden) {
        resolve(60);
        return;
      }
      if (!start) start = now;
      frames++;
      if (now - start < duration) requestAnimationFrame(tick);
      else resolve((frames - 1) / ((now - start) / 1000));
    };
    requestAnimationFrame(tick);
  });
}

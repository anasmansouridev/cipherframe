import { CONFIG, type Config } from "./config.ts";

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K] };

declare global {
  interface Window {
    /** Test hook: page scripts (Playwright addInitScript) can override CONFIG values. Never read from the URL. */
    __CF_OVERRIDES__?: DeepPartial<Config>;
    cfEvents?: { name: string; props: Record<string, unknown>; ts: number }[];
  }
}

function merge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(source)) {
    if (!Object.prototype.hasOwnProperty.call(target, key)) continue;
    const s = source[key];
    const t = target[key];
    if (s && typeof s === "object" && !Array.isArray(s) && t && typeof t === "object" && !Array.isArray(t)) {
      merge(t as Record<string, unknown>, s as Record<string, unknown>);
    } else {
      target[key] = s;
    }
  }
}

const overrides = typeof window !== "undefined" ? window.__CF_OVERRIDES__ : undefined;
if (overrides && typeof overrides === "object") merge(CONFIG as unknown as Record<string, unknown>, overrides as Record<string, unknown>);

export const CFG: Config = CONFIG;

export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T | null => root.querySelector<T>(sel);
export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T[] => Array.from(root.querySelectorAll<T>(sel));

export const prefersReducedMotion = (): boolean => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const isFinePointer = (): boolean => matchMedia("(pointer: fine)").matches;
export const isMobileWidth = (): boolean => matchMedia("(max-width: 767.98px)").matches;

export function session(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
export function setSession(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* storage blocked (private mode, in-app browser): degrade silently */
  }
}

/** Run once the browser is idle, with a timeout so it always happens. */
export function idle(fn: () => void, timeout = 1500): void {
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(fn, { timeout });
  else setTimeout(fn, 200);
}

export function afterLoad(fn: () => void): void {
  if (document.readyState === "complete") idle(fn);
  else addEventListener("load", () => idle(fn), { once: true });
}

/** Observe an element once it comes within `margin` of the viewport. */
export function whenNear(el: Element, fn: () => void, margin = "200px 0px"): void {
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        fn();
      }
    },
    { rootMargin: margin },
  );
  io.observe(el);
}

/**
 * Manual scroll anchoring (Safari has none): run a layout-changing `fn` and keep whatever
 * the visitor is looking at in place, e.g. a DM deep link to #pricing while lazy features load.
 */
export function keepAnchor(fn: () => void): void {
  let anchor: Element | null = null;
  let top = 0;
  if (scrollY > 0) {
    for (const el of $$("main > *, body > footer")) {
      const r = el.getBoundingClientRect();
      if (r.bottom > 0) {
        anchor = el;
        top = r.top;
        break;
      }
    }
  }
  fn();
  if (!anchor) return;
  const delta = anchor.getBoundingClientRect().top - top;
  if (Math.abs(delta) > 0.5) window.scrollBy({ top: delta, behavior: "instant" });
}

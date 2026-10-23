import { CFG } from "./runtime";
import { attributionParams } from "./utm";

export type EventName =
  | "tier_selected"
  | "cta_book_click"
  | "cta_remake_click"
  | "cta_clip_click"
  | "dm_click"
  | "slider_interact"
  | "timeline_complete"
  | "pricing_view"
  | "calendar_loaded"
  | "calendar_fallback_click"
  | "nudge_shown"
  | "nudge_click"
  | "nudge_dismiss"
  | "scroll_50"
  | "scroll_90";

/** POSTs JSON with sendBeacon when an endpoint is configured; logs in dev otherwise. */
export function track(name: EventName, props: Record<string, unknown> = {}): void {
  const event = {
    name,
    props,
    ts: Date.now(),
    path: location.pathname,
    tier: document.documentElement.dataset.tier,
    attribution: attributionParams(),
  };
  (window.cfEvents ||= []).push(event);
  const endpoint = CFG.analytics.eventEndpoint;
  if (endpoint) {
    try {
      const sameOrigin = new URL(endpoint, location.href).origin === location.origin;
      // A text/plain body avoids a CORS preflight for cross-origin collectors; the body is still JSON.
      const blob = new Blob([JSON.stringify(event)], { type: sameOrigin ? "application/json" : "text/plain" });
      navigator.sendBeacon?.(endpoint, blob);
    } catch {
      /* never let analytics break the page */
    }
  } else if (import.meta.env.DEV) {
    console.debug("[track]", name, props);
  }
}

/** Cloudflare Web Analytics (no cookies), only when a token is configured. */
export function loadBeacon(): void {
  const token = CFG.analytics.cfBeaconToken;
  if (!token) return;
  const s = document.createElement("script");
  s.defer = true;
  s.src = "https://static.cloudflareinsights.com/beacon.min.js";
  s.setAttribute("data-cf-beacon", JSON.stringify({ token }));
  document.head.appendChild(s);
}

export function scrollDepth(): number {
  const doc = document.documentElement;
  const max = doc.scrollHeight;
  return max ? (scrollY + innerHeight) / max : 0;
}

export function initScrollTracking(): void {
  const fired = new Set<number>();
  let queued = false;
  const check = () => {
    queued = false;
    const d = scrollDepth();
    for (const mark of [50, 90] as const) {
      if (d >= mark / 100 && !fired.has(mark)) {
        fired.add(mark);
        track(mark === 50 ? "scroll_50" : "scroll_90");
      }
    }
  };
  addEventListener(
    "scroll",
    () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(check);
      }
    },
    { passive: true },
  );
}

/** Fires once when the element crosses the middle band of the viewport (works for sections taller than the screen). */
export function trackOnView(el: Element | null, name: EventName): void {
  if (!el) return;
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        track(name);
      }
    },
    { rootMargin: "-35% 0px -35% 0px" },
  );
  io.observe(el);
}

import { $, $$, keepAnchor, prefersReducedMotion } from "../runtime";
import { getTier } from "../tier";

export type TimelineMode = "list" | "carousel" | "pinned";

let stopCarousel: (() => void) | null = null;

/** Reduced motion → static list; desktop ≥1024 on Tier A/B → pinned (set by the GSAP chunk); otherwise a carousel. */
export function fallbackMode(): TimelineMode {
  return prefersReducedMotion() ? "list" : "carousel";
}

export function wantsPinned(): boolean {
  return !prefersReducedMotion() && innerWidth >= 1024 && getTier() !== "C";
}

/**
 * The track's 5 stops (18px diamonds): before `active` = confirmed (filled mint),
 * `active` = in flight (blue outline), after = pending (grid-line outline).
 */
export function paintStops(section: Element, active: number): void {
  $$(".tl__stop", section).forEach((stop, i) => {
    stop.classList.toggle("is-done", i < active);
    stop.classList.toggle("is-current", i === active);
  });
}

export function setTimelineMode(mode: TimelineMode): void {
  const section = $("[data-timeline]");
  if (!section) return;
  stopCarousel?.();
  stopCarousel = null;
  section.dataset.mode = mode;
  if (mode === "carousel") stopCarousel = carousel(section);
}

/**
 * Runs at boot, before the load event, so the layout is final while the browser is still
 * anchoring a #fragment. Desktop gets the pinned layout straight away; ScrollTrigger adds
 * the pin itself later (and keeps the visitor's place with keepAnchor).
 */
export function initTimeline(): void {
  setTimelineMode(wantsPinned() ? "pinned" : fallbackMode());
}

/** When pinning can't happen after all (FPS downgrade to Tier C, GSAP failed to load), fall back. */
export function unpinTimeline(): void {
  if ($("[data-timeline]")?.dataset.mode === "pinned") keepAnchor(() => setTimelineMode(fallbackMode()));
}

/** Horizontal scroll-snap of the 5 steps; auto-advances every 2.5s in view, pauses on touch, resumes after 5s. */
function carousel(section: HTMLElement): () => void {
  const list = $("[data-tl-steps]", section)!;
  const steps = $$("li", list);
  const bar = $("[data-tl-progress]", section);
  let index = 0;
  let inView = false;
  let pausedUntil = 0;

  const current = () => {
    const x = list.scrollLeft;
    let best = 0;
    steps.forEach((s, i) => {
      if (Math.abs(s.offsetLeft - list.offsetLeft - x) < Math.abs(steps[best].offsetLeft - list.offsetLeft - x)) best = i;
    });
    return best;
  };
  const paint = () => {
    index = current();
    if (bar) bar.style.scale = `${index / (steps.length - 1)} 1`;
    paintStops(section, index);
  };
  const go = (i: number) => {
    const s = steps[i];
    const pad = parseFloat(getComputedStyle(list).paddingLeft) || 0;
    list.scrollTo({ left: s.offsetLeft - list.offsetLeft - pad, behavior: "smooth" });
  };
  const onScroll = () => requestAnimationFrame(paint);
  const pause = () => (pausedUntil = performance.now() + 5000);
  list.addEventListener("scroll", onScroll, { passive: true });
  list.addEventListener("pointerdown", pause);
  list.addEventListener("touchstart", pause, { passive: true });
  list.addEventListener("wheel", pause, { passive: true });

  const io = new IntersectionObserver((entries) => (inView = entries.some((e) => e.isIntersecting)), { threshold: 0.6 });
  io.observe(list);
  const timer = window.setInterval(() => {
    if (!inView || document.hidden || performance.now() < pausedUntil) return;
    go((index + 1) % steps.length);
  }, 2500);
  paint();

  return () => {
    clearInterval(timer);
    io.disconnect();
    list.removeEventListener("scroll", onScroll);
    list.removeEventListener("pointerdown", pause);
    list.removeEventListener("touchstart", pause);
    list.removeEventListener("wheel", pause);
    list.scrollLeft = 0;
    if (bar) bar.style.scale = "";
    paintStops(section, -1);
  };
}

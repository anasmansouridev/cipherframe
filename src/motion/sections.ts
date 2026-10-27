/**
 * Lazy GSAP chunk (Tiers A and B only). Every section initialises when it comes near the
 * viewport, which spreads the work out and keeps TBT low. Only transform and opacity move.
 * Design system: fast ease-out, cubic-bezier(0.22,1,0.36,1) (= GSAP "power4.out", quint),
 * no bounce, overshoot, spin or 3D. Entrances are a fade plus a 12px rise.
 */
import { gsap } from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { Flip } from "gsap/Flip";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { track } from "../analytics";
import { fallbackMode, paintStops, setTimelineMode, wantsPinned } from "../components/timeline";
import { $, $$, idle, isFinePointer, keepAnchor, whenNear } from "../runtime";
import type { Tier } from "../tier";
import { registry } from "./registry";

gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin, Flip);
const EASE = "power4.out";
const RISE = 12;
gsap.defaults({ ease: EASE, duration: 0.6 });
registry.gsap = gsap;
registry.Flip = Flip;

const ONCE = (trigger: Element | string, start = "top 85%") => ({ trigger, start, once: true });

/** Initialise a section's motion when it nears the viewport, in idle time (spreads TBT). */
const near = (sel: string, fn: () => void, margin = "40% 0px") => {
  const el = $(sel);
  if (el) whenNear(el, () => idle(fn, 300), margin);
};

/** Keep trigger positions true when content above them changes height (FAQ items, the Cal.com iframe). */
function refreshOnResize(): void {
  const main = $("main");
  if (!main) return;
  let last = main.offsetHeight;
  let timer = 0;
  new ResizeObserver(() => {
    const h = main.offsetHeight;
    if (Math.abs(h - last) < 2) return;
    last = h;
    clearTimeout(timer);
    timer = window.setTimeout(() => ScrollTrigger.refresh(), 200);
  }).observe(main);
}

export function initMotion(tier: Tier): void {
  const fine = isFinePointer();
  connectHero();
  initPinnedTimeline();
  refreshOnResize();
  near("#problem", initProblem);
  near("#desk", initDesk);
  near("#work", initWork);
  near("#compare", initCompareRows);
  near("#pricing", initPricing);
  near("#guarantee", initSeals);
  idle(initDividers, 1000);
  if (tier === "A") near("#book", initBookField, "800px 0px");
  if (fine) initSpotlight();
  if (tier === "A" && fine) {
    void initLenis();
    initCursor();
    initMagnetic();
  }
}

/** M1 scroll link: the hero renderer converges into the mark, then dissolves, as the hero scrolls out. */
function connectHero(): void {
  ScrollTrigger.create({
    trigger: "#top",
    start: "top top",
    end: "bottom top",
    onUpdate: (self) => registry.hero?.setScroll(self.progress),
  });
}

/** M4: pain cards stagger in, their "dead feed" thumbnails flicker out; the closing line reveals word by word. */
function initProblem(): void {
  const cards = $$(".pain");
  gsap.from(cards, { opacity: 0, y: RISE, stagger: 0.06, scrollTrigger: ONCE(".pains"), clearProps: "transform,opacity" });
  cards.forEach((c) => ScrollTrigger.create({ trigger: c, start: "top 75%", once: true, onEnter: () => c.classList.add("is-dead") }));
  const closing = $(".closing");
  if (closing) {
    const split = SplitText.create(closing, { type: "words" });
    gsap.from(split.words, {
      opacity: 0,
      y: RISE,
      stagger: 0.1,
      ease: "none",
      scrollTrigger: { trigger: closing, start: "top 88%", end: "top 50%", scrub: 0.6 },
    });
  }
}

/** M5: Desk pillar icons draw themselves (no card tilt: the design system bans 3D). */
function initDesk(): void {
  gsap.from(".pillar", { opacity: 0, y: RISE, stagger: 0.06, scrollTrigger: ONCE(".pillars"), clearProps: "transform,opacity" });
  gsap.fromTo(
    ".pillar__icon .icon > *",
    { drawSVG: "0%" },
    { drawSVG: "100%", duration: 1.1, stagger: 0.06, ease: "power2.inOut", scrollTrigger: ONCE(".pillars", "top 80%") },
  );
}

/** M6: desktop ≥1024 pins #process for 250vh and scrubs the 48-hour clock, the frame and the captions. */
function initPinnedTimeline(): void {
  const section = $("#process");
  if (!section) return;
  const mm = gsap.matchMedia();
  mm.add("(min-width: 1024px)", () => {
    if (!wantsPinned()) return;
    keepAnchor(() => buildPinned(section));
    return () => keepAnchor(() => setTimelineMode(fallbackMode()));
  });
}

function buildPinned(section: HTMLElement): void {
  setTimelineMode("pinned");

  const steps = $$(".tl__step", section);
  const arc = $(".tl__arc", section);
  const hours = $("[data-tl-hours]", section);
  const bar = $("[data-tl-progress]", section);
  const style = $(".tl__layer--style", section);
  const paths = $$(".tl__layer--paths path", section);
  const final = $(".tl__layer--final", section);
  const wire = $(".tl__layer--wire", section);
  const clock = { h: 0 };
  const paint = () => {
    if (hours) hours.textContent = String(Math.round(clock.h));
    if (arc) gsap.set(arc, { drawSVG: `${(clock.h / 48) * 100}%` });
  };
  let done = false;
  // Captions change at these points; the track's 5 stops sit at 0, 25, 50, 75 and 100%.
  const marks = [0, 0.2, 0.42, 0.66, 0.86];

  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: {
      trigger: section,
      start: "top top",
      end: () => `+=${Math.round(innerHeight * 2.5)}`,
      pin: true,
      scrub: 0.6,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate(self) {
        paintStops(section, marks.filter((m) => self.progress >= m - 0.001).length - 1);
        if (!done && self.progress >= 0.995) {
          done = true;
          track("timeline_complete");
        }
      },
    },
  });
  paint();
  tl.to(clock, { h: 12, duration: 0.2, onUpdate: paint }, 0)
    .to(clock, { h: 24, duration: 0.22, onUpdate: paint }, 0.2)
    .to(clock, { h: 48, duration: 0.24, onUpdate: paint }, 0.42)
    .fromTo(bar, { scaleX: 0 }, { scaleX: 0.25, transformOrigin: "left center", duration: 0.2 }, 0)
    .to(bar, { scaleX: 0.5, duration: 0.22 }, 0.2)
    .to(bar, { scaleX: 0.75, duration: 0.24 }, 0.42)
    .to(bar, { scaleX: 1, duration: 0.2 }, 0.66)
    .fromTo(style, { opacity: 0 }, { opacity: 1, duration: 0.1 }, 0.2)
    .fromTo(paths, { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.18 }, 0.42)
    .fromTo(wire, { opacity: 1 }, { opacity: 0.2, duration: 0.08 }, 0.66)
    .fromTo(final, { opacity: 0, y: RISE }, { opacity: 1, y: 0, duration: 0.08 }, 0.66);
  steps.forEach((s, i) => {
    if (i > 0) tl.fromTo(s, { opacity: 0, y: RISE }, { opacity: 1, y: 0, duration: 0.05 }, marks[i]);
    if (i < steps.length - 1) tl.to(s, { opacity: 0, y: -RISE, duration: 0.05 }, marks[i + 1] - 0.05);
  });
  tl.set({}, {}, 1);
  paintStops(section, 0);

  ScrollTrigger.refresh();
}

/** M7: work previews (CSS loops) fade in; the spotlight comes from initSpotlight. */
function initWork(): void {
  gsap.from(".work", { opacity: 0, y: RISE, stagger: 0.08, scrollTrigger: ONCE(".works"), clearProps: "transform,opacity" });
}

/** M8: comparison rows reveal in sequence. */
function initCompareRows(): void {
  gsap.from(".cmp__table tbody tr", { opacity: 0, y: RISE, stagger: 0.08, scrollTrigger: ONCE(".cmp__table"), clearProps: "transform,opacity" });
}

/** M9: cards fade in (no number counting: prices read instantly); founding pips fill with a stagger. */
function initPricing(): void {
  gsap.from(".price, .launchpack", { opacity: 0, y: RISE, stagger: 0.06, scrollTrigger: ONCE(".prices"), clearProps: "transform,opacity" });
  const pips = $$(".pip");
  if (pips.length) {
    gsap.from(pips, { opacity: 0, y: RISE / 2, stagger: 0.12, duration: 0.45, scrollTrigger: ONCE(".founding", "top 90%"), clearProps: "transform,opacity" });
    const fills = $$(".pip.is-taken i");
    if (fills.length) gsap.from(fills, { scaleY: 0, transformOrigin: "50% 100%", stagger: 0.12, duration: 0.5, delay: 0.2, scrollTrigger: ONCE(".founding", "top 90%") });
  }
}

/**
 * M10: the guarantee cards rise in (fade + 12px), then each card's Pill/Status reads IN FLIGHT
 * and cross-fades to CONFIRMED 400ms after the card lands. Without motion it simply reads CONFIRMED.
 */
function initSeals(): void {
  const seals = $$(".seal");
  const inFlight = $$(".seal__status .pill--blue");
  const confirmed = $$(".seal__status .pill--mint");
  gsap.set(inFlight, { opacity: 1 });
  gsap.set(confirmed, { opacity: 0 });
  const tl = gsap.timeline({ scrollTrigger: ONCE(".seals") });
  seals.forEach((card, i) => {
    const at = i * 0.12;
    const landed = at + 0.6;
    tl.from(card, { opacity: 0, y: RISE, duration: 0.6, clearProps: "transform,opacity" }, at);
    if (inFlight[i]) tl.to(inFlight[i], { opacity: 0, duration: 0.3 }, landed + 0.4);
    if (confirmed[i]) tl.to(confirmed[i], { opacity: 1, duration: 0.3 }, landed + 0.4);
  });
}

/** M12: each divider's chain of 6 blocks assembles left to right. */
function initDividers(): void {
  $$(".divider").forEach((d) =>
    gsap.from(d.children, { opacity: 0, scaleX: 0, transformOrigin: "left center", stagger: 0.06, duration: 0.4, scrollTrigger: ONCE(d, "top 92%") }),
  );
}

/** M11: on Tier A, the hero renderer returns behind the final CTA at 40% density, converging on the diamond. */
async function initBookField(): Promise<void> {
  const host = $("[data-book-field]");
  if (!host) return;
  const { mountWebGL } = await import("./hero-webgl");
  mountWebGL(host, { density: 0.4, mode: "diamond", interactive: false });
}

/** Glass spotlight follows the cursor via --mx / --my. */
function initSpotlight(): void {
  let lit: HTMLElement | null = null;
  addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse") return;
      const g = (e.target as Element | null)?.closest?.<HTMLElement>(".glass") ?? null;
      if (g !== lit) {
        lit?.classList.remove("is-lit");
        lit = g;
        g?.classList.add("is-lit");
      }
      if (g) {
        const r = g.getBoundingClientRect();
        g.style.setProperty("--mx", `${e.clientX - r.left}px`);
        g.style.setProperty("--my", `${e.clientY - r.top}px`);
      }
    },
    { passive: true },
  );
}

/** Lenis smooth scroll: desktop (pointer: fine), Tier A, never with reduced motion. */
async function initLenis(): Promise<void> {
  const { default: Lenis } = await import("lenis");
  const lenis = new Lenis({ lerp: 0.12, anchors: true, autoRaf: false });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

/** M13: a 24px mint glow follows the pointer with lerp; hidden over inputs and iframes. */
function initCursor(): void {
  const dot = document.createElement("div");
  dot.className = "cursor-glow";
  dot.setAttribute("aria-hidden", "true");
  document.body.append(dot);
  const p = { x: -100, y: -100, tx: -100, ty: -100 };
  let active = false;
  const tick = () => {
    p.x += (p.tx - p.x) * 0.18;
    p.y += (p.ty - p.y) * 0.18;
    dot.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
    if (Math.abs(p.tx - p.x) < 0.1 && Math.abs(p.ty - p.y) < 0.1) {
      gsap.ticker.remove(tick);
      active = false;
    }
  };
  addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse") return;
      p.tx = e.clientX;
      p.ty = e.clientY;
      const over = (e.target as Element | null)?.closest?.("input, textarea, select, iframe, [contenteditable], .cal");
      dot.classList.toggle("is-on", !over);
      if (!active) {
        active = true;
        gsap.ticker.add(tick);
      }
    },
    { passive: true },
  );
  document.documentElement.addEventListener("mouseleave", () => dot.classList.remove("is-on"));
}

/** Magnetic primary buttons: pull up to 6px when the pointer is within 80px. */
function initMagnetic(): void {
  const buttons = $$(".btn--primary");
  let raf = 0;
  addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType !== "mouse") return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        for (const b of buttons) {
          if (!b.classList.contains("is-visible")) continue;
          const r = b.getBoundingClientRect();
          const dx = e.clientX - (r.left + r.width / 2);
          const dy = e.clientY - (r.top + r.height / 2);
          const ex = Math.max(r.left - e.clientX, 0, e.clientX - r.right);
          const ey = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
          const d = Math.hypot(ex, ey);
          const k = d < 80 ? 1 - d / 80 : 0;
          const tx = Math.max(-6, Math.min(6, dx * 0.12)) * k;
          const ty = Math.max(-6, Math.min(6, dy * 0.2)) * k;
          b.style.setProperty("--tx", `${tx.toFixed(2)}px`);
          b.style.setProperty("--ty", `${ty.toFixed(2)}px`);
        }
      });
    },
    { passive: true },
  );
}

/**
 * Boot: tier → personalise → mount sections → lazy features.
 * Everything here is small and synchronous; WebGL, Canvas 2D, GSAP, Cal.com and the
 * video dialog are dynamic imports loaded after first paint.
 */
import { initScrollTracking, loadBeacon, track, trackOnView, type EventName } from "./analytics";
import { initBeforeAfter, initInlineVideos } from "./components/before-after";
import { initCompare } from "./components/compare";
import { initConceptVideos } from "./components/concept-videos";
import { startCountdown } from "./components/countdown";
import { initSticky } from "./components/sticky-cta";
import { initTimeline, unpinTimeline } from "./components/timeline";
import { initWorkVideos } from "./components/work-videos";
import { initCal } from "./integrations/cal";
import { initTally } from "./integrations/tally";
import type { HeroController } from "./motion/field";
import { registry } from "./motion/registry";
import { applyPersonalization } from "./personalize";
import { CFG, $, $$, afterLoad, idle, isMobileWidth } from "./runtime";
import { detectTier, forcedTier, getTier, hasWebGL2, lowerTier, measureFps, setTier, type Tier } from "./tier";
import { captureFirstTouch } from "./utm";

const root = document.documentElement;

function boot(): void {
  root.classList.remove("no-js");
  root.classList.add("js");
  setTier(detectTier(true));
  root.classList.toggle("motion-ok", getTier() !== "C");

  applyPersonalization();
  captureFirstTouch();
  initTally();
  initLinks();
  syncFacts();
  startCountdown();

  // Above the fold, needed for the first tap, or layout-changing (must land before the load
  // event, while the browser still anchors a #fragment such as a DM link to #pricing)
  initCtaTracking();
  initReadMore();
  initSticky();
  initTimeline();
  initCompare();
  initLoopVisibility();
  initInteractionPause();
  initScrollTracking();

  // Below the fold and layout-neutral: set up when the main thread is free
  idle(() => {
    initBeforeAfter();
    initInlineVideos();
    initConceptVideos();
    initWorkVideos();
  }, 600);
  idle(() => {
    initCal();
    initCopy();
    trackOnView(document.getElementById("pricing"), "pricing_view");
    loadBeacon();
  }, 1200);

  if (document.readyState === "complete") root.classList.add("is-loaded");
  else addEventListener("load", () => root.classList.add("is-loaded"), { once: true });
  afterLoad(() => void enhance());
}

/** X DM link: CONFIG.social.xDmUrl if set, otherwise the profile URL. */
function initLinks(): void {
  for (const a of $$<HTMLAnchorElement>("a[data-cta='dm']")) a.href = CFG.social.xDmUrl || CFG.social.xUrl;
}

/** Slot counts are re-read at runtime so the page and CONFIG can never disagree. */
function syncFacts(): void {
  const founding = $("[data-founding]");
  if (founding) {
    const left = CFG.foundingSlotsLeft;
    if (!(left > 0)) founding.remove();
    else {
      const total = CFG.foundingTotal;
      const taken = Math.max(0, total - left);
      $$("[data-founding-total]", founding).forEach((el) => (el.textContent = String(total)));
      $$("[data-founding-left]", founding).forEach((el) => (el.textContent = String(left)));
      $$(".pip", founding).forEach((pip, i) => {
        const isTaken = i < taken;
        pip.classList.toggle("is-taken", isTaken);
        if (isTaken && !pip.firstElementChild) pip.append(document.createElement("i"));
        if (!isTaken) pip.replaceChildren();
      });
      $("[data-pips]", founding)?.setAttribute("aria-label", `${taken} of ${total} founding Desks taken`);
    }
  }
  $$("[data-remakes-per-day]").forEach((el) => (el.textContent = String(CFG.freeRemakesPerDay)));
}

const CTA_EVENTS: Record<string, EventName> = {
  book: "cta_book_click",
  remake: "cta_remake_click",
  clip: "cta_clip_click",
  dm: "dm_click",
};

function initCtaTracking(): void {
  document.addEventListener("click", (e) => {
    const el = (e.target as Element | null)?.closest<HTMLElement>("[data-cta]");
    if (!el) return;
    const name = CTA_EVENTS[el.dataset.cta ?? ""];
    if (!name) return;
    track(name, { loc: el.dataset.loc ?? "" });
  });
}

function initReadMore(): void {
  const btn = $<HTMLButtonElement>(".hero__more");
  const sub = $("#hero-sub");
  btn?.addEventListener("click", () => {
    if (!sub) return;
    sub.classList.add("is-open");
    btn.setAttribute("aria-expanded", "true");
    sub.tabIndex = -1;
    sub.focus({ preventScroll: true });
  });
}

function initCopy(): void {
  const btn = $<HTMLButtonElement>("[data-copy]");
  const label = $("[data-copy-label]");
  const status = $("[data-copy-status]");
  btn?.addEventListener("click", async () => {
    const text = btn.dataset.copy ?? "";
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.append(ta);
      ta.select();
      ok = document.execCommand?.("copy") ?? false;
      ta.remove();
    }
    if (label) label.textContent = ok ? "Copied" : "Copy";
    if (status) status.textContent = ok ? "Email address copied" : "";
    window.setTimeout(() => {
      if (label) label.textContent = "Copy";
      if (status) status.textContent = "";
    }, 2000);
  });
}

/** One observer for many elements: toggles `cls` while each is on screen (or off screen with `invert`). */
function toggleOnScreen(els: Element[], cls: string, invert = false): void {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) e.target.classList.toggle(cls, invert ? !e.isIntersecting : e.isIntersecting);
  });
  els.forEach((el) => io.observe(el));
}

/** Every looping effect pauses off-screen and while the tab is hidden. */
function initLoopVisibility(): void {
  toggleOnScreen($$(".btn--primary, [data-trace]"), "is-visible");
  toggleOnScreen($$("#top, #book"), "is-offscreen", true);
  document.addEventListener("visibilitychange", () => root.classList.toggle("is-hidden", document.hidden));
}

/** The button shimmer pauses for 10s after any user interaction. */
function initInteractionPause(): void {
  let timer = 0;
  const onInteract = () => {
    root.classList.add("is-interacting");
    clearTimeout(timer);
    timer = window.setTimeout(() => root.classList.remove("is-interacting"), 10_000);
  };
  for (const type of ["pointerdown", "keydown", "wheel", "touchstart"]) addEventListener(type, onInteract, { passive: true });
}

async function mountHero(tier: Tier): Promise<HeroController | null> {
  const host = $("[data-txfield]");
  if (!host || CFG.videos.hero) return null;
  try {
    if (tier === "A") {
      const { mountWebGL } = await import("./motion/hero-webgl");
      const ctl = mountWebGL(host);
      if (ctl) return ctl;
    }
    const { mountCanvas } = await import("./motion/hero-canvas");
    return mountCanvas(host, isMobileWidth() ? 500 : 700);
  } catch {
    return null;
  }
}

const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0));

async function enhance(): Promise<void> {
  let tier = getTier();
  if (tier === "A" && !hasWebGL2()) {
    tier = "B";
    setTier(tier);
  }
  track("tier_selected", { tier });
  if (tier === "C") return unpinTimeline();
  // Film grain is Tier A only, so its noise tile stays out of the render-blocking CSS.
  if (tier === "A") void import("./styles/grain.css").catch(() => undefined);

  // The decode chunk (GSAP core + ScrambleText + DrawSVG) loads before the probe so its
  // compile time doesn't skew it; ScrollTrigger, SplitText and Flip load after.
  const decode = await import("./motion/decode").catch(() => null);
  void decode?.heroDecode();
  await yieldToMain();

  registry.hero = (await mountHero(tier)) ?? undefined;
  if (registry.hero && !forcedTier()) {
    await new Promise<void>((r) => idle(r, 800));
    const fps = await measureFps(1000);
    if (fps < 45) {
      tier = lowerTier(tier);
      setTier(tier);
      track("tier_selected", { tier, downgraded: true, fps: Math.round(fps) });
      registry.hero.destroy();
      registry.hero = tier === "B" ? ((await mountHero("B")) ?? undefined) : undefined;
    }
  }
  if (tier === "C") return unpinTimeline();
  const motion = await import("./motion/sections").catch(() => null);
  if (!motion) return unpinTimeline();
  await yieldToMain();
  try {
    motion.initMotion(tier);
  } catch {
    unpinTimeline(); // motion is an enhancement; the page is complete without it
  }
}

boot();

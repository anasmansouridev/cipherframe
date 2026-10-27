import { track } from "../analytics";
import { $, $$, isMobileWidth, prefersReducedMotion, whenNear } from "../runtime";
import { getTier, onTierChange } from "../tier";
import { onSoundElsewhere, soundOn } from "./sound-bus";

export type BaState = "split" | "static" | "motion";

/**
 * M3. Desktop: a draggable divider (pointer events + clip-path inset reveal) that is also
 * an ARIA slider (←/→ move 5%). Mobile: a two-state toggle (tap anywhere, or the pill
 * switch) that auto-switches to Motion 1.2s after entering the viewport, once.
 * Dispatches "ba:state" on the root so the kinetic loop can restart/pause.
 */
export function initBeforeAfter(): void {
  const root = $("[data-ba]");
  const frame = $("[data-ba-frame]", root ?? document);
  const handle = $(".ba__handle", root ?? document);
  if (!root || !frame || !handle) return;
  const buttons = $$<HTMLButtonElement>("[data-ba-set]", root);

  let split = 50;
  let interacted = false;
  let autoDone = false;
  const firstUse = (how: string) => {
    if (interacted) return;
    interacted = true;
    track("slider_interact", { how });
  };

  const setSplit = (v: number) => {
    split = Math.round(Math.min(100, Math.max(0, v)));
    root.style.setProperty("--split", `${split}%`);
    handle.setAttribute("aria-valuenow", String(split));
    handle.setAttribute("aria-valuetext", `Divider at ${split}%: ${100 - split}% animated`);
  };

  const setState = (s: BaState) => {
    root.dataset.state = s;
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.baSet === s)));
    root.dispatchEvent(new CustomEvent("ba:state", { detail: s }));
  };

  // Desktop drag
  let dragging = false;
  const fromEvent = (e: PointerEvent) => {
    const r = frame.getBoundingClientRect();
    setSplit(((e.clientX - r.left) / r.width) * 100);
  };
  frame.addEventListener("pointerdown", (e) => {
    if (isMobileWidth() || e.button !== 0) return;
    dragging = true;
    frame.setPointerCapture(e.pointerId);
    fromEvent(e);
    firstUse("drag");
  });
  frame.addEventListener("pointermove", (e) => dragging && fromEvent(e));
  const end = () => (dragging = false);
  frame.addEventListener("pointerup", end);
  frame.addEventListener("pointercancel", end);

  handle.addEventListener("keydown", (e) => {
    const step: Record<string, number> = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, PageDown: -10, PageUp: 10 };
    if (e.key in step) setSplit(split + step[e.key]);
    else if (e.key === "Home") setSplit(0);
    else if (e.key === "End") setSplit(100);
    else return;
    e.preventDefault();
    firstUse("keyboard");
  });

  // Mobile toggle
  frame.addEventListener("click", (e) => {
    if (!isMobileWidth() || (e.target as Element).closest("button, a")) return;
    setState(root.dataset.state === "motion" ? "static" : "motion");
    firstUse("tap");
  });
  buttons.forEach((b) =>
    b.addEventListener("click", () => {
      setState(b.dataset.baSet as BaState);
      firstUse("toggle");
    }),
  );

  const applyLayout = () => {
    if (isMobileWidth()) {
      if (root.dataset.state === "split") setState("static");
    } else if (root.dataset.state !== "split") {
      setState("split");
    }
  };
  matchMedia("(max-width: 767.98px)").addEventListener("change", applyLayout);
  setSplit(50);
  applyLayout();

  // Mobile: auto-switch to Motion 1.2s after entering the viewport (once).
  // Desktop: one slow peek of the divider, so it reads as draggable. Neither under reduced motion.
  const peek = () => {
    const begin = performance.now();
    const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
    const step = (now: number) => {
      if (interacted || isMobileWidth()) return;
      const t = now - begin;
      if (t < 900) setSplit(50 - 32 * ease(t / 900));
      else if (t < 1500) setSplit(18);
      else if (t < 2400) setSplit(18 + 32 * ease((t - 1500) / 900));
      else return setSplit(50);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting) || autoDone) return;
      autoDone = true;
      io.disconnect();
      if (prefersReducedMotion() || document.documentElement.dataset.tier === "C") return;
      window.setTimeout(() => {
        if (interacted) return;
        if (isMobileWidth()) {
          if (root.dataset.state === "static") setState("motion");
        } else peek();
      }, 1200);
    },
    { threshold: 0.5 },
  );
  io.observe(frame);

  initShowcaseVideo(root);
}

/**
 * The film on the Cipherframe side of the card. Nothing downloads until it first plays
 * (preload="none"; the poster stands in). It plays muted while at least 40% of it is on screen
 * and the Motion side is showing, and pauses (and re-mutes) when it leaves. Reduced motion and
 * Save-Data / slow networks (Tier C) never autoplay: the poster stays. The speaker button
 * unmutes it and restarts it from 0 so the sound lines up with the picture.
 */
function initShowcaseVideo(root: HTMLElement): void {
  const video = $<HTMLVideoElement>("[data-ba-video]", root);
  const sound = $<HTMLButtonElement>("[data-ba-sound]", root);
  if (!video) return;
  // A <video poster> is fetched the moment the tag is parsed, which competes with the first paint. Set it
  // once the card is near the screen instead (every tier: it is also what reduced motion shows).
  whenNear(video, () => (video.poster = video.dataset.poster ?? ""), "1200px 0px");
  if (prefersReducedMotion() || getTier() === "C") return;

  let visible = false;
  let state = root.dataset.state ?? "split";

  const setMuted = (muted: boolean) => {
    video.muted = muted;
    sound?.classList.toggle("is-on", !muted);
    sound?.setAttribute("aria-label", muted ? "Turn sound on" : "Turn sound off");
  };
  const sync = () => {
    if (visible && state !== "static" && !document.hidden && getTier() !== "C") void video.play().catch(() => undefined);
    else {
      video.pause();
      setMuted(true);
    }
  };

  new IntersectionObserver(
    (entries) => {
      visible = entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.4);
      sync();
    },
    { threshold: [0, 0.4] },
  ).observe(video);
  root.addEventListener("ba:state", (e) => {
    state = (e as CustomEvent<string>).detail;
    if (state === "motion") video.currentTime = 0;
    sync();
  });
  document.addEventListener("visibilitychange", sync);
  onTierChange(sync);
  onSoundElsewhere((v) => v === video, () => setMuted(true));

  if (!sound) return;
  sound.hidden = false;
  // The card is a drag surface: a press on the button must not move the divider.
  sound.addEventListener("pointerdown", (e) => e.stopPropagation());
  sound.addEventListener("click", () => {
    if (!video.muted) return setMuted(true);
    setMuted(false);
    soundOn(video);
    video.currentTime = 0;
    void video.play().catch(() => setMuted(true));
  });
}

/** Configured MP4s (hero, mainnet): muted autoplay while visible; click-to-play with controls under reduced motion. */
export function initInlineVideos(): void {
  if (prefersReducedMotion()) return;
  for (const video of $$<HTMLVideoElement>("video[data-autoplay]")) {
    video.controls = false;
    video.preload = "metadata";
    new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void video.play().catch(() => (video.controls = true));
      else video.pause();
    }).observe(video);
  }
}

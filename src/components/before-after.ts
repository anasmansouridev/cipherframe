import { track } from "../analytics";
import { $, $$, isMobileWidth, prefersReducedMotion } from "../runtime";

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
    if (!isMobileWidth() || (e.target as Element).closest("video, button, a")) return;
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

import { prefersReducedMotion } from "../runtime";
import { soundOn } from "./sound-bus";

/**
 * Lazy-loaded lightbox for the Studio concepts: a native <dialog> with the film, native controls, sound on,
 * starting from 0. showModal() traps focus and Esc closes; so do the close button and a click on the dark
 * backdrop. Focus returns to the opener. Under reduced motion it does not autoplay (press play on the controls).
 */
export interface VideoSource {
  src: string;
  type: string;
}

export interface VideoDialogOptions {
  title: string;
  sources: VideoSource[];
  poster?: string;
  opener?: HTMLElement;
  onClose?: () => void;
}

/** The design-system x (close) icon: 24px grid, 1.5px stroke, round caps. */
function xIcon(): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  for (const [k, v] of Object.entries({ class: "icon", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.5", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" }))
    svg.setAttribute(k, v);
  for (const d of ["M18 6 6 18", "m6 6 12 12"]) {
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

export function openVideo({ title, sources, poster, opener, onClose }: VideoDialogOptions): void {
  const dialog = document.createElement("dialog");
  dialog.className = "video-dialog";
  dialog.setAttribute("aria-label", title);

  const bar = document.createElement("div");
  bar.className = "video-dialog__bar";
  const h = document.createElement("h2");
  h.textContent = title;
  const close = document.createElement("button");
  close.type = "button";
  close.className = "video-dialog__close";
  close.setAttribute("aria-label", "Close video");
  close.append(xIcon());
  bar.append(h, close);

  const video = document.createElement("video");
  video.controls = true;
  video.playsInline = true;
  video.preload = "auto";
  if (poster) video.poster = poster;
  for (const s of sources) {
    const source = document.createElement("source");
    source.src = s.src;
    source.type = s.type;
    video.append(source);
  }

  dialog.append(bar, video);
  document.body.append(dialog);
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => {
    video.pause();
    dialog.remove();
    opener?.focus();
    onClose?.();
  });
  dialog.showModal();
  close.focus();
  soundOn(video); // every film on the page is muted while this one has sound
  if (!prefersReducedMotion()) void video.play().catch(() => undefined);
}

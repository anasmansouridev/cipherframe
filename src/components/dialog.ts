import { prefersReducedMotion } from "../runtime";

/**
 * Lazy-loaded: "Play concept" opens a native <dialog> with the MP4 (only rendered when a
 * video URL is configured). showModal() traps focus and Esc closes; focus returns to the opener.
 */
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

export function openVideo(src: string, title: string, opener?: HTMLElement): void {
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
  video.src = src;
  video.controls = true;
  video.playsInline = true;
  video.preload = "metadata";
  if (!prefersReducedMotion()) {
    video.muted = true;
    video.autoplay = true;
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
  });
  dialog.showModal();
  close.focus();
}

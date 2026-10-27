import { track } from "../analytics";
import { CFG, $, whenNear } from "../runtime";
import { attributionParams, withParams } from "../utm";

type CalFn = ((...args: unknown[]) => void) & {
  loaded?: boolean;
  ns: Record<string, (...args: unknown[]) => void>;
  q?: unknown[];
  config?: { forwardQueryParams?: boolean };
};
declare global {
  interface Window {
    Cal?: CalFn;
  }
}

const EMBED_SRC = "https://app.cal.com/embed/embed.js";
const NS = "intro";

/** The official Cal.com embed loader, typed: queues calls until embed.js arrives. */
/* eslint-disable @typescript-eslint/no-explicit-any */
function loader(): CalFn {
  const C = window as any;
  if (!C.Cal) {
    const p = (a: any, ar: unknown) => a.q.push(ar);
    C.Cal = function (...ar: unknown[]) {
      const cal = C.Cal;
      if (!cal.loaded) {
        cal.ns = {};
        cal.q = cal.q || [];
        document.head.appendChild(document.createElement("script")).src = EMBED_SRC;
        cal.loaded = true;
      }
      if (ar[0] === "init") {
        const api: any = (...a: unknown[]) => p(api, a);
        const namespace = ar[1];
        api.q = api.q || [];
        if (typeof namespace === "string") {
          cal.ns[namespace] = cal.ns[namespace] || api;
          p(cal.ns[namespace], ar);
          p(cal, ["initNamespace", namespace]);
        } else p(cal, ar);
        return;
      }
      p(cal, ar);
    };
  }
  return C.Cal as CalFn;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * The embed grows to its content's height, so it sits in a fixed-height scrolling window (.cal__embed).
 * "Scroll for more" shows while there is more below, and goes once the visitor reaches the end.
 */
function watchScroll(embed: HTMLElement, hint: HTMLElement | null, frame: HTMLIFrameElement): void {
  if (!hint) return;
  const update = () => {
    const below = embed.scrollHeight - embed.clientHeight - embed.scrollTop;
    hint.hidden = below <= 24;
  };
  embed.addEventListener("scroll", update, { passive: true });
  new ResizeObserver(update).observe(frame);
  update();
}

/** Inline month-view embed, lazy-loaded within 600px of the viewport, with a skeleton and a plain-link fallback. */
export function initCal(): void {
  const host = $("[data-cal]");
  const hint = $("[data-cal-hint]");
  const fallback = $<HTMLAnchorElement>("[data-cal-fallback]");
  const params = attributionParams();
  if (fallback) {
    fallback.href = withParams(CFG.cal.url, params);
    fallback.addEventListener("click", () => track("calendar_fallback_click"));
  }
  if (!host) return;

  let loaded = false;
  const markLoaded = () => {
    if (loaded) return;
    loaded = true;
    host.classList.add("is-loaded");
    track("calendar_loaded");
  };

  whenNear(
    host,
    () => {
      const Cal = loader();
      Cal.config = Cal.config || {};
      Cal.config.forwardQueryParams = true;
      Cal("init", NS, { origin: "https://cal.com" });
      const api = Cal.ns[NS];
      api("inline", {
        elementOrSelector: "#cal-inline",
        calLink: CFG.cal.link,
        layout: "month_view",
        config: { layout: "month_view", theme: "dark", ...params },
      });
      api("ui", {
        theme: "dark",
        cssVarsPerTheme: { dark: { "cal-brand": "#2BE4A0" }, light: { "cal-brand": "#2BE4A0" } },
        hideEventTypeDetails: false,
        layout: "month_view",
      });
      api("on", { action: "linkReady", callback: markLoaded });

      // Hide the skeleton as soon as the iframe has loaded, even if linkReady never fires.
      const embed = $("[data-cal-embed]", host);
      if (embed) {
        const mo = new MutationObserver(() => {
          const frame = embed.querySelector("iframe");
          if (!frame) return;
          mo.disconnect();
          frame.title ||= "Book a 15-minute call with Cipherframe";
          frame.addEventListener("load", markLoaded, { once: true });
          watchScroll(embed, hint, frame);
        });
        mo.observe(embed, { childList: true, subtree: true });
      }
    },
    "600px 0px",
  );
}

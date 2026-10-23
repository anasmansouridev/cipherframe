import { track, scrollDepth } from "../analytics";
import { CFG, $, session, setSession } from "../runtime";
import { withParams } from "../utm";

export const NUDGE_KEY = "cf_nudge";
export const CTA_KEY = "cf_cta";

/**
 * One-time slide-in (never a blocking pop-up): after 60% scroll depth or 45s, whichever
 * comes first, if no CTA was clicked and no form opened this session. Dismissible, never
 * shown again in the session, announced politely, and it never takes focus.
 */
export function initNudge(): void {
  const region = $("[data-nudge-region]");
  if (!region || session(NUDGE_KEY) || session(CTA_KEY)) return;

  let done = false;
  let bookVisible = false;
  const book = document.getElementById("book");
  const io = book
    ? new IntersectionObserver((entries) => {
        bookVisible = entries.some((e) => e.isIntersecting);
        if (!bookVisible && pending) tryShow();
      })
    : null;
  if (book && io) io.observe(book);

  let pending = false;
  const cleanup = () => {
    removeEventListener("scroll", onScroll);
    clearTimeout(timer);
    io?.disconnect();
  };
  const tryShow = () => {
    if (done) return;
    if (session(CTA_KEY) || session(NUDGE_KEY)) {
      done = true;
      cleanup();
      return;
    }
    if (bookVisible) {
      pending = true;
      return;
    }
    done = true;
    cleanup();
    show(region);
  };
  const onScroll = () => {
    if (scrollDepth() >= 0.6) tryShow();
  };
  const timer = window.setTimeout(tryShow, 45_000);
  addEventListener("scroll", onScroll, { passive: true });
}

function show(region: HTMLElement): void {
  setSession(NUDGE_KEY, "shown");
  const card = document.createElement("div");
  card.className = "nudge";
  card.setAttribute("role", "group");
  card.setAttribute("aria-label", "Free remake offer");
  card.dataset.nudge = "";

  const title = document.createElement("p");
  title.className = "nudge__title";
  title.textContent = "Want your last announcement animated, free?";
  const text = document.createElement("p");
  text.textContent = `We make ${CFG.freeRemakesPerDay} a day.`;

  const actions = document.createElement("div");
  actions.className = "nudge__actions";
  const yes = document.createElement("a");
  yes.className = "btn btn--primary";
  yes.href = withParams(CFG.tally.remakeFormUrl);
  yes.target = "_blank";
  yes.rel = "noopener";
  yes.textContent = "Get my free remake";
  yes.dataset.tally = "remake";
  const no = document.createElement("button");
  no.type = "button";
  no.className = "nudge__no";
  no.textContent = "No thanks";

  const close = () => card.remove();
  yes.addEventListener("click", () => {
    setSession(CTA_KEY, "nudge");
    track("nudge_click");
    close();
  });
  no.addEventListener("click", () => {
    setSession(NUDGE_KEY, "dismissed");
    track("nudge_dismiss");
    close();
  });
  card.addEventListener("keydown", (e) => {
    if (e.key === "Escape") no.click();
  });

  actions.append(yes, no);
  card.append(title, text, actions);
  region.append(card);
  track("nudge_shown");

  const book = document.getElementById("book");
  if (book) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        close();
      }
    });
    io.observe(book);
  }
}

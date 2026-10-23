/**
 * Inlined into <head> at build time (with a CSP hash) and run before first paint:
 * sets the tier, then applies personalisation and renders the event strip the moment
 * the parser has produced the hero. MutationObserver callbacks run at the microtask
 * checkpoint after each parser task, before the browser can render, so a DM visitor
 * never sees the default headline flash or the chip pop in (no layout shift).
 */
import { renderStrip } from "./components/countdown";
import { applyPersonalization } from "./personalize";
import { detectTier, setTier } from "./tier";

const root = document.documentElement;
root.classList.remove("no-js");
root.classList.add("js");
setTier(detectTier(true));
root.classList.toggle("motion-ok", root.dataset.tier !== "C");

let done = false;
const run = () => {
  if (done) return;
  done = true;
  applyPersonalization();
  renderStrip();
};
const ready = () => document.getElementById("hero-sub") !== null;
if (ready()) run();
else {
  const mo = new MutationObserver(() => {
    if (ready()) {
      mo.disconnect();
      run();
    }
  });
  mo.observe(root, { childList: true, subtree: true });
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      mo.disconnect();
      run();
    },
    { once: true },
  );
}

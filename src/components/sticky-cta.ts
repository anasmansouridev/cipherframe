import { $ } from "../runtime";

/** <768px: shows after the hero leaves the viewport; hides while #book (or the footer) is visible. */
export function initSticky(): void {
  const bar = $("[data-sticky]");
  const hero = document.getElementById("top");
  const book = document.getElementById("book");
  const footer = document.getElementById("footer");
  if (!bar || !hero) return;
  const mq = matchMedia("(max-width: 767.98px)");
  const seen = new Map<Element, boolean>([
    [hero, true],
    ...(book ? ([[book, false]] as [Element, boolean][]) : []),
    ...(footer ? ([[footer, false]] as [Element, boolean][]) : []),
  ]);
  const update = () => {
    const show = mq.matches && !seen.get(hero) && !(book && seen.get(book)) && !(footer && seen.get(footer));
    bar.classList.toggle("is-shown", show);
    bar.toggleAttribute("inert", !show);
    bar.setAttribute("aria-hidden", String(!show));
    bar.dataset.visible = String(show);
    document.documentElement.style.setProperty("--sticky-h", show ? "64px" : "0px");
  };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) seen.set(e.target, e.isIntersecting);
    update();
  });
  seen.forEach((_, el) => io.observe(el));
  mq.addEventListener("change", update);
  update();
}

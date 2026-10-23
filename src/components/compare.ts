import { $, $$ } from "../runtime";
import { registry } from "../motion/registry";

/**
 * M8 mobile: the table becomes a segmented control ("In-house · Freelancer · Studio")
 * comparing the chosen option against the Desk in two stacked glass cards. Cards are
 * built from the table itself, so the facts (and their footnotes) live in one place.
 */
export function initCompare(): void {
  const mobile = $("[data-cmp-mobile]");
  const cardsHost = $("[data-cmp-cards]");
  const table = $<HTMLTableElement>(".cmp__table");
  if (!mobile || !cardsHost || !table) return;

  const heads = $$("thead th", table).map((th) => th.textContent?.trim() ?? "");
  const rows = $$("tbody tr", table).map((tr) => ({
    label: tr.querySelector("th")?.textContent?.trim() ?? "",
    cells: $$("td", tr),
  }));

  const makeCard = (col: number, desk = false) => {
    const card = document.createElement("article");
    card.className = `cmp-card glass${desk ? " cmp-card--desk glass--featured" : ""}`;
    card.dataset.flipId = desk ? "desk" : "option";
    if (desk) {
      // Card/Featured with the border trace, built without innerHTML
      card.dataset.trace = "";
      const svgNS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("class", "trace");
      svg.setAttribute("aria-hidden", "true");
      const rect = document.createElementNS(svgNS, "rect");
      for (const [k, v] of Object.entries({ x: "0", y: "0", width: "100%", height: "100%", rx: "14", ry: "14", pathLength: "100" })) rect.setAttribute(k, v);
      svg.append(rect);
      card.append(svg);
    }
    const title = document.createElement("p");
    title.className = "cmp-card__title";
    const dl = document.createElement("dl");
    card.append(title, dl);
    const fill = (c: number) => {
      title.textContent = heads[c - 1] ?? "";
      dl.replaceChildren(
        ...rows.map((r) => {
          const row = document.createElement("div");
          row.className = "cmp-card__row";
          const dt = document.createElement("dt");
          dt.textContent = r.label;
          const dd = document.createElement("dd");
          r.cells[c - 1]?.childNodes.forEach((n) => dd.append(n.cloneNode(true)));
          row.append(dt, dd);
          return row;
        }),
      );
    };
    fill(col);
    return { card, fill };
  };

  const option = makeCard(1);
  const desk = makeCard(4, true);
  cardsHost.replaceChildren(option.card, desk.card);

  const radios = $$<HTMLButtonElement>("[data-cmp-opt]", mobile);
  const select = (btn: HTMLButtonElement, focus = false) => {
    radios.forEach((r) => {
      const on = r === btn;
      r.setAttribute("aria-checked", String(on));
      r.tabIndex = on ? 0 : -1;
    });
    if (focus) btn.focus();
    const { Flip, gsap } = registry;
    const state = Flip?.getState([option.card, desk.card, ...option.card.querySelectorAll(".cmp-card__row")]);
    option.fill(Number(btn.dataset.cmpOpt));
    if (Flip && gsap && state) {
      Flip.from(state, { duration: 0.5, ease: "power3.out", nested: true });
      gsap.from(option.card.querySelectorAll("dd"), { opacity: 0, y: 6, duration: 0.35, stagger: 0.04, ease: "power3.out" });
    }
  };
  radios.forEach((r, i) => {
    r.tabIndex = i === 0 ? 0 : -1;
    r.addEventListener("click", () => select(r));
    r.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      select(radios[(i + d + radios.length) % radios.length], true);
    });
  });

  mobile.hidden = false;
  mobile.dataset.ready = "";
}

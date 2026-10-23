import { CFG, $$ } from "../runtime";
import { attributionParams, withParams } from "../utm";

export const tallyUrl = (kind: "remake" | "clip"): string =>
  withParams(kind === "clip" ? CFG.tally.clipFormUrl : CFG.tally.remakeFormUrl, attributionParams());

/** Both Tally forms open in a new tab (in-app browsers block popups) with c, t and utm_* appended for hidden fields. */
export function initTally(): void {
  for (const a of $$<HTMLAnchorElement>("a[data-tally]")) {
    a.href = tallyUrl(a.dataset.tally === "clip" ? "clip" : "remake");
    a.target = "_blank";
    a.rel = "noopener";
  }
}

/**
 * M2, loaded first and on its own (GSAP core + ScrambleText + DrawSVG), so the H1 decode
 * never waits on ScrollTrigger, SplitText or Flip. Tiers A and B only.
 */
import { gsap } from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { $ } from "../runtime";

gsap.registerPlugin(ScrambleTextPlugin, DrawSVGPlugin);

/** M2: the last word of the H1 decodes (700ms) once fonts are ready; a mint underline draws itself. */
export async function heroDecode(): Promise<void> {
  const word = $(".h1-word");
  const line = $(".h1-underline path");
  if (!word) return;
  if (line) gsap.set(line, { drawSVG: "0%" });
  try {
    await document.fonts?.ready;
  } catch {
    /* decode anyway */
  }
  const text = word.textContent ?? "";
  word.style.width = `${word.getBoundingClientRect().width}px`; // no reflow while glyphs change
  const tl = gsap.timeline({ onComplete: () => void (word.style.width = "") });
  tl.to(word, { duration: 0.7, ease: "none", scrambleText: { text, chars: "01[]◆/\\", revealDelay: 0.1, speed: 0.8 } });
  if (line) tl.to(line, { drawSVG: "100%", duration: 0.7, ease: "power3.out" }, 0.15);
}


import type { HeroController } from "./field";

/** Late-bound references shared between the eager bundle and the lazy motion chunks. */
export const registry: {
  hero?: HeroController;
  gsap?: typeof import("gsap").gsap;
  Flip?: typeof import("gsap/Flip").Flip;
} = {};

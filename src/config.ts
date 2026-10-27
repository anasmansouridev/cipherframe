/**
 * CONFIG — the only file you need to edit.
 *
 * Every changeable fact on the page (links, slot counts, dates, videos,
 * testimonials) lives here. The build writes these values into the HTML, and
 * the page script reads them at runtime, so the site works with or without JS.
 *
 * Honesty rules (see README):
 * - deskSlotsLeft and foundingSlotsLeft must always be true. 0 hides the block.
 * - testimonials and clientLogos only render with permissionConfirmed: true.
 * - remakes are labelled "UNOFFICIAL CONCEPT · NOT AFFILIATED" automatically.
 */
import type { ConceptItem, WorkItem } from "./work.ts";

export const CONFIG = {
  domain: "https://cipherframe.studio",
  headlineVariant: "A" as "A" | "B",
  cal: { link: "anas-mansouri-bcw6cz/15min", url: "https://cal.com/anas-mansouri-bcw6cz/15min" },
  tally: { remakeFormUrl: "https://tally.so/r/labkxk", clipFormUrl: "https://tally.so/r/Dq4jXp" },
  social: {
    xUrl: "https://x.com/Cipherframehq",
    xHandle: "@Cipherframehq",
    xDmUrl: "",
    telegramUrl: "",
    telegramHandle: "",
    linkedinUrl: "",
  },
  email: "contact@cipherframe.studio",
  // start: "YYYY-MM-DD" is read as midnight UTC (London is on UTC in November).
  // A full ISO timestamp such as "2026-11-15T09:00:00Z" is used as-is.
  event: { name: "", dates: "", place: "", start: "" }, // empty name = no event: the strip shows only slots and free remakes
  deskSlotsLeft: 4, // must stay true; 0 hides the strip
  foundingSlotsLeft: 5, // must stay true; 0 hides the founding block
  foundingTotal: 5, // how many founding Desks exist in total (drives "of 5" and the pips)
  freeRemakesPerDay: 3,
  remakes: [] as { project: string; announcement: string; xPostUrl: string; poster: string }[],
  testimonials: [] as { quote: string; name: string; role: string; project: string; permissionConfirmed: boolean }[],
  clientLogos: [] as { name: string; src: string; permissionConfirmed: boolean }[],
  videos: { hero: "" },
  /**
   * Films in the Work section, shown before the studio concepts. Files live in public/work/
   * (npm run work encodes them from public/work/raw/). permission: false shows the dashed
   * "UNOFFICIAL CONCEPT · NOT AFFILIATED" tag; set true only with the brand's written OK.
   */
  work: [
    {
      slug: "spout",
      title: "Spout Finance · The Whale Vault",
      handle: "@SpoutFi",
      xUrl: "https://x.com/SpoutFi",
      meta: "5s · 1:1 · original sound design",
      line: "A whole product explained before the thumb moves. Built from their logo, frame by frame.",
      video: "/work/spout.mp4",
      webm: "/work/spout.webm",
      poster: "/work/spout-poster.webp",
      permission: false,
    },
    {
      slug: "0xbow",
      title: "0xbow · Into the Pool",
      handle: "@0xbowio",
      xUrl: "https://x.com/0xbowio",
      meta: "5s · 1:1 · original sound design",
      line: "A technical launch, turned into one calm, precise idea.",
      video: "/work/0xbow.mp4",
      webm: "/work/0xbow.webm",
      poster: "/work/0xbow-poster.webp",
      permission: false,
    },
    {
      slug: "archer",
      title: "Archer · One Book",
      handle: "@ArcherExchange_",
      xUrl: "https://x.com/ArcherExchange_",
      meta: "5s · 1:1 · original sound design",
      line: "A text-only launch, given the energy it deserved.",
      video: "/work/archer.mp4",
      webm: "/work/archer.webm",
      poster: "/work/archer-poster.webp",
      permission: false,
    },
  ] as WorkItem[],
  /**
   * Studio concepts, the three films under the Work films, in card order. Files live in public/work/
   * (npm run concepts encodes them from public/work/raw/concepts/). tag: ORIGINAL = our own piece,
   * CONCEPT = a studio concept (for a third-party brand, "UNOFFICIAL CONCEPT" says more). audio: false
   * hides the sound button.
   */
  concepts: [
    {
      slug: "work-01-pinned",
      tag: "ORIGINAL",
      title: "Static to motion · 48 hours.",
      meta: "15s · 16:9",
      line: "A flat mainnet post turns into a full network announcement.",
      audio: true,
    },
    {
      slug: "work-02-honeyb",
      tag: "CONCEPT",
      title: "Brand film · HoneyB.",
      meta: "5s · 16:9 + 1:1",
      line: "Bars become the hive. Bitcoin stays, income arrives.",
      audio: true,
    },
    {
      slug: "work-03-trezor-arc",
      tag: "CONCEPT",
      title: "Launch film · Trezor × Arc.",
      meta: "7s · 16:9 + 1:1 · 3D",
      line: "A coin rides the arc and lands on the Trusted Display.",
      audio: true,
    },
  ] as ConceptItem[],
  founder: { name: "Anas Mansouri", photo: "", note: "" }, // empty note = default text
  analytics: { cfBeaconToken: "", eventEndpoint: "" },
};

export type Config = typeof CONFIG;

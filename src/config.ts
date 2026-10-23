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
export const CONFIG = {
  domain: "https://cipherframe.com",
  headlineVariant: "A" as "A" | "B",
  cal: { link: "cipherframe/intro", url: "https://cal.com/cipherframe/intro" },
  tally: { remakeFormUrl: "https://tally.so/r/REMAKE", clipFormUrl: "https://tally.so/r/CLIP" },
  social: {
    xUrl: "https://x.com/cipherframe",
    xHandle: "@cipherframe",
    xDmUrl: "",
    telegramUrl: "",
    telegramHandle: "",
    linkedinUrl: "",
  },
  email: "hello@cipherframe.com",
  // start: "YYYY-MM-DD" is read as midnight UTC (London is on UTC in November).
  // A full ISO timestamp such as "2026-11-15T09:00:00Z" is used as-is.
  event: { name: "Solana Breakpoint", dates: "15–17 Nov", place: "London", start: "2026-11-15" },
  deskSlotsLeft: 4, // must stay true; 0 hides the strip
  foundingSlotsLeft: 3, // must stay true; 0 hides the founding block
  freeRemakesPerDay: 3,
  remakes: [] as { project: string; announcement: string; xPostUrl: string; poster: string }[],
  testimonials: [] as { quote: string; name: string; role: string; project: string; permissionConfirmed: boolean }[],
  clientLogos: [] as { name: string; src: string; permissionConfirmed: boolean }[],
  videos: { hero: "", mainnet: "", lending: "", payment: "" },
  founder: { name: "[Your name]", photo: "", note: "" }, // empty note = default text
  analytics: { cfBeaconToken: "", eventEndpoint: "" },
};

export type Config = typeof CONFIG;

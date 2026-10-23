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
  domain: "https://cipherframe.studio",
  headlineVariant: "A" as "A" | "B",
  cal: { link: "anas-mansouri-bcw6cz/15min", url: "https://cal.com/anas-mansouri-bcw6cz/15min" },
  tally: { remakeFormUrl: "https://tally.so/r/REMAKE", clipFormUrl: "https://tally.so/r/CLIP" },
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
  videos: { hero: "", mainnet: "", lending: "", payment: "" },
  founder: { name: "Anas Mansouri", photo: "", note: "" }, // empty note = default text
  analytics: { cfBeaconToken: "", eventEndpoint: "" },
};

export type Config = typeof CONFIG;

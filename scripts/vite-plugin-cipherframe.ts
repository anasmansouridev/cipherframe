/**
 * Build-time templating for index.html.
 *
 * - `{{key}}` tokens are replaced with HTML-escaped values from src/config.ts,
 *   so no link, slot count or handle is hard-coded in markup.
 * - `<!--@block-->` markers render config-driven blocks (handles, founding desks,
 *   testimonials...). Blocks whose CONFIG arrays are empty render nothing at all.
 * - `<!--@early-->` inlines src/early.ts as a classic script (its sha256 goes
 *   into the CSP in dist/_headers), so personalisation lands before first paint.
 * - JSON-LD (ProfessionalService + FAQPage) is generated from CONFIG and the FAQ markup.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { build, type Plugin, type ResolvedConfig } from "vite";
import { CONFIG } from "../src/config.ts";
import { icon, mark } from "../src/icons.ts";
import { finalHeadline, heroHeadline } from "../src/personalize.ts";

/**
 * Official brand files (PART 3 of the brand pass): when public/brand/ holds them, they are
 * inlined instead of the hand-drawn SVGs in src/icons.ts. File names follow the design system.
 */
let brandDir = path.resolve("public/brand"); // re-based on the Vite root in configResolved
const BRAND_FILES: Record<string, string[]> = {
  link: ["chain-link", "link"],
  zap: ["lightning", "zap"],
  arrow: ["arrow-right", "arrow"],
  chevron: ["chevron-down", "chevron"],
  x: ["x", "close"],
};
function brandSvg(file: string, cls: string): string | null {
  const p = path.join(brandDir, file);
  if (!fs.existsSync(p)) return null;
  const svg = fs
    .readFileSync(p, "utf8")
    .replace(/<\?xml[\s\S]*?\?>/, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
  if (!svg.startsWith("<svg")) return null;
  return svg.replace(/^<svg\b/, `<svg class="${cls}" aria-hidden="true" focusable="false"`);
}
const brandIcon = (name: string, cls: string) => {
  for (const f of BRAND_FILES[name] ?? [name]) {
    const svg = brandSvg(`icons/${f}.svg`, cls);
    if (svg) return svg;
  }
  return null;
};

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (v: unknown): string => String(v).replace(/[&<>"']/g, (c) => ENTITIES[c]);

const host = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};
const origin = (url: string) => {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
};

function tokens(): Record<string, string> {
  const h = heroHeadline({ project: null, topic: null }, CONFIG.headlineVariant);
  const domain = CONFIG.domain.replace(/\/+$/, "");
  return {
    domain,
    domainUrl: `${domain}/`,
    domainHost: host(domain),
    calUrl: CONFIG.cal.url,
    tallyRemake: CONFIG.tally.remakeFormUrl,
    tallyClip: CONFIG.tally.clipFormUrl,
    xUrl: CONFIG.social.xUrl,
    xHandle: CONFIG.social.xHandle,
    dmUrl: CONFIG.social.xDmUrl || CONFIG.social.xUrl,
    email: CONFIG.email,
    freeRemakesPerDay: String(CONFIG.freeRemakesPerDay),
    foundingSlotsLeft: String(CONFIG.foundingSlotsLeft),
    founderName: CONFIG.founder.name,
    h1Lead: h.lead,
    h1Last: h.last,
    finalH2: finalHeadline({ project: null, topic: null }),
    ogImage: `${domain}/og.png`,
  };
}

/** Strip text as of build time, without the countdown (JS adds it, so it can never go stale). */
function stripBlock(): string {
  const slots = CONFIG.deskSlotsLeft;
  const start = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(CONFIG.event.start) ? `${CONFIG.event.start}T00:00:00Z` : CONFIG.event.start);
  const { name, dates, place } = CONFIG.event;
  const text =
    name && start > Date.now()
      ? `◆ ${name} · ${dates} · ${place} — launch-week slots: ${slots} left`
      : `◆ ${slots} Desk slots open this month · ${CONFIG.freeRemakesPerDay} free remakes a day`;
  return `<div id="strip" class="strip"${slots > 0 ? "" : " hidden"}><div class="container"><p class="strip__text mono" data-strip>${esc(text)}</p></div></div>`;
}

function handlesBlock(): string {
  const s = CONFIG.social;
  const items: string[] = [];
  if (s.xHandle && s.xUrl) items.push(`X <a href="${esc(s.xUrl)}" rel="noopener me" target="_blank">${esc(s.xHandle)}</a>`);
  if (s.telegramHandle && s.telegramUrl)
    items.push(`Telegram <a href="${esc(s.telegramUrl)}" rel="noopener me" target="_blank">${esc(s.telegramHandle)}</a>`);
  if (s.linkedinUrl) items.push(`LinkedIn <a href="${esc(s.linkedinUrl)}" rel="noopener me" target="_blank">Cipherframe</a>`);
  items.push(`<a href="${esc(CONFIG.domain)}">${esc(host(CONFIG.domain))}</a>`);
  return items.join(" · ");
}

function foundingBlock(): string {
  const left = CONFIG.foundingSlotsLeft;
  if (!(left > 0)) return "";
  const total = 3;
  const pips = Array.from({ length: total }, (_, i) => (i < total - left ? `<span class="pip is-taken"><i></i></span>` : `<span class="pip"></span>`)).join("");
  return `<aside class="founding glass" data-founding aria-labelledby="founding-title">
          <div class="founding__pips" data-pips role="img" aria-label="${total - left} of ${total} founding Desks taken">${pips}</div>
          <div>
            <h3 id="founding-title" class="founding__title"><span data-founding-left>${left}</span> of 3 founding Desks left: $2,100/month for 3 months.</h3>
            <p>In return: a short case study (your static post vs the animated one) and permission to show the work.</p>
          </div>
        </aside>`;
}

function logosBlock(): string {
  const logos = CONFIG.clientLogos.filter((l) => l.permissionConfirmed && l.src && l.name);
  if (!logos.length) return "";
  return `<ul class="logos" data-logos aria-label="Teams we've worked with">${logos
    .map((l) => `<li><img src="${esc(l.src)}" alt="${esc(l.name)}" width="120" height="32" loading="lazy" decoding="async"></li>`)
    .join("")}</ul>`;
}

function testimonialsBlock(): string {
  const items = CONFIG.testimonials.filter((t) => t.permissionConfirmed && t.quote && t.name);
  if (!items.length) return "";
  return `<section class="section section--tight testimonials" data-testimonials aria-label="What clients say">
  <div class="container"><div class="testimonials__row">${items
    .map(
      (t) => `<figure class="testimonial glass"><blockquote><p>${esc(t.quote)}</p></blockquote>
      <figcaption><strong>${esc(t.name)}</strong><span>${esc(t.role)}, ${esc(t.project)}</span></figcaption></figure>`,
    )
    .join("")}</div></div></section>`;
}

function remakesBlock(): string {
  const items = CONFIG.remakes.filter((r) => r.project && r.xPostUrl);
  if (!items.length) return "";
  return `<div class="remakes" data-remakes>
        <h3 class="remakes__title">From our daily remake series</h3>
        <ul class="remakes__row">${items
          .map(
            (r) => `<li><a class="remake glass" href="${esc(r.xPostUrl)}" target="_blank" rel="noopener">
            ${r.poster ? `<img src="${esc(r.poster)}" alt="" width="640" height="360" loading="lazy" decoding="async">` : ""}
            <span class="tag tag--dashed">UNOFFICIAL CONCEPT · NOT AFFILIATED</span>
            <strong>${esc(r.project)}</strong><span>${esc(r.announcement)}</span></a></li>`,
          )
          .join("")}</ul>
      </div>`;
}

function founderMediaBlock(): string {
  if (CONFIG.founder.photo)
    return `<img class="founder__photo" src="${esc(CONFIG.founder.photo)}" alt="${esc(CONFIG.founder.name)}, founder of Cipherframe" width="160" height="160" loading="lazy" decoding="async">`;
  return `<span class="founder__mark">${mark("mark", 56)}</span>`;
}

function founderNoteBlock(): string {
  const name = CONFIG.founder.name;
  const text =
    CONFIG.founder.note ||
    `I'm ${name}. I kept watching great crypto teams ship real products, then announce them with a screenshot and a prayer. That's backwards. The work deserves to be seen. Cipherframe exists for one job: make every announcement you post look like the product behind it, in 48 hours, at a flat price, with all the risk on me.`;
  return text
    .split(/\n{2,}/)
    .map((para) => `<p>${esc(para.trim())}</p>`)
    .join("");
}

/** The right side of the before/after: a configured MP4, or the live DOM kinetic loop. */
function mainnetMediaBlock(): string {
  if (CONFIG.videos.mainnet)
    return `<div class="post__media post__media--video"><video data-autoplay muted loop playsinline preload="none" controls width="1280" height="720" src="${esc(CONFIG.videos.mainnet)}" aria-label="Animated mainnet announcement"></video></div>`;
  return `<div class="post__media kin" data-kin aria-label="Animated version: the project name slams in, MAINNET IS LIVE types on and a CONFIRMED pill pops" role="img">
              <svg class="kin__brackets" viewBox="0 0 320 180" preserveAspectRatio="none" aria-hidden="true"><path class="kin__br kin__br--l" d="M40 30H22v120h18"/><path class="kin__br kin__br--r" d="M280 30h18v120h-18"/></svg>
              <div class="kin__copy" aria-hidden="true">
                <span class="kin__title" data-kin-title data-p="project-upper">ARCLIGHT</span>
                <span class="kin__line" data-kin-line>MAINNET IS <em>LIVE</em></span>
                <span class="pill pill--mint kin__pill" data-kin-pill>CONFIRMED</span>
              </div>
              <svg class="kin__hex" viewBox="0 0 120 120" aria-hidden="true"><path class="kin__hexpath" d="M60 10 103 35v50L60 110 17 85V35Z"/><path class="kin__hexin" d="M60 34 82 47v26L60 86 38 73V47Z"/>${[
                [48, 50],
                [66, 46],
                [58, 62],
                [74, 64],
                [46, 72],
                [62, 78],
              ]
                .map(([cx, cy]) => `<circle class="kin__dot" data-kin-dot r="3.2" cx="${cx}" cy="${cy}"/>`)
                .join("")}</svg>
              <span class="kin__sweep" aria-hidden="true"></span>
            </div>`;
}

/** A rendered hero loop (CONFIG.videos.hero) replaces the code-generated transaction field. */
function heroVideoBlock(): string {
  if (!CONFIG.videos.hero) return "";
  return `<video class="hero__video" data-autoplay muted loop playsinline preload="none" controls width="1000" height="900" src="${esc(CONFIG.videos.hero)}" aria-label="Cipherframe showreel"></video>`;
}

function playButton(key: keyof typeof CONFIG.videos, title: string): string {
  const src = CONFIG.videos[key];
  if (!src) return "";
  return `<button class="btn btn--ghost work__play" type="button" data-play="${esc(src)}" data-play-title="${esc(title)}">${icon("play")}Play concept</button>`;
}

const stripTags = (html: string) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .replace(/&(amp|lt|gt|quot|#39);/g, (m) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" })[m] ?? m)
    .trim();

function jsonLd(html: string): string {
  const domain = CONFIG.domain.replace(/\/+$/, "");
  const offer = (name: string, price: number, description: string, extra: Record<string, unknown> = {}) => ({
    "@type": "Offer",
    price: String(price),
    priceCurrency: "USD",
    itemOffered: { "@type": "Service", name, description },
    ...extra,
  });
  const sameAs = [CONFIG.social.xUrl, CONFIG.social.telegramUrl, CONFIG.social.linkedinUrl].filter(Boolean);
  const faq: { q: string; a: string }[] = [];
  const re = /<summary[^>]*>([\s\S]*?)<\/summary>\s*<div class="faq__a">([\s\S]*?)<\/div>/g;
  for (let m = re.exec(html); m; m = re.exec(html)) faq.push({ q: stripTags(m[1]), a: stripTags(m[2]) });
  const graph = [
    {
      "@type": "ProfessionalService",
      "@id": `${domain}/#studio`,
      name: "Cipherframe",
      url: `${domain}/`,
      slogan: "Explain the invisible.",
      description:
        "Motion design studio for crypto teams. Announcement videos in 48 hours, feature videos, protocol explainers and launch packs at flat prices.",
      image: `${domain}/og.png`,
      logo: `${domain}/favicon.svg`,
      email: CONFIG.email,
      areaServed: "Worldwide",
      priceRange: "$750–$6,500",
      ...(sameAs.length ? { sameAs } : {}),
      makesOffer: [
        offer("Announcement Clip", 750, "10–15s announcement video in 16:9, 1:1 and 9:16 with burned-in captions and 1 revision, delivered in 48 hours."),
        offer("Feature Video", 1800, "30–45s feature video with script, 3 formats and 2 revisions, delivered in 4 business days."),
        offer("Announcement Desk", 3000, "Up to 6 announcements a month, a brand motion kit in month 1 and a priority queue in launch weeks. 48h per clip.", {
          priceSpecification: { "@type": "UnitPriceSpecification", price: "3000", priceCurrency: "USD", unitCode: "MON", unitText: "month" },
        }),
        offer("Protocol Explainer", 3500, "60–90s how-it-works explainer with script and storyboard, delivered in 8 business days."),
        offer("Launch Pack", 6500, "45s trailer, 60s explainer, 4 announcement clips and a logo animation, delivered in 12 business days."),
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];
  const json = JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

function renderBlocks(html: string): string {
  const blocks: Record<string, (...args: string[]) => string> = {
    icon: (name, cls) => {
      const c = cls ? `icon ${cls}` : "icon";
      return brandIcon(name, c) ?? icon(name, c);
    },
    mark: (cls, size) => brandSvg("mark.svg", cls || "mark")?.replace(/<svg\b/, `<svg width="${size || 28}" height="${size || 28}"`) ?? mark(cls || "mark", size ? Number(size) : 28),
    logo: () => `${brandSvg("mark.svg", "logo__mark")?.replace(/<svg\b/, '<svg width="28" height="28"') ?? mark("logo__mark", 28)}<span class="logo__word">cipherframe</span>`,
    /** Desk card / Desk column border trace: one short mint highlight, once around every 6s. */
    trace: () => `<svg class="trace" aria-hidden="true" focusable="false"><rect x="0" y="0" width="100%" height="100%" rx="14" ry="14" pathLength="100" /></svg>`,
    strip: stripBlock,
    handles: handlesBlock,
    founding: foundingBlock,
    logos: logosBlock,
    testimonials: testimonialsBlock,
    remakes: remakesBlock,
    founderMedia: founderMediaBlock,
    founderNote: founderNoteBlock,
    mainnetMedia: mainnetMediaBlock,
    heroVideo: heroVideoBlock,
    play: (key, ...title) => playButton(key as keyof typeof CONFIG.videos, title.join(":")),
  };
  return html.replace(/<!--@([a-zA-Z]+)((?::[^>]*?)?)-->/g, (whole, name: string, args: string) => {
    if (name === "early" || name === "jsonld") return whole;
    const fn = blocks[name];
    if (!fn) throw new Error(`index.html: unknown block <!--@${name}-->`);
    return fn(...(args ? args.slice(1).split(":") : []));
  });
}

function renderTokens(html: string): string {
  const t = tokens();
  return html.replace(/\{\{\s*([a-zA-Z0-9]+)\s*\}\}/g, (_, key: string) => {
    if (!(key in t)) throw new Error(`index.html: unknown token {{${key}}}`);
    return esc(t[key]);
  });
}

export function cipherframe(): Plugin {
  let cfg: ResolvedConfig;
  let earlyCode = "";
  let earlyHash = "";

  return {
    name: "cipherframe",
    configResolved(c) {
      cfg = c;
      brandDir = path.resolve(c.root, "public/brand");
    },
    async buildStart() {
      if (cfg.command !== "build") return;
      const out = await build({
        configFile: false,
        root: cfg.root,
        logLevel: "warn",
        publicDir: false,
        build: {
          write: false,
          minify: true,
          target: "es2019",
          lib: { entry: path.resolve(cfg.root, "src/early.ts"), formats: ["iife"], name: "cfEarly", fileName: () => "early.js" },
        },
      });
      const result = Array.isArray(out) ? out[0] : out;
      const chunk = (result as { output: { type: string; code?: string }[] }).output.find((o) => o.type === "chunk");
      if (!chunk?.code) throw new Error("early.ts did not compile");
      earlyCode = chunk.code.trim().replace(/<\/script/gi, "<\\/script");
      earlyHash = `'sha256-${createHash("sha256").update(earlyCode).digest("base64")}'`;
    },
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        let out = renderTokens(renderBlocks(html));
        out = out.replace("<!--@jsonld-->", jsonLd(out));
        out = out.replace(
          "<!--@early-->",
          cfg.command === "build" ? `<script>${earlyCode}</script>` : `<script type="module" src="/src/early.ts"></script>`,
        );
        return out;
      },
    },
    closeBundle() {
      if (cfg.command !== "build") return;
      const dir = path.resolve(cfg.root, cfg.build.outDir);
      const domain = CONFIG.domain.replace(/\/+$/, "");
      const extraConnect = [CONFIG.analytics.eventEndpoint].map(origin).filter((o) => o && o !== origin(domain));
      const extraMedia = [...Object.values(CONFIG.videos)].map(origin).filter((o) => o && o !== origin(domain));
      const extraImg = [...CONFIG.remakes.map((r) => r.poster), ...CONFIG.clientLogos.map((l) => l.src), CONFIG.founder.photo]
        .map(origin)
        .filter((o) => o && o !== origin(domain));
      const uniq = (a: string[]) => [...new Set(a)].join(" ");
      const replace = (file: string, map: Record<string, string>) => {
        const p = path.join(dir, file);
        if (!fs.existsSync(p)) return;
        let s = fs.readFileSync(p, "utf8");
        for (const [k, v] of Object.entries(map)) s = s.split(k).join(v);
        fs.writeFileSync(p, s);
      };
      replace("_headers", {
        __EARLY_HASH__: earlyHash,
        " __EXTRA_CONNECT__": extraConnect.length ? ` ${uniq(extraConnect)}` : "",
        " __EXTRA_MEDIA__": extraMedia.length ? ` ${uniq(extraMedia)}` : "",
        " __EXTRA_IMG__": extraImg.length ? ` ${uniq(extraImg)}` : "",
      });
      replace("robots.txt", { __DOMAIN__: domain });
      replace("llms.txt", { __DOMAIN__: domain });
      replace("sitemap.xml", { __DOMAIN__: domain, __LASTMOD__: new Date().toISOString().slice(0, 10) });
    },
  };
}

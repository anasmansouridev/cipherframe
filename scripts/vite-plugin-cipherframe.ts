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
import { workTag } from "../src/work.ts";

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
  const total = CONFIG.foundingTotal;
  const pips = Array.from({ length: total }, (_, i) => (i < total - left ? `<span class="pip is-taken"><i></i></span>` : `<span class="pip"></span>`)).join("");
  return `<aside class="founding glass" data-founding aria-labelledby="founding-title">
          <div class="founding__pips" data-pips role="img" aria-label="${total - left} of ${total} founding Desks taken">${pips}</div>
          <div>
            <h3 id="founding-title" class="founding__title"><span data-founding-left>${left}</span> of <span data-founding-total>${total}</span> founding Desks left: $990/month for 3 months.</h3>
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

/** "Prefer DMs? Message @handle on X." Rendered only when an X handle and a link exist; with no X account it is absent. */
function dmLineBlock(): string {
  const s = CONFIG.social;
  const href = s.xDmUrl || s.xUrl;
  if (!s.xHandle || !href) return "";
  return `<p class="book__dm">Prefer DMs? Message <a href="${esc(href)}" target="_blank" rel="noopener" data-cta="dm" data-loc="book"><strong>${esc(s.xHandle)}</strong></a> on X. DM "DESK".</p>`;
}

/** twitter:site only when there is an X handle (an empty value is invalid). */
function twitterSiteBlock(): string {
  return CONFIG.social.xHandle ? `<meta name="twitter:site" content="${esc(CONFIG.social.xHandle)}" />` : "";
}

/**
 * The Work films (CONFIG.work). One card each: 1:1 poster/video, tag, title, meta, line, "View on X".
 * Videos are preload="none", so nothing downloads until src/components/work-videos.ts plays one.
 * Exported so tests can render it with a different `permission` value.
 */
export function workVideosBlock(): string {
  if (!CONFIG.work.length) return "";
  const cards = CONFIG.work
    .map((w) => {
      const tag = workTag(w.permission);
      const sources = [w.webm ? `<source src="${esc(w.webm)}" type="video/webm">` : "", `<source src="${esc(w.video)}" type="video/mp4">`].join("");
      return `<article class="wv glass" data-wv data-slug="${esc(w.slug)}" data-permission="${w.permission}">
            <div class="wv__media">
              <video class="wv__video" data-wv-video muted loop playsinline preload="none" poster="${esc(w.poster)}" width="720" height="720" aria-label="${esc(w.title)}: 5-second animated film">${sources}</video>
              <button class="wv__toggle" type="button" data-wv-toggle aria-label="Play video: ${esc(w.title)}"><span class="wv__play" aria-hidden="true">${icon("play")}</span></button>
              <button class="wv__sound" type="button" data-wv-sound aria-label="Turn sound on">${icon("mute", "icon wv__ico wv__ico--off")}${icon("sound", "icon wv__ico wv__ico--on")}</button>
            </div>
            <div class="wv__body">
              <span class="${tag.cls}">${esc(tag.text)}</span>
              <h3 class="wv__title">${esc(w.title)}</h3>
              <p class="mono wv__meta">${esc(w.meta)}</p>
              <p class="wv__line">${esc(w.line)}</p>
              <a class="wv__x" href="${esc(w.xUrl)}" target="_blank" rel="noopener" data-work-x="${esc(w.slug)}">View on X <span aria-hidden="true">↗</span><span class="sr-only"> for ${esc(w.title)} (${esc(w.handle)})</span></a>
            </div>
          </article>`;
    })
    .join("\n          ");
  return `<div class="wvideos" data-wvideos>
          ${cards}
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
      priceRange: "$200–$1,490",
      ...(sameAs.length ? { sameAs } : {}),
      makesOffer: [
        offer("Announcement Clip", 200, "10–15s announcement video in 16:9, 1:1 and 9:16 with burned-in captions and 1 revision, delivered in 48 hours."),
        offer("Feature Video", 350, "30–45s feature video with script, 3 formats and 2 revisions, delivered in 4 business days."),
        offer("Unlimited Desk", 1490, "Unlimited announcement clips, one request at a time, each delivered in 48 hours, plus 1 feature video a month, a brand motion kit in month 1 and priority in launch weeks.", {
          priceSpecification: { "@type": "UnitPriceSpecification", price: "1490", priceCurrency: "USD", billingDuration: "P1M", unitCode: "MON", unitText: "month" },
        }),
        offer("Protocol Explainer", 790, "60–90s how-it-works explainer with script and storyboard, delivered in 8 business days."),
        offer("Launch Pack", 1290, "45s trailer, 60s explainer, 4 announcement clips and a logo animation, delivered in 12 business days."),
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
    heroVideo: heroVideoBlock,
    dmLine: dmLineBlock,
    workVideos: workVideosBlock,
    twitterSite: twitterSiteBlock,
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
      fs.rmSync(path.join(dir, "work/raw"), { recursive: true, force: true }); // originals are kept in git, never shipped
      replace("robots.txt", { __DOMAIN__: domain });
      replace("llms.txt", { __DOMAIN__: domain });
      replace("sitemap.xml", { __DOMAIN__: domain, __LASTMOD__: new Date().toISOString().slice(0, 10) });
    },
  };
}

# Cipherframe: one-page funnel

A one-page sales funnel for Cipherframe, a motion design studio for crypto teams. It's built mobile-first for visitors arriving from X and LinkedIn DMs, inside in-app browsers.

- **Stack:** Vite + TypeScript (strict), no UI framework, static output in `dist/`.
- **Motion:** GSAP (ScrollTrigger, SplitText, ScrambleText, DrawSVG, Flip), OGL for the WebGL hero, and Lenis on desktop.
- **Deploy:** a Docker image served by nginx (Hostinger VPS with EasyPanel), or Cloudflare Pages.

The page works without JavaScript. Every changeable fact comes from `src/config.ts`.

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # typecheck, build to dist/, print gzipped sizes and enforce budgets
npm run preview      # serve dist/ on http://localhost:4173
npm test             # Playwright (builds first)
npm run lighthouse   # Lighthouse mobile, 3 runs per URL, median reported
```

Other scripts: `npm run typecheck`, and `npm run og`, which re-renders `public/og.png` from HTML.

---

## 1. File tree

```
index.html                      semantic skeleton; all copy in HTML; {{tokens}} and <!--@blocks--> filled from CONFIG at build
src/config.ts                   CONFIG: the only file you edit
src/early.ts                    tiny boot script, inlined into <head> (tier + personalisation before first paint)
src/main.ts                     boot: tier → personalise → mount sections → lazy features
src/runtime.ts                  CONFIG + test overrides, DOM helpers, manual scroll anchoring
src/tier.ts                     Tier A/B/C detection + FPS probe
src/personalize.ts              ?c / ?t sanitising and headline copy
src/utm.ts                      first-touch UTMs (sessionStorage) and URL decoration
src/analytics.ts                track(), Cloudflare beacon, scroll depth, pricing_view
src/icons.ts                    Lucide-style icons and the logo mark (rendered at build)
src/components/                 before-after, timeline, compare, sticky-cta, nudge, countdown, dialog (lazy)
src/integrations/               cal.ts (lazy Cal.com inline embed), tally.ts
src/motion/hero-webgl.ts        Tier A particle field (lazy, OGL)
src/motion/hero-canvas.ts       Tier B particle field (lazy, Canvas 2D)
src/motion/field.ts             shared geometry, render loop that pauses off-screen
src/motion/decode.ts            M2 H1 decode (lazy: GSAP core + ScrambleText + DrawSVG)
src/motion/sections.ts          M3–M13 (lazy: ScrollTrigger, SplitText, Flip, Lenis)
src/styles/                     tokens.css (design-system tokens) base.css glass.css sections.css motion.css
                                grain.css (generated noise tile; lazy, Tier A only)
public/                         favicon.svg og.png (1200×630) _headers robots.txt sitemap.xml llms.txt
public/brand/ (optional)        official logo and icon SVGs; inlined at build when present (§7)
scripts/vite-plugin-cipherframe.ts   build-time templating, JSON-LD, CSP hash, domain placeholders
scripts/report-sizes.mjs        gzip report + budget check (runs in npm run build)
scripts/lighthouse.mjs          Lighthouse runner
scripts/make-og.mjs             renders og.png
scripts/make-grain.mjs          writes src/styles/grain.css (128px 2-bit noise PNG as a data URI)
scripts/headers-to-nginx.mjs    turns dist/_headers into nginx add_header lines (used by the Dockerfile)
Dockerfile  nginx.conf          build the site and serve it with nginx (EasyPanel / any Docker host)
.dockerignore
tests/*.spec.ts                 Playwright (tests/brand.spec.ts fails the build on design-system drift;
                                tests/socials.spec.ts checks empty social handles leave no dead UI)
```

---

## 2. Editing `src/config.ts`

Change the file, then rebuild. The build writes the values into the HTML, so links work without JS. The page script reads the same values at runtime.

| Field | What it does |
|---|---|
| `domain` | Canonical URL, OG image URL, `sitemap.xml`, `robots.txt`, the handles box. |
| `headlineVariant` | `"A"`: *Stop launching into silence.* `"B"`: *Every announcement, animated in 48 hours.* A personalised link (`?c=`) always wins. |
| `cal.link` / `cal.url` | Cal.com event (`user/event`) for the inline embed, and the full URL for the "Open it in your browser" fallback. |
| `tally.remakeFormUrl` / `clipFormUrl` | Your two Tally forms. Every Tally button opens these in a new tab with `c`, `t` and `utm_*` appended. |
| `social.*` | All optional, and empty by default. With no X account, the "Prefer DMs? Message @handle on X" line, the `twitter:site` tag and the X link in the footer all disappear. `xUrl` and `xHandle` (both needed) power the DM line and the handles box; `xDmUrl` is a direct DM link, and if empty the profile URL is used. Telegram and LinkedIn only appear when set. The footer box always lists the site itself. |
| `email` | Footer email with a copy button. It must be a mailbox you actually receive: create `contact@cipherframe.studio` (or change this value) before launch. |
| `event` | Strip text. Empty by default (no event; the strip shows only slots and free remakes). `start: "YYYY-MM-DD"` is read as midnight UTC; a full ISO time such as `"2026-11-15T09:00:00Z"` is used as-is. Once the date passes, the strip switches to the slots-only message. The countdown never resets. |
| `deskSlotsLeft` | Must stay true. `0` hides the strip. |
| `foundingTotal` | How many founding Desks exist in total (5): drives the "of 5" headline and the number of pips. |
| `foundingSlotsLeft` | Must stay true. `0` hides the founding block. Pips fill for taken slots. |
| `freeRemakesPerDay` | Used everywhere the page says "3 a day". |
| `remakes[]` | "From our daily remake series" row; it renders only when there are entries. Each card is labelled **UNOFFICIAL CONCEPT · NOT AFFILIATED** and links to the X post. Use a 16:9 WebP/AVIF `poster`. |
| `testimonials[]`, `clientLogos[]` | Rendered **only** for entries with `permissionConfirmed: true`. The testimonial strip appears after `#work` and the logo row under the hero proof row. With no confirmed entries, those blocks are not in the DOM at all. |
| `videos.*` | See §3. |
| `founder` | `name` (replace `[Your name]`). `photo` must be a real photo of you; if empty, the logo mark shows. `note` overrides the default note; separate paragraphs with a blank line. |
| `analytics.cfBeaconToken` | Turns on Cloudflare Web Analytics (no cookies). |
| `analytics.eventEndpoint` | URL that receives custom events (see §9). Empty means events only log in dev. |

The build also keeps `dist/_headers` in sync with the config: it adds the origins of any video, image or event endpoint you configure to the CSP.

## 3. Swapping in rendered videos

Put MP4s (H.264, muted-friendly) in `public/videos/` or on a CDN, and set the URLs:

```ts
videos: { hero: "", mainnet: "/videos/mainnet.mp4", lending: "/videos/lending.mp4", payment: "/videos/payment.mp4" },
```

- `mainnet` replaces the live DOM loop on the right side of the before/after.
- `lending` and `payment` (and `mainnet`) add a **Play concept** button to the matching work card. It opens a `<dialog>` with the video, lazy-loaded; Esc closes it and focus returns to the button.
- `hero` replaces the code-generated transaction field in the hero with your loop.

Inline videos autoplay muted only while visible. Under reduced motion they are click-to-play with controls. Videos on another domain are added to the CSP automatically at build.

## 4. Deploying

### A. Hostinger VPS with EasyPanel (Docker)

EasyPanel pulls this repo from GitHub, builds the `Dockerfile` and serves the result with nginx. Nothing is uploaded by hand.

1. In `src/config.ts`, set `domain` (currently `https://cipherframe.studio`), the Cal.com link, both Tally URLs and your name. Commit and push to `main`: the values are built into the page.
2. EasyPanel → your project → **+ Service → App**.
3. **Source → GitHub**: owner `anasmansouridev`, repo `cipherframe`, branch `main`. For a private repo, add the key EasyPanel shows under the repo's **Settings → Deploy keys** (read-only).
4. **Build → Dockerfile** (path `Dockerfile`).
5. **Domains & Proxy**: add your domain and set the port to **80**.
6. **Deploy**. The first build takes a couple of minutes.
7. DNS: add an **A record** for `@` (and `www`) pointing at the VPS IP. If you use Cloudflare, keep the cloud grey ("DNS only") until the certificate is issued. EasyPanel's proxy issues the free HTTPS certificate automatically.
8. To update later: push to GitHub, then press **Deploy** again.

What the image does:
- The build stage runs `npm run build` (typecheck, build, size budgets) and turns `dist/_headers` into nginx headers with `scripts/headers-to-nginx.mjs`. The CSP script hash is read from the real build, so the two can never drift. The build fails if the CSP or its hash is missing.
- nginx serves `dist/` with those headers, gzip, a one-year immutable cache for `/assets/`, and revalidation for the page itself. `_headers`, dotfiles and unknown paths return 404.
- `www.<domain>` redirects to `<domain>` (only matters if you add the `www` domain in EasyPanel too).

Test it locally (needs Docker): `docker build -t cipherframe . && docker run --rm -p 8080:80 cipherframe`, then open http://localhost:8080.

### B. Cloudflare Pages

1. Pages → Create project → connect this repo.
2. **Root directory:** leave empty (the site is the repo root). **Build command:** `npm run build`. **Build output directory:** `dist`.
3. Environment variable `NODE_VERSION=22` (Vite 8 needs Node ≥ 20.19).
4. Deploy, then open the live site's DevTools console and book a test call. If the CSP blocks a Cal.com sub-resource, add only that domain to `public/_headers`. The policy starts strict on purpose.

`public/_headers` ships:
- a strict CSP: `self`, Cal.com, Tally (frames and forms) and Cloudflare Insights only, plus the sha256 of the inlined boot script, filled in at build;
- `nosniff`, `strict-origin-when-cross-origin`, a locked-down `Permissions-Policy`, `X-Frame-Options`, HSTS;
- immutable caching for `/assets/*`.

Cloudflare Pages reads `_headers` directly; the Docker image reads the same file, so there is one source of truth.

## 5. DM link formats

| DM | Link |
|---|---|
| Remake teaser (X DM 1) | `https://cipherframe.studio/?c={Project}&t={mainnet\|listing\|partnership\|upgrade\|launch\|raise}&utm_source=x&utm_medium=dm&utm_campaign=dm1#difference` |
| Funding (X DM 2) | `https://cipherframe.studio/?c={Project}&t=raise&utm_source=x&utm_medium=dm&utm_campaign=dm2#desk` |
| Launch coming (X DM 3) | `https://cipherframe.studio/?c={Project}&t=launch&utm_source=x&utm_medium=dm&utm_campaign=dm3#pricing` |
| LinkedIn | `https://cipherframe.studio/?c={Company}&utm_source=linkedin&utm_medium=dm&utm_campaign=seqA#difference` |

Rules the page applies:
- **`c`:** letters, digits, spaces and `& . - '`, at most 40 characters, URL-encoded (`Arclight%20Labs`). Anything else means the whole value is ignored and the default copy shows.
- **`t`:** one of the six topics, otherwise ignored.
- **Copy with `c`:** the chip "◆ Prepared for {Project}" plus a personalised H1 and final headline.
- **Deep links** (`#difference`, `#desk`, `#pricing`) land instantly and stay put while lazy features load (tested).

**Tally hidden fields:** in both forms add hidden fields named `c`, `t`, `utm_source`, `utm_medium`, `utm_campaign` (plus `utm_term` and `utm_content` if you use them). Suggested fields:
- **Remake form:** X handle, link to the latest announcement, project name, email or Telegram (optional), consent checkbox.
- **Clip form:** project, X handle, announcement text or link, deadline, payment method (USDC/USDT + chain, or card).

Cal.com receives the same values: `forwardQueryParams` is on, and they're also passed in the embed config.

## 6. Manual checklist (tick before launch)

- [ ] Fill in `src/config.ts`: `domain`, Cal.com link, both Tally URLs, founder name (and a real photo or none), event, slot counts. X / Telegram / LinkedIn are optional.
- [ ] Create the mailbox in `email` (default `contact@cipherframe.studio`) or change it, so enquiries reach you.
- [ ] Test inside the **X app** on iOS and on Android.
- [ ] Test inside the **LinkedIn app** on iOS and on Android.
- [ ] Book a test call through the inline calendar, and once through the "Open it in your browser" link.
- [ ] Submit both Tally forms from a DM-style link and confirm `c`, `t` and the UTMs arrived in the hidden fields.
- [ ] Click every link: hero CTAs, sticky bar, pricing buttons, FAQ "Order a $200 clip", the DM line, the footer handles, email copy.
- [ ] Check the DM button opens X (DM link if `xDmUrl` is set).
- [ ] On a low-end Android, open the console and check `document.documentElement.dataset.tier` (expect `B` or `C`, with smooth scrolling).
- [ ] Check the strip's slot count and the founding count are true today.
- [ ] Open DevTools on the live domain: no CSP violations from Cal.com (the CSP has been checked against the nginx image with no violations from our own code, but Cal.com's own embed could not be exercised offline).

## 7. Design system

The styling follows the **Cipherframe design system** (Claude Design, 22 Oct 2026). `tests/brand.spec.ts` fails the build if it drifts.

**Tokens** (`src/styles/tokens.css`; use these names so the design system's components drop in unchanged). Meaning is fixed: mint = confirmed, blue = in flight, coral = reverted.

| Token | Value | Use |
|---|---|---|
| `--midnight` | `#0A0F1E` | page background |
| `--deep-navy` | `#111933` | cards |
| `--panel` | `#17213F` | raised and featured surfaces |
| `--grid-line` | `#26324F` | 1px dividers and the grid only; never text or control borders |
| `--ice` / `--steel` | `#EAF0FA` / `#A3AFC6` | text / secondary text |
| `--signal-mint` / `--cta-ink` | `#2BE4A0` / `#04140D` | primary action, CONFIRMED, the logo diamond / text on mint |
| `--packet-blue` | `#7B9BFF` | IN FLIGHT; also `--focus-ring` |
| `--alert-coral` | `#FF6B57` | REVERTED only, ≤5% of a screen |
| `--mint-wash` `--blue-wash` `--coral-wash` | accent at 12% | pill backgrounds only |
| `--radius-sm` / `-button` / `-card` / `-pill` | 6 / 10 / 14 / 999px | tags / buttons / cards / pills |
| `--space-1 … --space-16` | 4–64px | 4px spacing scale; card padding 24px, gap between cards 32px |

**Type:** Space Grotesk 600 for h1 `clamp(2.4rem, 1.5rem + 3.6vw, 4.2rem)`, h2 `clamp(1.75rem, 1.3rem + 1.8vw, 2.6rem)`, h3 1.375rem and prices 2.75rem (tabular figures). Inter for lead 1.25rem, body 1.0625rem and small 0.9375rem (500). JetBrains Mono 500 for labels at 0.78rem, uppercase, +0.08em.

**Glass** (`.glass`):
- Panel at 55% with `blur(18px) saturate(140%)` (Tier A).
- 1px `--grid-line` border with a lighter top edge; the border turns `--steel` on hover.
- A mint spotlight at 8% follows the cursor. No shadows anywhere.
- `.glass--featured` is panel at 70% with a 1px `--signal-mint` border, used on the Desk card and the Desk comparison column.
- Tiers B and C use solid `--deep-navy` (featured: `--panel`).

**Components:**
- **Button/Primary:** mint, 48px, 10px radius. Phones keep 56px for the hero and booking-section CTAs (`.btn--xl`).
- **Button/Ghost:** glass with a 1px `--steel` border that turns `--ice` on hover.
- **Pill/Status:** 28px, leading 7px diamond, mono label, wash background.
- **Tag:** 24px. CONCEPT is steel on panel; UNOFFICIAL is dashed steel; BEST VALUE is filled mint.
- **Focus ring:** 2px blue with a 2px offset, so it stays visible around a mint button.

**Texture:**
- One 40px grid per view (grid-line at 35%, radial mask), never animated.
- One static mint radial glow (≤10%) behind the hero, the Desk card and the final CTA.
- Film grain is a pre-rendered 128px noise tile at 4%, Tier A only. It is loaded lazily, so it never weighs on the render-blocking CSS.

**Motion:**
- Fast ease-out `cubic-bezier(0.22,1,0.36,1)` (GSAP `power4.out`); entrances are a fade plus a 12px rise.
- No bounce, overshoot, spin, 3D or tilt.
- The Desk card and Desk column carry one short mint highlight that travels once around the border every 6s (Tiers A and B, off under reduced motion).
- The guarantee cards rise in, then their status pill cross-fades from IN FLIGHT to CONFIRMED 400ms after landing.
- Timeline stops are 18px diamonds: filled mint = done, blue outline = current, grid-line outline = pending.

**Brand files:** drop official SVGs into `public/brand/` and rebuild; the build inlines them in place of the hand-drawn versions.
- The mark goes in `mark.svg`.
- Icons go in `icons/<name>.svg`: `wallet bridge vault hexagon coins chain-link key lock lightning calendar check x arrow-right play copy chevron-down`.
- Anything missing falls back to the inline SVGs, which already use the design system's paths.

## 8. How it behaves

**Tiers** (`src/tier.ts`, set as `data-tier` on `<html>`):

| | Tier A | Tier B | Tier C |
|---|---|---|---|
| Trigger | WebGL2 and either a fine pointer with ≥8 cores, ≥6 GB and ≥6 cores, or iOS | WebGL2 missing, or a weaker device | Reduced motion, Save-Data, or 2G/3G |
| Hero | WebGL, 6,000 particles desktop / 2,500 phone | Canvas 2D, 500–700 particles | Static SVG |
| Glass | Blurred (panel 55%) | Solid deep-navy cards; blur only on the sticky bar, nudge and slider handle | Solid deep-navy, no blur |
| Film grain | Yes (lazy noise tile) | No | No |
| Lenis, cursor glow, magnetic buttons | Desktop only | Off | Off |
| GSAP | Yes | Yes | Not loaded |

An FPS probe runs for 1s after the hero mounts. Below 45fps the page drops one tier.

**Personalisation before first paint:** `src/early.ts` is inlined in `<head>` and applies the chip, H1 and strip as the parser produces them. A DM visitor never sees the default headline flash, and CLS is 0.

**Load order:**
- Initial JS (~11 KB gzip) holds the DOM features.
- After `load` and an idle callback come the decode chunk, then the hero renderer, then the FPS probe, then the section motion chunk.
- Each section's motion starts when it nears the viewport, in idle time.
- Cal.com loads within 600px of `#book`.

**Honesty rules in code:**
- No ratings in JSON-LD; testimonials and logos are gated on `permissionConfirmed`.
- Slots and dates come from CONFIG; the countdown is computed from the real date.
- Concept and remake labels are hard-wired.
- A banned-content scan runs on the built HTML/JS/CSS (§10).

## 9. Analytics

`track(name, props)` pushes to `window.cfEvents`. When `analytics.eventEndpoint` is set, it also POSTs JSON with `navigator.sendBeacon`. The body is:

```json
{ "name": "cta_book_click", "props": { "loc": "hero" }, "ts": 1761000000000, "path": "/", "tier": "A",
  "attribution": { "c": "Arclight", "t": "mainnet", "utm_source": "x", "utm_medium": "dm", "utm_campaign": "dm1" } }
```

Cross-origin endpoints get `Content-Type: text/plain` to avoid a CORS preflight; the body is still JSON. A Cloudflare Pages Function at `/api/events` works without CSP changes.

Events:
- `tier_selected`, fired again with `downgraded: true` if the FPS probe drops a tier
- `cta_book_click`, `cta_remake_click`, `cta_clip_click`, `dm_click` (each with `loc`)
- `slider_interact`, `timeline_complete`, `pricing_view`
- `calendar_loaded`, `calendar_fallback_click`
- `nudge_shown`, `nudge_click`, `nudge_dismiss`
- `scroll_50`, `scroll_90`

## 10. Test report

Run on 2026-10-22, against the production build (`vite preview`).

### Playwright: 182 passed, 0 failed

That is the original 136, plus 27 runs of the 8 design-system checks in `tests/brand.spec.ts`, plus 12 runs of the 2 checks in `tests/socials.spec.ts`. Chromium at all six viewports. A dash (–) means the test is scoped to other viewports on purpose: 360×640-only above-the-fold checks, mobile-only toggle and sticky bar, desktop-only slider, and build checks that run once. 71 runs are skipped that way.

| Test | 360×640 | 390×844 | 414×896 | 768×1024 | 1280×800 | 1440×900 |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| 1 · No horizontal scroll, no console errors from our code | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 1b · No horizontal scroll with a 40-character project name | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 2 · Above the fold at 360×640: H1, both CTAs, risk line (default) | ✓ | – | – | – | – | – |
| 2 · Same, `?c=Arclight&t=mainnet` (chip also in view) | ✓ | – | – | – | – | – |
| 2 · Same, 40-character project name | ✓ | – | – | – | – | – |
| 3 · `?c=Arclight&t=mainnet`: H1, chip, final H2 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 3 · `?c` only: "next announcement" headline | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 3 · `?c=<script>alert(1)</script>&t=evil`: default copy, no alert, no injected nodes | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 3 · `t` outside the whitelist ignored | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 4 · `c`, `t`, UTMs on both Tally URLs (new tab) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 4 · First-touch UTMs survive in sessionStorage | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 4 · Cal.com: `forwardQueryParams`, attribution config, fallback link | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 5 · Sticky bar: hidden over hero, shown mid-page, hidden over `#book`; 64px | ✓ | ✓ | ✓ | – | – | – |
| 5 · Nudge once after 60% scroll, never again after dismissal; focus not stolen | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 5 · No nudge after a CTA click | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 6 · Strip countdown before `event.start` (mocked date) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 6 · Strip slots-only message after `event.start` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 6 · Strip hidden at `deskSlotsLeft = 0` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 6 · Founding block hidden at 0; count and pips follow CONFIG | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 7 · Reduced motion: Tier C, no running animations, no canvas, static list | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 8 · Slider: ←/→ change `aria-valuenow` by 5 | – | – | – | ✓ | ✓ | ✓ |
| 8 · Mobile toggle switches Static/Motion (buttons and tap) | ✓ | ✓ | ✓ | – | – | – |
| 8 · Mobile auto-switches to Motion after entering view | ✓ | ✓ | ✓ | – | – | – |
| 9 · Testimonials, logos, remakes absent while CONFIG is empty | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 10 · Banned-content scan of built HTML/JS/CSS | – | – | – | – | ✓ | – |
| CSP hash matches the inlined script; headers; robots/sitemap | – | – | – | – | ✓ | – |
| SEO: title, meta, canonical, OG/Twitter, JSON-LD (5 offers, 13 FAQs, no ratings) | – | – | – | – | ✓ | – |
| Contrast: every visible text node ≥ 4.5:1 (3:1 large) on composited glass, Tier A | – | ✓ | – | – | – | ✓ |
| Anchors: hero "Book a 15-min call" lands on `#book` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Anchors: DM deep link to `#pricing` stays put after lazy features load | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Anchors: same with Tier A forced (Lenis, WebGL, pinned timeline) | – | – | – | – | ✓ | ✓ |
| Brand 1 · Button/Primary is `rgb(43, 228, 160)` with `rgb(4, 20, 13)` text | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Brand 2 · Radii: glass 14px, button 10px, tag 6px; buttons 48px (56px phone CTAs); pill 28px, tag 24px | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Brand 3 · No computed `box-shadow` on any element or pseudo-element (Tier A) | – | ✓ | – | – | – | ✓ |
| Brand 4 · No mint↔blue gradient in any rule, inline style or SVG; no `conic-gradient` | – | ✓ | – | – | – | ✓ |
| Brand 5 · No `perspective`, `preserve-3d` or rotateX/Y, including while hovering cards | – | ✓ | – | – | – | ✓ |
| Brand 6 · No old token names in `dist/`, `src/`, `scripts/`, `tests/`, `index.html` | – | – | – | – | ✓ | – |
| Brand 7 · Ghost border is steel `rgb(163, 175, 198)`, turns ice on hover | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Socials · Empty handles leave no DM line, no empty links, no empty `twitter:site`; the footer box lists only what is set | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Socials · The footer email is on the site's own domain | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Brand 8 · Contrast measured in the browser: text pairs and pill labels on washes ≥ 4.5:1; ghost border and blue focus ring ≥ 3:1 | – | ✓ | – | – | – | ✓ |

### Lighthouse mobile (simulated throttling, median of 3)

| URL | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| `/` | 99 | 100 | 100 | 100 | 1.8 s | 0 | 20 ms |
| `/?c=Arclight&t=mainnet&utm_…` | 99 | 100 | 100 | 100 | 1.7 s | 0 | 10 ms |

### Bundle sizes (gzip -9)

| | Size | Budget |
|---|---|---|
| **Initial JS** (`index-*.js` + inlined boot script) | **11.4 KB** (9.1 + 2.3) | ≤ 90 KB |
| **CSS** (render-blocking 10.3 KB + lazy Tier A grain 4.3 KB) | **14.6 KB** | ≤ 35 KB |
| **Fonts** (5 woff2, latin; only Space Grotesk 600 preloaded) | **105.0 KB** | ≤ 120 KB |
| HTML | 15.2 KB | — |

Lazy chunks:

| Chunk | Size |
|---|---|
| `sections` (ScrollTrigger, SplitText, Flip, section motion) | 31.2 KB |
| `gsap-core` (core + DrawSVG) | 27.9 KB |
| `hero-webgl` (OGL) | 15.3 KB |
| `lenis` | 5.6 KB |
| `decode` (ScrambleText) | 3.9 KB |
| `hero-canvas` | 1.2 KB |
| `field` | 1.1 KB |
| `dialog` | 0.6 KB |

### What I couldn't verify, and why

- **WebKit / Safari.** This environment ships Chromium only, and the brief said not to run `playwright install` here. `playwright.config.ts` adds the six WebKit projects automatically wherever WebKit is installed: run `npx playwright install webkit && npm test`.
- **The live Cal.com embed and Tally submissions.** Tests block all third-party network calls. They check the loader, the `forwardQueryParams` flag, the queued inline config and the fallback link, but not a real booking. See §6.
- **The CSP in a browser: now verified for our own code.** The Docker image was built and run, and the live container loaded in Chromium (Tier A, Tier B, phone, Tier C) with the real headers: 0 CSP violations. Third parties (Cal.com's iframe, Tally) are unreachable offline, so the live Cal.com embed still needs the manual check in §6. (This sandbox's proxy certificate had to be injected into a throwaway copy of the build; on a normal VPS the Dockerfile builds as-is.)
- **Tier A in Lighthouse.** The 4-core build container makes the page choose Tier B (Canvas 2D), so the Lighthouse scores above are for Tier B. With Tier A forced and real 4× CPU throttling in Chromium, main-thread blocking after load was about 0.4 s on a phone profile. That figure is pessimistic because the GPU here is software (SwiftShader), but check a real high-end phone with Lighthouse or WebPageTest after deploy.
- **Real devices and in-app browsers** (X, LinkedIn) are in the manual checklist.

## 11. Decisions made where the brief was silent

1. **Location.** The site was built in a `cipherframe/` folder of the `app-business` repo, then moved to its own repo, where it is the repo root.
2. **No hard-coded facts in markup, yet works without JS.** `index.html` holds `{{tokens}}` and `<!--@blocks-->` that a Vite plugin fills from `config.ts` at build time. JS re-reads CONFIG at runtime.
3. **Boot script in `<head>`.** A ~2 KB inline script (its sha256 goes into the CSP at build) sets the tier and personalises as the hero is parsed. This keeps CLS at 0 for DM links.
4. **`c` validation.** A value with any disallowed character, or longer than 40 characters, is ignored outright rather than stripped or truncated. Stripping `<script>alert(1)</script>` would otherwise produce "scriptalert1script".
5. **`t` matching** is case-insensitive.
6. **Long personalised headlines** step down in size (over 44 and over 64 characters), so the chip, H1, both CTAs and the risk line still fit above the fold at 360×640.
7. **"Read more".** The sub-head trims to two lines with a "Read more" button only on phones with a viewport no taller than 760px, which in-app browsers typically have.
8. **Fit copy.** The Fit line reads `You want price predictions or return promises in your videos.`, as specified in the brand-alignment brief. It replaces the earlier `“guaranteed” returns` workaround and is no longer a deviation from the brief.
9. **Quote marks.** In the pricing taglines and option cards, the brief's quote marks are treated as delimiters and not shown. The FAQ objections keep theirs.
10. **FAQ heading.** The brief gave no FAQ headline, so the H2 is simply "FAQ".
11. **LinkedIn** joins the official-handles box only when `linkedinUrl` is set.
12. **Countdown.** It is rendered by JS only, never baked into the HTML, so a cached or no-JS page can't show a stale number. A date-only `event.start` is midnight UTC.
13. **Sticky bar** also hides over the footer.
14. **Nudge.** It waits while `#book` is on screen and closes itself when `#book` comes into view (all three options are right there). Esc dismisses it.
15. **GSAP loading.** GSAP is lazy and not in the initial bundle, split into a small decode chunk (H1 cipher) and the section chunk. The FPS probe runs after the decode chunk compiles, so parse time doesn't skew it.
16. **Desktop before/after.** The divider does one slow "peek" sweep 1.2s after entering view, so it reads as draggable. This is the desktop counterpart of the mobile auto-switch; it's off under reduced motion and Tier C.
17. **Scrolling.**
    - Smooth scrolling switches on only after `load`, so DM deep links land instantly.
    - Layout-changing features (timeline mode, comparison cards) apply before `load`.
    - Anything later, such as the 250vh pin spacer, goes through manual scroll anchoring, because Safari has no CSS scroll anchoring.
    - I tried `content-visibility` and removed it: it broke anchor jumps.
18. **Tier B blur** is limited to the sticky bar, the nudge and the slider handle (≤3 elements).
19. **`videos.hero`** replaces the code-generated hero field when set.
20. **Test-only hooks.** `window.__CF_OVERRIDES__` (CONFIG overrides) and `window.__CF_FORCE_TIER__` can only be set by page scripts such as Playwright's `addInitScript`, never from the URL.
21. **Extra files.** I added `public/llms.txt` and a script that renders `og.png` from HTML with the real fonts.

### Brand-alignment pass (22 Oct 2026)

Brought onto the Cipherframe design system; behaviour, layout, copy (except the Fit line), analytics and tiers are unchanged. Notes on judgment calls and the PART 2.4 checks:

22. **Logo and favicon.**
    - The mark is now built from the exact diamond polygon `14,8.5 19.5,14 14,19.5 8.5,14` in `--signal-mint`, with 2.5-unit `--ice` brackets (raised from 2 after the brand pass).
    - The wordmark tracking went from −0.02em to −0.01em, and the gap to the mark from 10px to 0.4 × the mark's width.
    - The favicon already matched.
23. **Hexagon and pill diamonds.** The hero and kinetic hexagons were already regular, so only their tinted fills changed: now deep-navy and panel, since glows are reserved for three places. Pill diamonds are 7px squares rotated 45°, the same proportions as the logo diamond.
24. **Timeline stops** did not exist before. They are new: a 5-stop track under the steps in the carousel and pinned modes. The static list (reduced motion, no JS) has no track, as before.
25. **Section dividers** are now the Motif/Chain: panel blocks, a 1.5px ice outline, 4px radius, and the last block mint.
26. **Price bullets.** The Desk value stack switched from check icons to 7px mint diamonds, to match PriceCard.
27. **Icons.**
    - Icons outside the design-system set were swapped for set icons: clock and repeat became lightning and play; layers became hexagon; shield became check and lock.
    - The social-post mock lost its reply/repost/like row, whose icons aren't in the set.
    - FAQ items use chevron-down, and the video dialog's close uses the x icon.
    - Sizes are now 18px in buttons, 24px in cards and 28px in the hero diagram.
28. **Colour meaning.** Blue is now only "in flight": the work-card spec lines, footnote markers and pain-card icons moved to steel.
29. **Glows.** Removed everywhere except the hero, the Desk card and the final CTA, all at ≤10%. That means the comparison column, work previews, kinetic stage and seal icons lost theirs.
30. **Button heights.**
    - The hero and booking-section CTAs keep 56px on phones.
    - The sticky bar keeps its current 48px buttons inside the 64px bar.
    - Everything else is 48px.
31. **Card gaps.** Card grids use the 32px gap. The timeline's steps keep 16px because they are a sequence/carousel, not a card grid.
32. **Long personalised headlines** still step down (over 44 and over 64 characters) to keep the offer above the fold at 360×640, but never above the design-system h1 size. The hero's vertical spacing moved onto the 4px scale.
33. **Nudge** uses panel at 94% rather than the 55% glass recipe, because it floats over arbitrary content and must stay legible.
34. **The "before" post** keeps its deliberately generic, off-brand flat colours, because it depicts the JPEG you'd post without Cipherframe.
35. **Flagged: particles forming the mark.** In the hero scroll-out and the final CTA, particles converge into the Cipherframe mark. The logo rules say "never add effects to the logo", but the brand brief didn't list this for removal and froze behaviour, so I kept it. Remove the convergence if you read the rule strictly.

### Going live on Hostinger (23 Oct 2026)

36. **Domain** is `https://cipherframe.studio`. The tests read it from `src/config.ts` instead of hard-coding it.
37. **Email** changed from `hello@cipherframe.com` (a domain that is not yours) to `contact@cipherframe.studio`. You need to create that mailbox, or set another address, before launch.
38. **Social accounts** are empty for now. The page hides everything that depends on them: the "Prefer DMs? Message @handle on X" line, the `twitter:site` tag and the X link in the footer. The footer box then lists just the site. Fill the handles in later and rebuild; the page picks them up.
39. **Docker, not static upload.** A Hostinger VPS runs EasyPanel, which deploys containers, so the repo has a `Dockerfile` and `nginx.conf`. The security headers were Cloudflare-only (`_headers`), so the image converts that same file into nginx headers at build.
40. **Not changed:** the Cal.com link, Tally URLs, founder name, event strip (`Solana Breakpoint`, 15–17 Nov, London) and slot counts (4 Desk, 5 founding) are still the defaults. They need your real values before you send any DMs.
41. **Details filled in:** founder name Anas Mansouri, email contact@cipherframe.studio, event removed. Cal.com, Tally and the slot counts are still placeholders.
42. **New price ladder (23 Oct 2026):** Clip $200, Feature Video $350, Unlimited Desk $1,490/month (prepay $3,990), Protocol Explainer $790, Launch Pack $1,290, 5 founding Desks at $990/month for 3 months. "Announcement Desk" is now "Unlimited Desk" everywhere visible. The founding total lives in `CONFIG.foundingTotal`. `tests/build.spec.ts` fails if an old price returns.

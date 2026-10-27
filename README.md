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
src/components/                 before-after, timeline, compare, sticky-cta, nudge, countdown, work-videos, concept-videos, sound-bus, dialog (lazy lightbox)
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
public/work/                    the Work films (<slug>.mp4 .webm -poster.webp) and the Studio concepts (work-0N-*.mp4 .webm .jpg);
                                raw/ and raw/concepts/ hold the originals (never shipped)
public/showcase/honeyb/         the "See the difference" card: honeyb_before.png/.webp, honeyb_after.mp4/.webm, _after_poster.jpg, _avatar.png
scripts/vite-plugin-cipherframe.ts   build-time templating, JSON-LD, CSP hash, domain placeholders
scripts/report-sizes.mjs        gzip report + budget check (runs in npm run build)
scripts/lighthouse.mjs          Lighthouse runner
scripts/make-og.mjs             renders og.png
scripts/make-grain.mjs          writes src/styles/grain.css (128px 2-bit noise PNG as a data URI)
scripts/make-work-videos.mjs    npm run work: encodes public/work/raw/<slug>.mp4 into the web files (needs ffmpeg)
scripts/make-concept-videos.mjs  npm run concepts: encodes public/work/raw/concepts/<slug>.mp4 into the Studio concepts files (needs ffmpeg)
scripts/make-showcase.mjs       npm run showcase: derives the WebP, WebM, poster and avatar from honeyb_before.png + honeyb_after.mp4
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
| `videos.hero` | A rendered hero loop that replaces the code-generated field. See §3. |
| `concepts[]` | The three Studio concepts films, in card order: `slug` (file name in `public/work/`), `tag`, `title`, `meta`, `line`, `audio`. See "The Studio concepts" in §3. |
| `work[]` | The Work films shown before the studio concepts: one card per entry, in order. See "Adding a film" in §3. `permission: false` shows the dashed "UNOFFICIAL CONCEPT · NOT AFFILIATED" tag; set `true` only with the brand's OK ("SHARED WITH PERMISSION"). |
| `founder` | `name` (replace `[Your name]`). `photo` must be a real photo of you; if empty, the logo mark shows. `note` overrides the default note; separate paragraphs with a blank line. |
| `analytics.cfBeaconToken` | Turns on Cloudflare Web Analytics (no cookies). |
| `analytics.eventEndpoint` | URL that receives custom events (see §9). Empty means events only log in dev. |

The build also keeps `dist/_headers` in sync with the config: it adds the origins of any video, image or event endpoint you configure to the CSP.

## 3. Videos

### Adding a film to the Work section

1. Drop the original (any size, ideally square) in `public/work/raw/<slug>.mp4`.
2. `npm run work` (or `npm run work -- <slug>`; needs ffmpeg on PATH, or `FFMPEG=/path/to/ffmpeg`). It writes `public/work/<slug>.mp4` (H.264, 720×720, 30 fps, CRF 26, AAC 128k, faststart), `<slug>.webm` (VP9 + Opus, dropped if much larger than the MP4) and `<slug>-poster.webp` (720×720 from the frame at 4.6 s; override with `POSTER_AT=3.2`).
3. Add an entry to `work` in `src/config.ts` (slug, title, X handle and URL, meta line, one-line description, the file paths, `permission`). Commit and deploy.

How the cards behave:
- **No download until played.** Videos are `preload="none"`; the posters stand in, so the first paint is unchanged. The page loads about 16 KB of posters.
- **Autoplay at 50% visible, muted, one at a time.** The first card in reading order that is on screen plays and keeps playing until it leaves; leaving pauses it. Scrolling away forgets a manual pause.
- **Tap the film** to pause or play (it is a real button, so keyboard and screen readers work). **The round speaker button** unmutes that film only and restarts it from 0 so the sound lines up; any other film is muted and paused.
- **Tap-only mode:** with reduced motion, Save-Data, 2G/3G, or when the FPS probe drops the page to Tier C, nothing autoplays; each poster shows a play button.
- **Layout:** 3 columns on desktop, 2 + 1 on tablet, 1 column on phones. The studio concepts sit below at about 70% width on desktop.
- **Analytics:** `work_video_play` (once per film per visit), `work_video_sound_on`, `work_x_click`, each with `{ slug }`.
- **Raw originals** are committed but removed from `dist/` by the build. The Docker/nginx image caches `/work/` for a day.

### The "See the difference" card (HoneyB)

The card in `#difference` shows HoneyB's real announcement: the static post on the left, the 5 s film on the right. The markup is in `index.html`; the media is in `public/showcase/honeyb/`.

- **Replacing the film or the static post:** overwrite `honeyb_after.mp4` (1920×1080, H.264 + AAC, faststart) and/or `honeyb_before.png` (1920×1080), then run `npm run showcase` (needs ffmpeg). It rewrites `honeyb_before.webp`, `honeyb_after.webm`, `honeyb_after_poster.jpg` (the final frame, 1280×720) and `honeyb_avatar.png` (the logo cropped from the static post and keyed onto white; the crop box is in the script). Commit and deploy.
- **Same box on both sides.** The image and the film sit in identical `.post__media` boxes (16:9, same border and radius), so dragging the divider never shifts or letterboxes either one.
- **No download until it plays.** The film is `preload="none"`. The poster (13 KB) is not in the HTML: browsers fetch a `<video poster>` while the page is still loading, which cost LCP 0.3 s (1.8 s to 2.2 s). Script sets it once the card is within about 1200px of the screen, so it arrives after load; without script it is the box's CSS background. The static WebP (21 KB) and the avatar (7 KB) are lazy `<img>`s.
- **Autoplay at 40% visible, muted.** It plays while at least 40% of the film is on screen and the Motion side is showing (always on desktop; on phones only after the switch to Motion), and pauses when it leaves. Reduced motion, Save-Data and 2G/3G (Tier C) never autoplay: the poster stays and the slider still works.
- **Sound.** A 44×44 speaker button (bottom-right of the film) unmutes it and restarts it from 0. Scrolling away, switching to Static or hiding the tab pauses it and mutes it again. Pressing the button never moves the divider.
- **The name is fixed.** `?c=` personalises the hero, chip and closing heading, but not this card: it is a real post, so it always says HoneyB.
- **Caching.** The Docker/nginx image and `_headers` cache `/showcase/` for a day.

### The Studio concepts (three films under the Work films)

Each card is the section's usual card (dark media area on top, lighter panel below) with a 16:9 film in the media area. Copy, tag and meta live in `concepts[]` in `src/config.ts`; the files live in `public/work/`.

- **Replacing a film:** overwrite `public/work/raw/concepts/<slug>.mp4`, then `npm run concepts` (or `npm run concepts -- <slug>`; needs ffmpeg). It writes `<slug>.mp4` (H.264, 1280px wide, CRF 23, AAC 128k, faststart), `<slug>.webm` (VP9 + Opus) and `<slug>.jpg` (1280px, about JPEG quality 80). Each file must be under 3 MB; if the first pass is over, the script retries at 30 fps and then with a higher CRF. The poster frames are set in `POSTERS` at the top of `scripts/make-concept-videos.mjs` (1.0 s, the last frame, 6.9 s).
- **No download until a card is near.** Videos are `preload="none"`. The poster is not in the HTML: script sets it once the card is within about 1200px of the screen (a `<video poster>` is fetched while the page is still loading), and without script it is the box's CSS background.
- **Plays only while at least half the picture is on screen, always muted.** Every card is independent, so on desktop all three play together; on phones only the ones in view do. Leaving the screen pauses and re-mutes.
- **Sound.** A 32px speaker button sits bottom-right of each film (its tap target is 44px, an invisible ring around it). It has an `aria-label` and `aria-pressed`. Unmuting one film mutes every other film on the page, including the Work films and the See the difference card (`src/components/sound-bus.ts`). The button only shows while the film is playing, and is not rendered when `audio: false`.
- **Lightbox.** The picture is a real button (`Open video: …`). Enter, Space or a click opens a native `<dialog>`: dark overlay, the film centred at no more than 90vw (and never taller than the screen), native controls, sound on, from 0. Esc, a click on the overlay, or the close button closes it, and focus goes back to the card. Inline films stop while it is open and resume after. Under reduced motion it does not autoplay.
- **Reduced motion, Save-Data, 2G/3G, or a browser that blocks `play()`:** nothing plays inline. The poster shows a play button that opens the lightbox. A blocked `play()` is caught: nothing is logged.
- **Files:** `public/work/` rather than `public/assets/`. This site has no `public/assets/`; `/assets/` is the hashed build output, served with a one-year `immutable` cache, which is wrong for files that keep their names. `/work/` is cached for a day.

### Swapping in a rendered hero loop

Put an MP4 (H.264, muted-friendly) in `public/videos/` or on a CDN and set the URL:

```ts
videos: { hero: "/videos/hero.mp4" },
```

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
- [ ] On a real phone and on desktop: pick a date in the inline calendar and check that the time list scrolls inside its window (wheel, swipe, scrollbar), that "Scroll for more" goes away at the bottom, and that the page still scrolls past it. The tests use a stand-in for Cal.com's iframe, not the real one.
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
- Initial JS (~13 KB gzip) holds the DOM features.
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

Run on 2026-10-27, against the production build (`vite preview`).

### Playwright: 349 passed, 0 failed

That is the earlier 228 (which already included the design-system checks and the Work films), plus 63 runs of the 12 checks for the HoneyB card (`tests/showcase*.spec.ts`), plus 58 runs of the 12 checks for the Studio concepts (`tests/concepts*.spec.ts` and the file checks in `tests/build.spec.ts`). Chromium at all six viewports. A dash (–) means the test is scoped to other viewports on purpose: 360×640-only above-the-fold checks, mobile-only toggle and sticky bar, desktop-only slider and playback, and build checks that run once. 119 runs are skipped that way. In one of three full runs a desktop playback test failed under parallel load and passed on the rerun (and 90 of 90 at 8 workers); I could not reproduce it, so treat the showcase playback tests as load-sensitive, like the Work ones.

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
| Work (a) · No `<video>` requests a file on page load; all are unloaded | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Work (b) · Scrolling to the films autoplays the first one, muted; only one plays; the others stay unloaded; `work_video_play` fires | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Work (b2) · Tapping the film pauses and resumes it, and the button label follows | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Work (c) · The speaker button (≥44×44) unmutes only that film; the previous one is re-muted and paused | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Work (d) · Reduced motion: nothing autoplays or loads, a play button shows, tap plays muted | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Work (e) · Each card shows the tag for its `permission` value (also rendered with `true`); the word "client" never appears | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Work (f) · No horizontal scroll at 360px; the concept cards stack in one column | ✓ | – | – | – | – | – |
| Work · "View on X" links open the right account in a new tab and are tracked | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Work · Files exist, each video under 2.5 MB, posters are WebP, raw originals not shipped, WebM listed before MP4 | – | – | – | – | ✓ | – |
| Showcase · The card is HoneyB (name, avatar, post line, labels/heading/hint/caption unchanged); no Arclight/Mainnet copy; no yield/earn/APY or digits in the post line | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Showcase · `?c=Foo Labs&t=mainnet` personalises the page but never renames HoneyB | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Showcase · The static image and the film fill the exact same 16:9 box (±0.5px), edge to edge | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Showcase · WebP before PNG, WebM before MP4; poster, `preload="none"`, muted, loop, playsinline | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Showcase · Every asset is served; media weighs under 1.5 MB on both the WebM and the MP4 path | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Showcase · No film bytes on load; plays muted at 40% visible; pauses when scrolled away (desktop) | – | – | – | ✓ | ✓ | ✓ |
| Showcase · Speaker button ≥44×44 unmutes, leaves the divider alone, re-mutes when scrolled away (desktop) | – | – | – | ✓ | ✓ | ✓ |
| Showcase · Phones: plays only on the Motion side; the hidden layer is not tappable; tapping the picture switches sides | ✓ | ✓ | ✓ | – | – | – |
| Showcase · Reduced motion: film never loads or plays, poster shows, no sound button, slider/toggle still work | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Showcase · The card's `<video>` has `data-poster`, not `poster`, in the HTML (so it cannot delay first paint) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Showcase · No JavaScript: both pictures still show and the poster is the film box's background | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Showcase · No horizontal scroll with the new card | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Concepts · Three cards in order with the specified tags, titles, meta and lines; no old illustrations or Play-concept buttons | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Concepts · Picture is 16:9, spans the card, clipped by its 14px corners; 3 columns from 768px, 1 column with 24px gaps below | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Concepts · No concept bytes on load; no `poster` attribute in the HTML; only the near card's poster is set and fetched | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Concepts · Only pictures ≥50% on screen play, always muted; off screen pauses | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Concepts · 32px speaker button bottom-right with `aria-pressed`; unmuting one mutes the other two; scrolling away re-mutes | – | – | – | ✓ | ✓ | ✓ |
| Concepts · Only one film on the whole page has sound (a Work film and a concept silence each other; the lightbox silences all) | – | – | – | ✓ | ✓ | ✓ |
| Concepts · Lightbox from the keyboard: sound on, from 0, controls, ≤90vw and centred, focus trapped; Esc, close button and overlay click each close it and return focus; clicking the picture opens it | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Concepts · Reduced motion: no autoplay or film download, play button on every poster, no sound button, lightbox does not autoplay | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Concepts · `play()` blocked: play button shows, no console errors or uncaught rejections | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Concepts · No layout shift (CLS entries inside the section) and no card height change while media loads | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Concepts · Files: WebM + MP4 each under 3 MB, 1280px JPEG posters, WebM before MP4 | – | – | – | – | ✓ | – |
| Calendar · A tall embed sits in a fixed-height window (500–620px) and the page does not grow | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Calendar · The wheel scrolls the calendar, not the page (smooth scrolling on); "Scroll for more" shows until the bottom | – | – | – | ✓ | ✓ | ✓ |
| Calendar · No cue and no scrolling when the embed fits | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Calendar · Phones: a native scroller (no touch-action override) with a gutter beside it for the page | ✓ | ✓ | ✓ | – | – | – |
| Brand 8 · Contrast measured in the browser: text pairs and pill labels on washes ≥ 4.5:1; ghost border and blue focus ring ≥ 3:1 | – | ✓ | – | – | – | ✓ |

### Lighthouse mobile (simulated throttling, median of 3)

| URL | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| `/` | 99 | 100 | 100 | 100 | 2.0 s | 0 | 10 ms |
| `/?c=Arclight&t=mainnet&utm_…` | 99 | 100 | 100 | 100 | 2.0 s | 0 | 0 ms |

### Bundle sizes (gzip -9)

| | Size | Budget |
|---|---|---|
| **Initial JS** (`index-*.js` + inlined boot script) | **13.6 KB** (10.9 + 2.8) | ≤ 90 KB |
| **CSS** (render-blocking 10.0 KB + lazy Tier A grain 4.3 KB) | **14.4 KB** | ≤ 35 KB |
| **Fonts** (5 woff2, latin; only Space Grotesk 600 preloaded) | **105.0 KB** | ≤ 120 KB |
| HTML | 16.9 KB | — |

Lazy chunks:

| Chunk | Size |
|---|---|
| `sections` (ScrollTrigger, SplitText, Flip, section motion) | 30.8 KB |
| `gsap-core` (core + DrawSVG) | 27.9 KB |
| `hero-webgl` (OGL) | 15.3 KB |
| `lenis` | 5.6 KB |
| `decode` (ScrambleText) | 3.9 KB |
| `hero-canvas` | 1.2 KB |
| `field` | 1.1 KB |
| `dialog` (the lightbox) | 0.7 KB |

Work films (served from `/work/`, not part of the JS/CSS budgets; each under the 2.5 MB target):

| Film | MP4 | WebM | Poster | Original |
|---|---|---|---|---|
| spout | 197 KB | 196 KB | 7 KB | 3.7 MB |
| 0xbow | 172 KB | 180 KB | 3 KB | 0.5 MB |
| archer | 216 KB | 146 KB | 6 KB | 1.4 MB |

Studio concepts (served from `/work/`; every file is under the 3 MB target; none loads until its card is near the screen):

| Film | MP4 | WebM | Poster | Original |
|---|---|---|---|---|
| work-01-pinned (15 s, sound) | 1144 KB | 806 KB | 22 KB | 3.9 MB |
| work-02-honeyb (5 s, sound) | 611 KB | 621 KB | 11 KB | 1.1 MB |
| work-03-trezor-arc (7 s, sound) | 535 KB | 337 KB | 26 KB | 9.3 MB |

HoneyB card (served from `/showcase/honeyb/`, outside the JS/CSS budgets; the whole card is under the 1.5 MB target on both browser paths):

| File | Size | Loaded |
|---|---|---|
| `honeyb_before.webp` (PNG fallback 51 KB, not downloaded by modern browsers) | 21 KB | lazy `<img>`, near the screen |
| `honeyb_avatar.png` (×2 places, one request) | 7 KB | lazy `<img>`, near the screen |
| `honeyb_after_poster.jpg` | 13 KB | set by script, near the screen, after load |
| `honeyb_after.webm` (Chrome, Edge, Firefox) | 763 KB | when the film first plays |
| `honeyb_after.mp4` (Safari / iOS) | 1,069 KB | when the film first plays |

### What I couldn't verify, and why

- **The MP4 path.** Playwright's Chromium cannot decode H.264, so every test (and my own checks) plays the WebM. The MP4s (the HoneyB card's original, and the three concept films, re-encoded here) have their index at the front and nginx serves them with range support, but no browser here has played them. Check the cards and the lightbox once on a real iPhone.
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
8. **Fit copy.** Originally the brand-alignment brief's `You want price predictions or return promises in your videos.`; replaced on 27 Oct (decision 70). The rule itself still stands in the FAQ ("we never write price or return claims").
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
34. **The "before" post** originally used deliberately generic, off-brand flat colours to depict the JPEG you'd post without Cipherframe. Since 27 Oct it is HoneyB's real static post instead (decisions 52–59).
35. **Flagged: particles forming the mark.** In the hero scroll-out and the final CTA, particles converge into the Cipherframe mark. The logo rules say "never add effects to the logo", but the brand brief didn't list this for removal and froze behaviour, so I kept it. Remove the convergence if you read the rule strictly.

### Going live on Hostinger (23 Oct 2026)

36. **Domain** is `https://cipherframe.studio`. The tests read it from `src/config.ts` instead of hard-coding it.
37. **Email** changed from `hello@cipherframe.com` (a domain that is not yours) to `contact@cipherframe.studio`. You need to create that mailbox, or set another address, before launch.
38. **Social accounts** are empty for now. The page hides everything that depends on them: the "Prefer DMs? Message @handle on X" line, the `twitter:site` tag and the X link in the footer. The footer box then lists just the site. Fill the handles in later and rebuild; the page picks them up.
39. **Docker, not static upload.** A Hostinger VPS runs EasyPanel, which deploys containers, so the repo has a `Dockerfile` and `nginx.conf`. The security headers were Cloudflare-only (`_headers`), so the image converts that same file into nginx headers at build.
40. **Not changed:** the Cal.com link, Tally URLs, founder name, event strip (`Solana Breakpoint`, 15–17 Nov, London) and slot counts (4 Desk, 5 founding) are still the defaults. They need your real values before you send any DMs.
41. **Details filled in:** founder name Anas Mansouri, email contact@cipherframe.studio, event removed. Cal.com, Tally and the slot counts are still placeholders.
42. **New price ladder (23 Oct 2026):** Clip $200, Feature Video $350, Unlimited Desk $1,490/month (prepay $3,990), Protocol Explainer $790, Launch Pack $1,290, 5 founding Desks at $990/month for 3 months. "Announcement Desk" is now "Unlimited Desk" everywhere visible. The founding total lives in `CONFIG.foundingTotal`. `tests/build.spec.ts` fails if an old price returns.
43. **Cal.com and X filled in:** booking link `cal.com/anas-mansouri-bcw6cz/15min`, X account `@Cipherframehq` (the "Prefer DMs" line, the footer X link and `twitter:site` now appear). Tally links and slot counts are still placeholders. Testimonials and client logos stay hidden until real, permitted ones exist.
44. **Tally forms filled in:** free remake `tally.so/r/labkxk`, $200 clip `tally.so/r/Dq4jXp`. The hidden fields `c`, `t`, `utm_source`, `utm_medium` and `utm_campaign` must exist in both forms for DM attribution to show up. Only the slot counts remain placeholders.

### Work films (25 Oct 2026)

45. **Source order is WebM, then MP4.** The sizes are almost the same, but Playwright's Chromium cannot decode H.264, so the WebM is what the tests actually play. Real Chrome, Edge and Firefox use the WebM; Safari versions that cannot play it fall back to the MP4.
46. **CRF 26 as specified.** I compared CRF 20 on the dark-blue Spout glow frame: visually identical, five times the size, so I kept 26.
47. **Selection rule.** On desktop all three cards are visible at once; the first plays and keeps playing (no jumping). A manual pause is respected until the film scrolls away. Posters are fetched at load (about 16 KB in total); the videos are not.
48. **Tests pin Tier B for the autoplay tests.** Under heavy parallel load the FPS probe can legitimately drop the page to Tier C (tap-only), so those tests fix the tier instead of racing it.
49. **The long unofficial tag wraps on phones under about 390px** (it is 35 characters of mono at 0.72rem). It stays one line from 390px up. The brand test measures the one-line CONCEPT tag for the 24px height.
50. **Concept cards use `h4`** under the new "Studio concepts" `h3`, so headings stay in order.
51. **Flagged: the Spout film shows "0% APR" and a price chart.** The site's own rules say no returns, APY or charts in visuals, and the FAQ says "we never write price or return claims". It is an unofficial concept for a real company, so check you are comfortable with that line before you share the page widely.

### HoneyB in "See the difference" (27 Oct 2026)

52. **Masters and derived files.** The static post (`honeyb_before.png`, your 1920×1080 image) and the film (`honeyb_after.mp4`, 60 fps, with sound) are shipped exactly as supplied. The WebP, WebM, poster and avatar are derived by `npm run showcase`. The optional 1080×1080 variants were not made: the media box stays 16:9 at every width, so nothing is ever cropped.
53. **Flagged: the logo does not match across the divider.** The two media boxes are identical (tested to ±0.5px), but the compositions differ. The static post has a small logo on cream with the headline under it; the film starts and ends on a larger, centred logo on white. Drag the divider through the middle and you see two different pictures, not one logo continuing across. If you want a seamless reveal, re-export the static post from the film's final frame, or the film's first and last frames on cream with the logo placed as in the static post.
54. **The film is started by an observer, not the `autoplay` attribute, and is `preload="none"`.** Same behaviour as specified (plays muted at 40% visible, pauses when it leaves, not under reduced motion), but about 0.8 MB no longer starts downloading with the page. The poster stands in.
55. **Speaker button is 44×44, not 32.** It matches the Work films and the site's touch-target floor, and shares their CSS (navy fill, thin ring). It is hidden under reduced motion and Tier C, where nothing plays. It stops the press from reaching the card, so it never moves the divider.
56. **The name is fixed.** The post name no longer follows `?c=`. A DM visitor with `?c=Foo` still gets "Foo" in the hero, chip and closing heading, but this card is a real post and always says HoneyB.
57. **Dead code removed with the old card:** the flat placeholder, the live kinetic loop (`initKinetic`, the `.kin*` CSS, the `mainnetMedia` build block), the `videos.mainnet` config key and the now-unused `onVisibility` helper.
58. **Phone fixes found on the way.** On Static the hidden Motion layer is now `visibility: hidden`, so it cannot catch taps or keyboard focus (before, a video in that layer would have swallowed them). Tapping the picture now switches sides; the old tap handler ignored taps on any `<video>`.
59. **The poster is set by script, not by the `poster` attribute.** With the attribute in the HTML, Lighthouse mobile dropped from 99 to 98 and LCP rose from 1.8 s to 2.2 s (I confirmed by removing it: back to 99 and 1.9 s). It is also 1280×720 (13 KB), and converted with the right colour matrix: the film is BT.709 and JPEG is BT.601, and without an explicit conversion the orange came out duller (232,106,6 instead of 242,110,0). The Work films still use the `poster` attribute (about 19 KB for three); moving them to the same approach is an easy follow-up if you want the last 0.1 s. Flag: the card shows HoneyB's own wording ("Income arrives") with no "shared with permission" label, as briefed; confirm HoneyB has agreed to appear.

### Studio concepts as films (27 Oct 2026)

60. **Files are in `public/work/`, not `public/assets/`.** The brief said "the existing public/assets folder"; this site has none, and `/assets/` is Vite's hashed build output with a one-year `immutable` cache, which is wrong for files that keep their names. `/work/` is cached for a day and already served by nginx and `_headers`. The raw originals sit in `public/work/raw/concepts/` and are removed from `dist/` at build.
61. **A WebM is shipped next to each MP4 (WebM first).** The brief asked for MP4s only. Playwright's Chromium cannot decode H.264, so without the WebM none of the playback tests could run. Chrome, Edge and Firefox take the WebM; Safari takes the MP4. Both are under 3 MB, with sound.
62. **Card 1 is the cut with sound.** The first pinned video you sent had no audio track at all; the second (with sound) is a slightly different cut (cursor and typing animation, "network active" label), and it replaced the first. Its title and line are mine, written from the film ("Static to motion · 48 hours.", "A flat mainnet post turns into a full network announcement."); both are one-line edits in `concepts[]`. The film carries its own "Concept · fictional project" watermark for Arclight.
63. **Flagged: the HoneyB film is 5 seconds, not 7.** `ffprobe` says 5.0 s (it is the same file as the See the difference card). The meta line says `5s · 16:9 + 1:1`, not the `7s` in the brief. The "1:1" is your copy; no 1:1 file is in this repo.
64. **Flagged: the Trezor card is tagged CONCEPT, as briefed.** Trezor and Arc are third-party brands, and the Work films above use the longer `UNOFFICIAL CONCEPT · NOT AFFILIATED`. "CONCEPT" next to a "×" can read as an official piece. If you want the stronger label, change `tag` for that entry in `concepts[]`; the card handles the length (it wraps under about 390px, like the Work tags).
65. **32px sound button with a 44px tap target.** The visible circle is 32px as briefed; an invisible 6px ring around it keeps the touch target at 44px, the same as the other films. It only appears while the film plays, and is not rendered for a film with `audio: false`.
66. **One sound on the whole page, not just in this row.** Unmuting a concept also mutes the Work films and the See the difference card, and the other way round, through `src/components/sound-bus.ts`. Opening the lightbox mutes everything.
67. **The grid breakpoint moved from 900px to 768px, and the swipe row is gone.** Three columns from 768px, one column with 24px gaps below, as briefed. The row stays at about 70% width on desktop (unchanged), so at 768px the cards are about 210px wide; the type fits, but it is the tightest size.
68. **Dead code removed with the illustrations:** the CSS-animated `.wm` previews and their keyframes, the tap-pulse, `initWorkPreviews`, the "Play concept" buttons and `videos.lending` / `videos.payment`. The lightbox (`dialog.ts`) was reused and extended: several sources, a poster, sound on, a close callback.
69. **Tests pin Tier B** for the playback checks, and wait for the speaker button to be visible before clicking it: it shows when the `playing` event fires, which can be later than `paused` turning false under load.

### Hero air, founding bar, Fit copy (27 Oct 2026)

70. **Fit list, "Not for you if".** `You're launching a memecoin.` and `You want price predictions or return promises in your videos.` are replaced by `You want a different look for every post.` and `You can't review a style frame within a day.` They describe who the model does not suit (it sells one system and a 12-hour style frame) instead of who is excluded by topic. The exclusions are not gone: the FAQ still says "Do you work with memecoins? No" and "we never write price or return claims", and `llms.txt` says "Never memecoins, never project tokens". Two lines in `index.html` if you want other words.
71. **Hero air on phones is 96px (was 28px).** It is `clamp(32px, 100svh − 560px, 96px)` under the 52px header, so a normal phone gets about 100px between the logo and the eyebrow and a 640px-tall one gets 84px, with the offer and the risk line still above the fold. A long personalised headline (`?c=` over 44 characters) keeps the old tight 10–28px, because it needs that room itself to stay above the fold at 360×640. Tablet and desktop are unchanged.
72. **The founding bar has no box.** The glass card (fill, border, radius, padding) is gone; the pips and the two lines sit directly on the page. `foundingSlotsLeft: 0` still hides the whole bar.

### Calendar window (27 Oct 2026)

73. **The calendar is a fixed-height window, not a column.** Cal.com's iframe grows to the full height of its content, and the day view lists every 15-minute slot, which made the section several screens tall. `.cal` is now `clamp(500px, 78svh, 620px)` tall and `.cal__embed` scrolls vertically inside it: mouse wheel, touch swipe, or the thin themed scrollbar. A small "Scroll for more" pill shows at the bottom while there is more below and goes at the end (`cal.ts`, `watchScroll`). The window has a fixed height from first paint, so it also causes no layout shift.
74. **Marked `data-lenis-prevent`**, so Tier A's smooth scrolling does not take the wheel from it. Scrolls past the end of the list chain on to the page.
75. **Flag: not tested against the real Cal.com.** The sandbox cannot reach it, so the tests use a 3,000px stand-in iframe. Check the real embed on a phone and on desktop (checklist in §6), especially that keyboard Tab through the time slots brings the focused slot into view inside the window. The height is `clamp(500px, 78svh, 620px)`; if Cal's month view needs scrolling on a small phone, raise the 620px cap in `src/styles/sections.css`.

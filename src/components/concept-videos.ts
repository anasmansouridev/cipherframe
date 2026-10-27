import { $, $$, whenNear } from "../runtime";
import { getTier, onTierChange } from "../tier";
import { onSoundElsewhere, soundOn } from "./sound-bus";

/**
 * Studio concepts. Rules:
 * - Nothing loads until a card is near the screen: the video is preload="none" and the poster is only set then.
 * - A film plays, muted, while at least half of its picture is on screen, and pauses when it leaves.
 *   Every card is independent, so on desktop all three can play at once.
 * - Never autoplay with sound. The 32px speaker button unmutes that film and mutes every other film on the page;
 *   leaving the screen pauses and mutes it again.
 * - Clicking the picture opens the lightbox (sound on, controls, from 0). Inline playback stops while it is open.
 * - Reduced motion, Save-Data, 2G/3G (Tier C) and a browser that blocks play(): no inline playback. The poster shows
 *   a play button, and it opens the lightbox.
 */
interface Card {
  el: HTMLElement;
  title: string;
  video: HTMLVideoElement;
  open: HTMLButtonElement;
  sound: HTMLButtonElement | null;
  inView: boolean;
  blocked: boolean;
}

export function initConceptVideos(): void {
  const cards: Card[] = $$<HTMLElement>("[data-cv]").flatMap((el) => {
    const video = $<HTMLVideoElement>(".cv__video", el);
    const open = $<HTMLButtonElement>("[data-cv-open]", el);
    if (!video || !open) return [];
    const title = $(".work__body h4", el)?.textContent?.trim() ?? "video";
    return [{ el, title, video, open, sound: $<HTMLButtonElement>("[data-cv-sound]", el), inView: false, blocked: false }];
  });
  if (!cards.length) return;

  let lightbox = false;
  const manual = (c: Card) => c.blocked || getTier() === "C";

  const paint = (c: Card) => {
    c.el.classList.toggle("is-playing", !c.video.paused);
    c.el.classList.toggle("is-manual", manual(c));
    c.open.setAttribute("aria-label", `${manual(c) ? "Play video" : "Open video"}: ${c.title}`);
  };
  const setMuted = (c: Card, muted: boolean) => {
    c.video.muted = muted;
    c.sound?.setAttribute("aria-pressed", String(!muted));
  };
  const halt = (c: Card) => {
    c.video.pause();
    setMuted(c, true);
    paint(c);
  };
  const sync = async (c: Card) => {
    if (!c.inView || document.hidden || lightbox || manual(c)) return halt(c);
    try {
      await c.video.play();
    } catch (err) {
      // An interrupted request (scrolled away mid-load) is normal; anything else means the browser said no.
      if ((err as DOMException).name !== "AbortError") c.blocked = true;
    }
    paint(c);
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const c = cards.find((x) => x.el.contains(e.target));
        if (!c) continue;
        c.inView = e.isIntersecting && e.intersectionRatio >= 0.5;
        void sync(c);
      }
    },
    { threshold: [0, 0.5] },
  );

  for (const c of cards) {
    const media = $(".cv__media", c.el) ?? c.el;
    io.observe(media);
    whenNear(media, () => (c.video.poster = c.video.dataset.poster ?? ""), "1200px 0px");
    for (const type of ["playing", "pause"]) c.video.addEventListener(type, () => paint(c));
    paint(c);

    c.sound?.addEventListener("click", () => {
      if (!c.video.muted) return setMuted(c, true);
      for (const o of cards) if (o !== c) setMuted(o, true);
      setMuted(c, false);
      soundOn(c.video);
    });

    c.open.addEventListener("click", async () => {
      lightbox = true;
      cards.forEach(halt);
      try {
        const { openVideo } = await import("./dialog");
        openVideo({
          title: c.title,
          poster: c.video.dataset.poster,
          sources: $$<HTMLSourceElement>("source", c.video).map((s) => ({ src: s.getAttribute("src") ?? "", type: s.type })),
          opener: c.open,
          onClose: () => {
            lightbox = false;
            cards.forEach((x) => void sync(x));
          },
        });
      } catch {
        lightbox = false;
        cards.forEach((x) => void sync(x));
      }
    });
  }

  onSoundElsewhere(
    (v) => cards.some((c) => c.video === v),
    () => cards.forEach((c) => setMuted(c, true)),
  );
  document.addEventListener("visibilitychange", () => cards.forEach((c) => void sync(c)));
  onTierChange(() => cards.forEach((c) => void sync(c)));
}

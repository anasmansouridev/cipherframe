import { track } from "../analytics";
import { $, $$ } from "../runtime";
import { getTier, onTierChange } from "../tier";

/**
 * Work films. Rules:
 * - Nothing downloads until a card is played: videos are preload="none" and the posters stand in.
 * - A card that is ≥50% in view autoplays, muted. Only one plays at a time (the first one in
 *   reading order that is on screen; it keeps playing until it leaves). Leaving the view pauses it.
 * - Tapping the film toggles play/pause. The round speaker button unmutes that film only and
 *   restarts it from 0 so the sound lines up.
 * - Reduced motion, Save-Data and 2G/3G (all Tier C): no autoplay, the poster shows a play button,
 *   playback starts only on tap (still muted until the speaker button is used).
 */
interface Card {
  el: HTMLElement;
  slug: string;
  title: string;
  video: HTMLVideoElement;
  toggle: HTMLButtonElement;
  sound: HTMLButtonElement;
  ratio: number;
  userPaused: boolean;
  played: boolean;
}

export function initWorkVideos(): void {
  const cards: Card[] = $$<HTMLElement>("[data-wv]").flatMap((el) => {
    const video = $<HTMLVideoElement>("[data-wv-video]", el);
    const toggle = $<HTMLButtonElement>("[data-wv-toggle]", el);
    const sound = $<HTMLButtonElement>("[data-wv-sound]", el);
    if (!video || !toggle || !sound) return [];
    return [{ el, slug: el.dataset.slug ?? "", title: $(".wv__title", el)?.textContent?.trim() ?? "film", video, toggle, sound, ratio: 0, userPaused: false, played: false }];
  });
  if (!cards.length) return;

  let active: Card | null = null;
  let pinned: Card | null = null; // chosen by the visitor (tap or speaker); keeps playing while it stays on screen

  const tapOnly = () => getTier() === "C";

  const paintPlayback = (c: Card) => {
    const playing = !c.video.paused;
    c.el.classList.toggle("is-playing", playing);
    c.toggle.setAttribute("aria-label", `${playing ? "Pause" : "Play"} video: ${c.title}`);
  };
  const setMuted = (c: Card, muted: boolean) => {
    c.video.muted = muted;
    c.sound.classList.toggle("is-on", !muted);
    c.sound.setAttribute("aria-label", muted ? "Turn sound on" : "Turn sound off");
  };
  /** Pause and re-mute: a film that is not the active one never keeps its sound. */
  const halt = (c: Card) => {
    if (!c.video.paused) c.video.pause();
    setMuted(c, true);
    paintPlayback(c);
  };
  const play = async (c: Card) => {
    for (const o of cards) if (o !== c) halt(o);
    active = c;
    try {
      await c.video.play();
    } catch {
      /* blocked or unsupported: the poster and play button stay */
    }
    paintPlayback(c);
    if (!c.video.paused && !c.played) {
      c.played = true;
      track("work_video_play", { slug: c.slug });
    }
  };

  const evaluate = () => {
    if (tapOnly() || document.hidden) return;
    if (pinned && pinned.ratio >= 0.5) {
      if (active === pinned && pinned.video.paused && !pinned.userPaused) void play(pinned);
      return;
    }
    pinned = null;
    if (active && active.ratio >= 0.5 && !active.userPaused) {
      if (active.video.paused) void play(active);
      return;
    }
    let pick: Card | null = null;
    for (const c of cards) if (c.ratio >= 0.5 && !c.userPaused && (!pick || c.ratio > pick.ratio + 0.01)) pick = c;
    if (pick) void play(pick);
    else if (active) {
      halt(active);
      active = null;
    }
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const c = cards.find((x) => x.el === e.target);
        if (!c) continue;
        c.ratio = e.isIntersecting ? e.intersectionRatio : 0;
        if (c.ratio < 0.5) {
          c.userPaused = false; // scrolling away forgets a manual pause
          if (pinned === c) pinned = null;
        }
      }
      evaluate();
    },
    { threshold: [0, 0.25, 0.5, 0.75, 1] },
  );

  for (const c of cards) {
    io.observe(c.el);
    for (const type of ["playing", "pause", "play"]) c.video.addEventListener(type, () => paintPlayback(c));
    paintPlayback(c);

    c.toggle.addEventListener("click", () => {
      if (c.video.paused) {
        c.userPaused = false;
        pinned = c;
        void play(c);
      } else {
        c.userPaused = true;
        if (pinned === c) pinned = null;
        c.video.pause();
      }
    });

    c.sound.addEventListener("click", () => {
      if (c.video.muted) {
        for (const o of cards) if (o !== c) setMuted(o, true);
        setMuted(c, false);
        c.video.currentTime = 0;
        c.userPaused = false;
        pinned = c;
        void play(c);
        track("work_video_sound_on", { slug: c.slug });
      } else {
        setMuted(c, true);
      }
    });
  }

  for (const a of $$<HTMLAnchorElement>("[data-work-x]")) a.addEventListener("click", () => track("work_x_click", { slug: a.dataset.workX ?? "" }));

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) active?.video.pause();
    else evaluate();
  });
  onTierChange((tier) => {
    if (tier === "C") {
      cards.forEach(halt);
      active = null;
      pinned = null;
    } else evaluate();
  });
}

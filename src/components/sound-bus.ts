/**
 * At most one film on the page has sound. A film that turns its sound on announces itself here;
 * every other module mutes the films it owns. (Cards in the Work films, the See the difference card,
 * the Studio concepts and the lightbox each own their own videos.)
 */
const EVENT = "cf:sound";

export function soundOn(video: HTMLVideoElement): void {
  document.dispatchEvent(new CustomEvent<HTMLVideoElement>(EVENT, { detail: video }));
}

/** `mute` runs when a film this module does not own turns its sound on. */
export function onSoundElsewhere(owns: (video: HTMLVideoElement) => boolean, mute: () => void): void {
  document.addEventListener(EVENT, (e) => {
    if (!owns((e as CustomEvent<HTMLVideoElement>).detail)) mute();
  });
}

import { getPersonalization } from "./personalize";
import { session, setSession } from "./runtime";

const FIRST_TOUCH_KEY = "cf_utm_first";
const UTM_KEY = /^utm_[a-z0-9_]{1,32}$/i;

function readUtm(search: string): Record<string, string> {
  const out: Record<string, string> = {};
  new URLSearchParams(search).forEach((value, key) => {
    if (UTM_KEY.test(key) && value) out[key.toLowerCase()] = value.slice(0, 200);
  });
  return out;
}

/** Store first-touch UTMs for the session so they survive in-page navigation. */
export function captureFirstTouch(search: string = location.search): void {
  const utm = readUtm(search);
  if (Object.keys(utm).length && !session(FIRST_TOUCH_KEY)) setSession(FIRST_TOUCH_KEY, JSON.stringify(utm));
}

export function getUtm(): Record<string, string> {
  const stored = session(FIRST_TOUCH_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) if (UTM_KEY.test(k) && typeof v === "string") out[k] = v;
      return out;
    } catch {
      /* fall through to the current URL */
    }
  }
  return readUtm(location.search);
}

/** c, t (sanitised) and every utm_* parameter, for forwarding to Cal.com and Tally. */
export function attributionParams(): Record<string, string> {
  const p = getPersonalization();
  const out: Record<string, string> = {};
  if (p.project) out.c = p.project;
  if (p.topic) out.t = p.topic;
  return { ...out, ...getUtm() };
}

export function withParams(url: string, params: Record<string, string> = attributionParams()): string {
  if (!url) return url;
  try {
    const u = new URL(url, location.href);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    return u.toString();
  } catch {
    return url;
  }
}

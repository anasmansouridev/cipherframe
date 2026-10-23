import { CFG, $$ } from "./runtime.ts";

export const TOPICS = {
  mainnet: "mainnet",
  listing: "listing",
  partnership: "partnership",
  upgrade: "upgrade",
  launch: "launch",
  raise: "raise",
} as const;
export type Topic = keyof typeof TOPICS;

export interface Personalization {
  project: string | null;
  topic: Topic | null;
}

const ALLOWED = /^[\p{L}\p{N} &.'-]+$/u;
const HAS_WORD_CHAR = /[\p{L}\p{N}]/u;
export const MAX_PROJECT_LENGTH = 40;

/** Letters, digits, spaces and & . - ' only; trimmed; at most 40 characters. Anything else is ignored. */
export function sanitizeProject(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.replace(/ {2,}/g, " ").trim();
  if (!value || value.length > MAX_PROJECT_LENGTH) return null;
  if (!ALLOWED.test(value) || !HAS_WORD_CHAR.test(value)) return null;
  return value;
}

export function parseTopic(raw: string | null | undefined): Topic | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(TOPICS, value) ? (value as Topic) : null;
}

export function getPersonalization(search: string = location.search): Personalization {
  const params = new URLSearchParams(search);
  return { project: sanitizeProject(params.get("c")), topic: parseTopic(params.get("t")) };
}

export function heroHeadline(p: Personalization, variant: "A" | "B" = CFG.headlineVariant): { lead: string; last: string } {
  if (p.project && p.topic) return { lead: `${p.project}'s ${TOPICS[p.topic]} deserves more than a `, last: "JPEG." };
  if (p.project) return { lead: `${p.project}'s next announcement deserves more than a `, last: "JPEG." };
  if (variant === "B") return { lead: "Every announcement, animated in 48 ", last: "hours." };
  return { lead: "Stop launching into ", last: "silence." };
}

export function finalHeadline(p: Personalization): string {
  return p.project
    ? `${p.project}, your next announcement is already written. Make it move.`
    : "Your next announcement is already written. Make it move.";
}

/** Writes personalised copy into the page. textContent only; never innerHTML. Idempotent. */
export function applyPersonalization(p: Personalization = getPersonalization()): Personalization {
  const root = document.documentElement;
  const h = heroHeadline(p);
  $$("[data-p='h1-lead']").forEach((el) => (el.textContent = h.lead));
  $$("[data-p='h1-last']").forEach((el) => (el.textContent = h.last));
  const h1 = document.getElementById("hero-title");
  const length = h.lead.length + h.last.length;
  if (h1) {
    h1.classList.toggle("is-long", length > 44);
    h1.classList.toggle("is-xlong", length > 64);
  }

  $$("[data-p='final-h2']").forEach((el) => (el.textContent = finalHeadline(p)));

  const name = p.project ?? "Arclight";
  $$("[data-p='project']").forEach((el) => (el.textContent = name));
  $$("[data-p='project-upper']").forEach((el) => (el.textContent = name.toUpperCase()));

  $$("[data-p='chip']").forEach((el) => (el.hidden = !p.project));
  $$("[data-p='chip-name']").forEach((el) => (el.textContent = p.project ?? ""));

  if (p.project) root.dataset.personalized = p.topic ? "project-topic" : "project";
  return p;
}

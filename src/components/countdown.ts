import { CFG } from "../runtime";

/** "YYYY-MM-DD" is read as midnight UTC; a full ISO timestamp is used as-is. */
export function eventStart(): number {
  const raw = CFG.event.start.trim();
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00Z` : raw);
  return Number.isFinite(t) ? t : NaN;
}

export function stripText(now: number = Date.now()): string | null {
  const slots = CFG.deskSlotsLeft;
  if (!(slots > 0)) return null;
  const start = eventStart();
  const { name, dates, place } = CFG.event;
  if (name && start > now) {
    const diff = start - now;
    const d = Math.floor(diff / 86_400_000);
    const h = Math.floor((diff % 86_400_000) / 3_600_000);
    return `◆ ${name} · ${dates} · ${place} — launch-week slots: ${slots} left · ${d}d ${h}h to go`;
  }
  return `◆ ${slots} Desk slots open this month · ${CFG.freeRemakesPerDay} free remakes a day`;
}

export function renderStrip(now: number = Date.now()): void {
  const strip = document.getElementById("strip");
  const text = strip?.querySelector("[data-strip]");
  if (!strip || !text) return;
  const value = stripText(now);
  strip.hidden = value === null;
  if (value !== null && text.textContent !== value) text.textContent = value;
}

/** Re-render every minute (the countdown shows days and hours) and when the tab comes back. */
export function startCountdown(): void {
  renderStrip();
  let timer = window.setInterval(() => renderStrip(), 60_000);
  document.addEventListener("visibilitychange", () => {
    clearInterval(timer);
    if (!document.hidden) {
      renderStrip();
      timer = window.setInterval(() => renderStrip(), 60_000);
    }
  });
}

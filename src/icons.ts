/**
 * Icons in the Cipherframe design-system style: Lucide-style, 24px grid, 1.5px stroke, round caps
 * and joins, stroke="currentColor". Rendered inline into the HTML at build time.
 * Design-system set: wallet, bridge, vault, hexagon, coins, link (chain link), key, lock,
 * zap (lightning), calendar, check. UI icons the page also needs: x, arrow (arrow-right), play,
 * copy, chevron (chevron-down), sound (speaker on), mute (speaker off). The build inlines public/brand/icons/<name>.svg instead when present
 * (see BRAND_FILES in scripts/vite-plugin-cipherframe.ts).
 */
export const ICONS: Record<string, string> = {
  wallet:
    '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  bridge: '<path d="M2 17h20"/><path d="M5 17v-5"/><path d="M19 17v-5"/><path d="M2 8h20"/><path d="M5 8c2.5 5 11.5 5 14 0"/><path d="M12 12.5V17"/>',
  vault:
    '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="12" cy="12" r="3"/><path d="m7.5 7.5 2.4 2.4"/><path d="m14.1 14.1 2.4 2.4"/><path d="m16.5 7.5-2.4 2.4"/><path d="m9.9 14.1-2.4 2.4"/>',
  hexagon:
    '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>',
  coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  key: '<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  play: '<path d="M6 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L7.5 3.64A1 1 0 0 0 6 4.5z"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  sound:
    '<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6a1.4 1.4 0 0 1-1 .4H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.4 18.4a9 9 0 0 0 0-12.8"/>',
  mute: '<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6a1.4 1.4 0 0 1-1 .4H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>',
};

export function icon(name: string, cls = "icon"): string {
  const body = ICONS[name];
  if (!body) throw new Error(`Unknown icon: ${name}`);
  return `<svg class="${cls}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

/** The Cipherframe mark (28×28): 2.5-unit brackets in --ice, the diamond polygon in --signal-mint. */
export const MARK_SVG = (size: number) =>
  `<svg viewBox="0 0 28 28" width="${size}" height="${size}" aria-hidden="true" focusable="false"><path d="M8 4H4v20h4" fill="none" stroke="var(--ice)" stroke-width="2.5"/><path d="M20 4h4v20h-4" fill="none" stroke="var(--ice)" stroke-width="2.5"/><polygon points="14,8.5 19.5,14 14,19.5 8.5,14" fill="var(--signal-mint)"/></svg>`;

export function mark(cls = "mark", size = 28): string {
  return MARK_SVG(size).replace("<svg ", `<svg class="${cls}" `);
}

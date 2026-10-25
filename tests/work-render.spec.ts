import { expect, test } from "@playwright/test";
import { CONFIG } from "../src/config.ts";
import { workVideosBlock } from "../scripts/vite-plugin-cipherframe.ts";
import { WORK_TAG_PERMISSION, WORK_TAG_UNOFFICIAL, workTag } from "../src/work.ts";

// Build-time rendering of the Work cards (no browser needed), so it runs once.
test.beforeEach(({}, info) => test.skip(info.project.name !== "chromium-1280x800", "runs once"));

test("work (e2) · the permission value decides the tag text and style", () => {
  expect(workTag(false)).toEqual({ text: "UNOFFICIAL CONCEPT · NOT AFFILIATED", cls: "tag tag--dashed" });
  expect(workTag(true)).toEqual({ text: "SHARED WITH PERMISSION", cls: "tag" });

  const original = CONFIG.work.map((w) => w.permission);
  try {
    CONFIG.work[0].permission = true;
    const html = workVideosBlock();
    const cards = html.split("<article").slice(1);
    expect(cards[0]).toContain(WORK_TAG_PERMISSION);
    expect(cards[0]).not.toContain(WORK_TAG_UNOFFICIAL);
    expect(cards[0]).toContain('data-permission="true"');
    expect(cards[1]).toContain(WORK_TAG_UNOFFICIAL);
    expect(cards[1]).toContain("tag tag--dashed");
    expect(html).not.toMatch(/client/i);
  } finally {
    CONFIG.work.forEach((w, i) => (w.permission = original[i]));
  }
});

test("work · every card is built from config: lazy, silent, sized, with a poster and a link out", () => {
  const html = workVideosBlock();
  for (const w of CONFIG.work) {
    expect(html).toContain(`data-slug="${w.slug}"`);
    expect(html).toContain(w.title.replace("&", "&amp;"));
    expect(html).toContain(`poster="${w.poster}"`);
    expect(html).toContain(`href="${w.xUrl}"`);
    expect(html).toContain(w.meta);
  }
  expect(html.match(/preload="none"/g)).toHaveLength(CONFIG.work.length);
  expect(html.match(/ muted /g)).toHaveLength(CONFIG.work.length);
  expect(html.match(/width="720" height="720"/g)).toHaveLength(CONFIG.work.length);
  expect(html.match(/rel="noopener"/g)!.length).toBeGreaterThanOrEqual(CONFIG.work.length);
  expect(html).not.toMatch(/autoplay/);
});

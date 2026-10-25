/** Shared by the build (renders the cards) and the tests: which tag a Work film carries. */
export interface WorkItem {
  slug: string;
  title: string;
  handle: string;
  xUrl: string;
  meta: string;
  line: string;
  video: string;
  webm: string; // "" = no WebM source
  poster: string;
  /** true only when the brand has agreed to be shown. Never set it for unsolicited concepts. */
  permission: boolean;
}

export const WORK_TAG_UNOFFICIAL = "UNOFFICIAL CONCEPT · NOT AFFILIATED";
export const WORK_TAG_PERMISSION = "SHARED WITH PERMISSION";

/** permission false = dashed steel "unofficial" tag; true = the plain permission tag. */
export function workTag(permission: boolean): { text: string; cls: string } {
  return permission ? { text: WORK_TAG_PERMISSION, cls: "tag" } : { text: WORK_TAG_UNOFFICIAL, cls: "tag tag--dashed" };
}

import type { Block } from "./types";

/**
 * Compute sequential numbering for image and image-table blocks.
 * Returns a Map of block.id → 1-based number, in display order.
 */
export function computeImageNumbers(blocks: Block[]): Map<string, number> {
  const out = new Map<string, number>();
  const ordered = [...blocks].sort((a, b) => a.order - b.order);
  let n = 0;
  for (const b of ordered) {
    if (b.type === "image" || b.type === "image-table") {
      n += 1;
      out.set(b.id, n);
    }
  }
  return out;
}

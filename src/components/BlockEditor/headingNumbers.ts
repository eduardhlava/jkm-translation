import type { Block, BlockType } from "./types";

const HEADING_LEVEL: Partial<Record<BlockType, number>> = {
  heading1: 1,
  heading2: 2,
  heading3: 3,
  heading4: 4,
};

/**
 * Compute hierarchical numbering for headings (H1..maxLevel).
 * Returns a Map of block.id → "1.2.3" style label (no trailing dot).
 * Blocks should be supplied in display order.
 */
export function computeHeadingNumbers(blocks: Block[], maxLevel = 4): Map<string, string> {
  const out = new Map<string, string>();
  const counters = [0, 0, 0, 0, 0, 0];
  const ordered = [...blocks].sort((a, b) => a.order - b.order);
  for (const b of ordered) {
    const lvl = HEADING_LEVEL[b.type];
    if (!lvl || lvl > maxLevel) continue;
    if (b.content?.unlisted) continue;
    counters[lvl - 1] += 1;
    for (let i = lvl; i < counters.length; i++) counters[i] = 0;
    const label = counters.slice(0, lvl).join(".");
    out.set(b.id, label);
  }
  return out;
}

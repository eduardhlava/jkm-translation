import { computeHeadingNumbers } from "./headingNumbers";
import type { Block } from "./types";

export interface DocumentContentsItem {
  id: string;
  level: 1 | 2 | 3;
  text: string;
  number?: string;
  unlisted: boolean;
}

export function buildDocumentContents(blocks: Block[], numbered: boolean): DocumentContentsItem[] {
  const numbers = numbered ? computeHeadingNumbers(blocks) : undefined;
  return [...blocks].sort((a, b) => a.order - b.order).flatMap((block) => {
    const level = block.type === "heading1" ? 1 : block.type === "heading2" ? 2 : block.type === "heading3" ? 3 : undefined;
    if (!level) return [];
    return [{ id: block.id, level, text: String(block.content?.text ?? "").trim() || "(bez názvu)", number: numbers?.get(block.id), unlisted: !!block.content?.unlisted }];
  });
}
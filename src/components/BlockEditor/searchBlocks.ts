import { cellPlainText } from "./cellFormatting";
import type { Block } from "./types";

/** Lowercase and strip diacritics so "zaruka" matches "Záruka". */
export function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function htmlText(html: string): string {
  const doc = new DOMParser().parseFromString(String(html ?? "").replace(/<br\s*\/?\s*>/gi, " ").replace(/<\/(p|li|div|h\d)>/gi, " "), "text/html");
  return doc.body.textContent ?? "";
}

const tableText = (t: any): string[] => (t?.rows ?? []).flat().map((c: string) => cellPlainText(String(c ?? "")));

export function blockSearchText(block: Block): string {
  const c = block.content ?? {};
  switch (block.type) {
    case "heading1": case "heading2": case "heading3": case "heading4":
    case "alert": case "info": case "warning":
      return String(c.text ?? "");
    case "text": return htmlText(c.html ?? "");
    case "table": return tableText(c).join(" \n ");
    case "image": return String(c.alt ?? "");
    case "image-table": return [String(c.image?.alt ?? ""), ...tableText(c.table)].join(" \n ");
    default: return "";
  }
}

/** Block ids (document order) containing the query as a case/diacritics-insensitive substring. */
export function searchBlocks(blocks: Block[], query: string): string[] {
  const q = normalizeSearch(query.trim());
  if (!q) return [];
  return [...blocks].sort((a, b) => a.order - b.order).filter((b) => normalizeSearch(blockSearchText(b)).includes(q)).map((b) => b.id);
}

import type { Block } from "./types";

/**
 * Je obrázek zařazen do číslování? Chybějící hodnota = true,
 * takže stávající dokumenty se nemění.
 */
export function isImageNumbered(b: Block): boolean {
  if (b.type === "image") return b.content?.numbered !== false;
  if (b.type === "image-table") return b.content?.image?.numbered !== false;
  return true;
}

/**
 * Compute sequential numbering for image and image-table blocks.
 * Returns a Map of block.id → 1-based number, in display order.
 * Blocks with numbered === false are skipped (no gap in numbering).
 */
export function computeImageNumbers(blocks: Block[]): Map<string, number> {
  const out = new Map<string, number>();
  const ordered = [...blocks].sort((a, b) => a.order - b.order);
  let n = 0;
  for (const b of ordered) {
    if ((b.type === "image" || b.type === "image-table") && isImageNumbered(b)) {
      n += 1;
      out.set(b.id, n);
    }
  }
  return out;
}

/**
 * Odvodí slovo pro popisek nečíslovaného obrázku z prefixu číslování:
 * odstraní koncové označení čísla a mezery.
 * "Obrázek č. " → "Obrázek", "Figure No. " → "Figure",
 * "Abbildung Nr. " → "Abbildung", "Rys. nr " → "Rys."
 */
export function imageLabelWord(prefix: string | undefined): string {
  const raw = (prefix ?? "").trim();
  const stripped = raw.replace(/\s*(č\.|číslo|no\.?|nr\.?|number)\s*$/i, "").trim();
  return stripped || raw || "Obrázek";
}

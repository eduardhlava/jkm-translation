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
 * Popisek číslovaného obrázku: označení + číslo. Mezera mezi označením
 * a číslem se doplňuje automaticky, takže "Obrázek č." i starší
 * "Obrázek č. " dají "Obrázek č. 3".
 */
export function imageNumberedLabel(prefix: string | undefined, n: number): string {
  const base = (prefix ?? "").trim() || "Obrázek č.";
  return `${base} ${n}`;
}

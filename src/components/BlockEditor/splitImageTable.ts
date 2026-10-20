import type { Block, ImageTableContent } from "./types";

/**
 * Rozdělí blok "Obrázek + Tabulka" na dva samostatné bloky:
 * 1) image – zachová původní id, obsah obrázku a blokový piktogram;
 *    position se nastaví na "center" (image-table byl vždy na střed).
 * 2) table – nové id, obsah tabulky beze změny (vč. merges, colWidths,
 *    rowColors, piktogramů v buňkách), bez blokového piktogramu.
 * Přechodný příznak autoTableBreak se zahodí.
 * Pořadí (order) přiřadí volající – vrácené bloky mají order původního bloku.
 */
export function splitImageTableBlock(block: Block): [Block, Block] {
  if (block.type !== "image-table") {
    throw new Error("splitImageTableBlock: expected an image-table block");
  }
  const content = (block.content ?? {}) as ImageTableContent;
  const image: Block = {
    id: block.id,
    type: "image",
    template: block.template,
    order: block.order,
    content: {
      ...(content.image ?? { url: "", alt: "" }),
      position: "center",
      ...(content.pictogram && content.pictogram !== "none"
        ? { pictogram: content.pictogram }
        : {}),
    },
  };
  const table: Block = {
    id: crypto.randomUUID(),
    type: "table",
    template: block.template,
    order: block.order,
    content: content.table ?? { headerRow: true, rows: [["", ""], ["", ""]] },
  };
  return [image, table];
}

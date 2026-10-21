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

/**
 * Opak splitImageTableBlock: spojí blok "image" s blokem "table" pod ním do
 * jednoho "image-table". Zachová id, template a order obrázku; position se
 * zahodí (image-table je vždy na střed); tabulka se přenese beze změny.
 * Blokový piktogram: obrázku, jinak tabulky, jinak žádný.
 */
export function mergeImageAndTable(image: Block, table: Block): Block {
  if (image.type !== "image" || table.type !== "table") {
    throw new Error("mergeImageAndTable: expected image + table blocks");
  }
  const { position: _position, pictogram: imgPic, ...img } = (image.content ?? { url: "", alt: "" }) as ImageTableContent["image"];
  const { pictogram: tablePic, ...tbl } = (table.content ?? { headerRow: true, rows: [] }) as ImageTableContent["table"];
  const pictogram = imgPic && imgPic !== "none" ? imgPic : tablePic && tablePic !== "none" ? tablePic : undefined;
  return {
    id: image.id,
    type: "image-table",
    template: image.template,
    order: image.order,
    content: { image: img, table: tbl, ...(pictogram ? { pictogram } : {}) },
  };
}

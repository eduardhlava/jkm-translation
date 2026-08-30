export type BlockType =
  | "heading1"
  | "heading2"
  | "heading3"
  | "heading4"
  | "text"
  | "table"
  | "image"
  | "image-table"
  | "alert"
  | "info"
  | "warning"
  | "pagebreak";

export type TextAlign = "left" | "center" | "right";
export type TextSize = "small" | "normal" | "large";
export type Pictogram = "none" | "alert" | "alert-electric" | "info" | "recycling";

/**
 * Piktogram v buňce tabulky je uložen jako neviditelný textový token
 * na začátku obsahu buňky: `[[pic:alert]] text`.
 * Díky tomu je plně kompatibilní s uložením do Notion (buňka = prostý text).
 */
export const CELL_PICTOGRAM_RE = /^\s*\[\[pic:(alert-electric|alert|info|recycling)\]\]\s*/;

export function parseCellPictogram(cell: string): { pictogram: Pictogram; text: string } {
  const m = CELL_PICTOGRAM_RE.exec(cell ?? "");
  if (!m) return { pictogram: "none", text: cell ?? "" };
  return { pictogram: m[1] as Pictogram, text: (cell ?? "").replace(CELL_PICTOGRAM_RE, "") };
}

export function buildCellValue(pictogram: Pictogram, text: string): string {
  return !pictogram || pictogram === "none" ? text : `[[pic:${pictogram}]]${text ? ` ${text}` : ""}`;
}


export interface HeadingContent { text: string }
export interface TextContent { html: string; align?: TextAlign; size?: TextSize; pictogram?: Pictogram }
export interface TableContent {
  headerRow: boolean;
  rows: string[][]; // rows[r][c]
  pictogram?: Pictogram;
}
export interface ImageContent { url: string; alt: string; width?: number; pictogram?: Pictogram }
export interface ImageTableContent { image: ImageContent; table: TableContent; pictogram?: Pictogram }
export interface CalloutContent { text: string }
export interface PageBreakContent {}

export type BlockContent =
  | HeadingContent
  | TextContent
  | TableContent
  | ImageContent
  | ImageTableContent
  | CalloutContent
  | PageBreakContent;

export interface Block {
  id: string;
  type: BlockType;
  template: string;
  order: number;
  content: any;
}

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  heading1: "Nadpis 1",
  heading2: "Nadpis 2",
  heading3: "Nadpis 3",
  heading4: "Nadpis 4",
  text: "Text",
  table: "Tabulka",
  image: "Obrázek",
  "image-table": "Obrázek + Tabulka",
  alert: "Výstraha",
  info: "Informace",
  warning: "Upozornění",
  pagebreak: "Konec stránky",
};

export function emptyContent(type: BlockType): any {
  switch (type) {
    case "heading1":
    case "heading2":
    case "heading3":
    case "heading4":
      return { text: "" };
    case "text":
      return { html: "", align: "left", size: "normal" };
    case "table":
      return { headerRow: true, rows: [["", ""], ["", ""]] };
    case "image":
      return { url: "", alt: "" };
    case "image-table":
      return {
        image: { url: "", alt: "" },
        table: {
          headerRow: true,
          rows: [
            ["#", "Název části"],
            ["1", ""],
            ["2", ""],
            ["3", ""],
          ],
        },
      };
    case "alert":
    case "info":
    case "warning":
      return { text: "" };
    case "pagebreak":
      return {};
  }
}

export function createBlock(type: BlockType, order: number): Block {
  return {
    id: crypto.randomUUID(),
    type,
    template: "default",
    order,
    content: emptyContent(type),
  };
}

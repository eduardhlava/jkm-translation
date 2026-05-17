export type BlockType =
  | "heading1"
  | "heading2"
  | "heading3"
  | "heading4"
  | "text"
  | "table"
  | "image"
  | "alert"
  | "info"
  | "warning";

export interface HeadingContent { text: string }
export interface TextContent { html: string }
export interface TableContent {
  headerRow: boolean;
  rows: string[][]; // rows[r][c]
}
export interface ImageContent { url: string; alt: string; width?: number }
export interface CalloutContent { text: string }

export type BlockContent =
  | HeadingContent
  | TextContent
  | TableContent
  | ImageContent
  | CalloutContent;

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
  alert: "Výstraha",
  info: "Informace",
  warning: "Upozornění",
};

export function emptyContent(type: BlockType): any {
  switch (type) {
    case "heading1":
    case "heading2":
    case "heading3":
    case "heading4":
      return { text: "" };
    case "text":
      return { html: "" };
    case "table":
      return { headerRow: true, rows: [["", ""], ["", ""]] };
    case "image":
      return { url: "", alt: "" };
    case "alert":
    case "info":
    case "warning":
      return { text: "" };
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

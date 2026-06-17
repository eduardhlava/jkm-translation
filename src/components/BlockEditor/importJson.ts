import { type Block, type BlockType, emptyContent } from "./types";

const VALID_TYPES: BlockType[] = [
  "heading1", "heading2", "heading3", "heading4",
  "text", "table", "image", "image-table", "alert", "info", "warning", "pagebreak",
];

const VALID_ALIGN = ["left", "center", "right"] as const;
const VALID_SIZE = ["small", "normal", "large"] as const;

export interface ImportedBlock {
  type: BlockType;
  content?: any;
  template?: string;
}

export interface DocumentImport {
  title?: string;
  blocks: ImportedBlock[];
}

export interface ParseResult {
  title?: string;
  blocks: Block[];
}

function normalizeContent(type: BlockType, raw: any): any {
  const base = emptyContent(type);
  const c = raw && typeof raw === "object" ? raw : {};
  switch (type) {
    case "heading1":
    case "heading2":
    case "heading3":
    case "heading4":
      return { text: String(c.text ?? "") };
    case "text": {
      const align = (VALID_ALIGN as readonly string[]).includes(c.align) ? c.align : "left";
      const size = (VALID_SIZE as readonly string[]).includes(c.size) ? c.size : "normal";
      if (typeof c.html === "string") return { html: c.html, align, size };
      if (typeof c.text === "string") return { html: `<p>${c.text}</p>`, align, size };
      return { ...base, align, size };
    }
    case "image":
      return {
        url: String(c.url ?? ""),
        alt: String(c.alt ?? ""),
        ...(Number.isFinite(Number(c.width)) ? { width: Number(c.width) } : {}),
      };
    case "table": {
      const rows = Array.isArray(c.rows) ? c.rows.map((r: any) =>
        Array.isArray(r) ? r.map((cell: any) => String(cell ?? "")) : []
      ) : base.rows;
      return { headerRow: c.headerRow !== false, rows };
    }
    case "image-table": {
      const img = c.image && typeof c.image === "object" ? c.image : {};
      const tbl = c.table && typeof c.table === "object" ? c.table : {};
      const rows = Array.isArray(tbl.rows) ? tbl.rows.map((r: any) =>
        Array.isArray(r) ? r.map((cell: any) => String(cell ?? "")) : []
      ) : base.table.rows;
      return {
        image: {
          url: String(img.url ?? ""),
          alt: String(img.alt ?? ""),
          ...(Number.isFinite(Number(img.width)) ? { width: Number(img.width) } : {}),
        },
        table: { headerRow: tbl.headerRow !== false, rows },
      };
    }
    case "alert":
    case "info":
    case "warning":
      return { text: String(c.text ?? "") };
    case "pagebreak":
      return {};
  }
}

export function parseDocumentJson(input: string): ParseResult {
  let parsed: any;
  try {
    parsed = JSON.parse(input);
  } catch (e) {
    throw new Error("Neplatný JSON: " + (e instanceof Error ? e.message : String(e)));
  }

  let title: string | undefined;
  let rawBlocks: any[];

  if (Array.isArray(parsed)) {
    rawBlocks = parsed;
  } else if (parsed && typeof parsed === "object" && Array.isArray(parsed.blocks)) {
    rawBlocks = parsed.blocks;
    if (typeof parsed.title === "string") title = parsed.title;
  } else {
    throw new Error('JSON musí být pole bloků nebo objekt { "blocks": [...] }.');
  }

  const blocks: Block[] = rawBlocks.map((b: any, i: number) => {
    if (!b || typeof b !== "object") {
      throw new Error(`Blok #${i + 1} není objekt.`);
    }
    const type = b.type as BlockType;
    if (!VALID_TYPES.includes(type)) {
      throw new Error(`Blok #${i + 1}: neznámý typ „${b.type}". Povolené: ${VALID_TYPES.join(", ")}.`);
    }
    return {
      id: (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : `${Date.now()}-${i}`,
      type,
      template: typeof b.template === "string" && b.template ? b.template : "default",
      order: i,
      content: normalizeContent(type, b.content),
    };
  });

  return { title, blocks };
}

export const SAMPLE_DOCUMENT_JSON: DocumentImport = {
  title: "Vzorový dokument",
  blocks: [
    { type: "heading1", content: { text: "Hlavní nadpis" } },
    { type: "text", content: { html: "<p>Úvodní <strong>odstavec</strong> dokumentu s <a href=\"https://example.com\">odkazem</a>.</p>" } },
    { type: "heading2", content: { text: "Sekce 1" } },
    { type: "text", content: { html: "<ul><li>První bod</li><li>Druhý bod</li></ul>" } },
    { type: "info", content: { text: "Informační hláška pro čtenáře." } },
    { type: "warning", content: { text: "Pozor na tento detail." } },
    { type: "alert", content: { text: "Kritické upozornění." } },
    { type: "heading3", content: { text: "Podsekce" } },
    { type: "image", content: { url: "https://placehold.co/600x300", alt: "Popisek obrázku", width: 400 } },
    { type: "table", content: {
        headerRow: true,
        rows: [
          ["Sloupec A", "Sloupec B"],
          ["Hodnota 1", "Hodnota 2"],
          ["Hodnota 3", "Hodnota 4"],
        ],
      },
    },
  ],
};

// Convert sanitized HTML (as produced by blocksToHtml or Notion fetch) back into blocks.
// Used as a fallback when a document has no saved block representation.
export function htmlToBlocks(html: string): Block[] {
  if (typeof DOMParser === "undefined" || !html) return [];
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstChild as HTMLElement | null;
  if (!root) return [];

  const blocks: Block[] = [];
  const mkId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
  const push = (type: BlockType, content: any) => {
    blocks.push({ id: mkId(), type, template: "default", order: blocks.length, content });
  };

  const children = Array.from(root.children);
  for (const el of children) {
    const tag = el.tagName.toUpperCase();
    if (tag === "H1") push("heading1", { text: el.textContent ?? "" });
    else if (tag === "H2") push("heading2", { text: el.textContent ?? "" });
    else if (tag === "H3") push("heading3", { text: el.textContent ?? "" });
    else if (tag === "H4") push("heading4", { text: el.textContent ?? "" });
    else if (tag === "FIGURE") {
      const img = el.querySelector("img");
      if (img) {
        const w = Number(img.getAttribute("width"));
        push("image", {
          url: img.getAttribute("src") ?? "",
          alt: img.getAttribute("alt") ?? "",
          ...(Number.isFinite(w) && w > 0 ? { width: w } : {}),
        });
      }
    } else if (tag === "IMG") {
      const w = Number(el.getAttribute("width"));
      push("image", {
        url: el.getAttribute("src") ?? "",
        alt: el.getAttribute("alt") ?? "",
        ...(Number.isFinite(w) && w > 0 ? { width: w } : {}),
      });
    } else if (tag === "TABLE") {
      const rows: string[][] = [];
      el.querySelectorAll("tr").forEach((tr) => {
        const cells: string[] = [];
        tr.querySelectorAll("th,td").forEach((c) => cells.push(c.textContent ?? ""));
        rows.push(cells);
      });
      const headerRow = !!el.querySelector("thead th");
      push("table", { headerRow, rows: rows.length ? rows : [["", ""], ["", ""]] });
    } else if (tag === "BLOCKQUOTE") {
      const kind = (el.getAttribute("data-callout") || "info") as BlockType;
      const t: BlockType =
        kind === "alert" || kind === "warning" || kind === "info" ? kind : "info";
      const text = el.querySelector("span:last-of-type")?.textContent ?? el.textContent ?? "";
      push(t, { text });
    } else if (tag === "DIV" && /page-break/i.test(el.getAttribute("style") || "")) {
      push("pagebreak", {});
    } else if (tag === "UL" || tag === "OL" || tag === "P") {
      push("text", { html: el.outerHTML, align: "left", size: "normal" });
    } else {
      const text = el.textContent?.trim() ?? "";
      if (text) push("text", { html: `<p>${text}</p>`, align: "left", size: "normal" });
    }
  }
  return blocks;
}

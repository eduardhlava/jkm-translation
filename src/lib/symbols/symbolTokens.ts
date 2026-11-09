/**
 * Piktogramy z knihovny („symboly") – čisté pomocné funkce bez závislostí.
 * Zcela oddělené od 4 vestavěných piktogramů (`pictogram`, `[[pic:…]]`).
 *
 * Token pro Notion a buňky tabulek: `[[sym:code|w=20|pos=left]]`.
 * Parser je tolerantní (mezery, velká písmena, chybějící/neznámé parametry,
 * plnošířková svislá čára), protože text prochází překladem LLM. Co se
 * nenaparsuje, zůstane v textu jako viditelný text – nic se neztratí.
 */
export type SymbolPos = "left" | "right" | "center" | "top";
export interface SymbolRef { code: string; w: number; pos: SymbolPos }

export const DEFAULT_SYMBOL_WIDTH_MM = 20;
export const TEXT_SYMBOL_POSITIONS: SymbolPos[] = ["left", "right", "center"];
export const CELL_SYMBOL_POSITIONS: SymbolPos[] = ["left", "top", "center"];
export const MIN_SYMBOL_MM = 3;
export const MAX_SYMBOL_MM = 180;

export const mmToPt = (mm: number) => (mm * 72) / 25.4;

const TOKEN_RE = /\[\[\s*sym\s*:\s*([A-Za-z0-9_-]+)\s*((?:[|｜][^[\]]*)?)\]\]/gi;

const clampW = (n: number) => Math.min(MAX_SYMBOL_MM, Math.max(MIN_SYMBOL_MM, Math.round(n * 10) / 10));

function parseParams(raw: string, allowed: SymbolPos[]): { w: number; pos: SymbolPos } {
  let w = DEFAULT_SYMBOL_WIDTH_MM;
  let pos: SymbolPos = allowed[0];
  for (const part of raw.split(/[|｜]/)) {
    const m = /^\s*([a-z]+)\s*[=:]\s*(.*?)\s*$/i.exec(part);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].toLowerCase();
    if (key === "w") {
      const n = parseFloat(val.replace(",", "."));
      if (Number.isFinite(n) && n > 0) w = clampW(n);
    } else if (key === "pos" && (allowed as string[]).includes(val)) {
      pos = val as SymbolPos;
    }
  }
  return { w, pos };
}

export function normalizeSymbolRef(raw: any, allowed: SymbolPos[] = TEXT_SYMBOL_POSITIONS): SymbolRef | null {
  if (!raw || typeof raw !== "object") return null;
  const code = String(raw.code ?? "").trim().toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(code)) return null;
  const n = Number(raw.w);
  const w = Number.isFinite(n) && n > 0 ? clampW(n) : DEFAULT_SYMBOL_WIDTH_MM;
  const pos = (allowed as string[]).includes(raw.pos) ? (raw.pos as SymbolPos) : allowed[0];
  return { code, w, pos };
}

export function normalizeSymbolList(raw: any, allowed: SymbolPos[] = TEXT_SYMBOL_POSITIONS): SymbolRef[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => normalizeSymbolRef(r, allowed)).filter((r): r is SymbolRef => !!r);
}

export function formatSymbolToken(s: SymbolRef): string {
  return `[[sym:${s.code}|w=${s.w}|pos=${s.pos}]]`;
}

/** Odebere všechny tokeny z textu (kdekoli) a vrátí je v pořadí výskytu. */
export function extractSymbolTokens(text: string, allowed: SymbolPos[] = TEXT_SYMBOL_POSITIONS): { symbols: SymbolRef[]; text: string } {
  const symbols: SymbolRef[] = [];
  const src = text ?? "";
  const out = src.replace(TOKEN_RE, (_m, code: string, params: string) => {
    symbols.push({ code: code.toLowerCase(), ...parseParams(params ?? "", allowed) });
    return "";
  });
  return { symbols, text: symbols.length ? out.replace(/^\s+/, "") : src };
}

/** Obsah buňky (bez `[[pic:]]`): tokeny na začátku, pak text / `[[html]]…`. */
export function splitCellSymbols(text: string): { symbols: SymbolRef[]; rest: string } {
  const { symbols, text: rest } = extractSymbolTokens(text ?? "", CELL_SYMBOL_POSITIONS);
  return { symbols, rest };
}

export function buildCellSymbolText(symbols: SymbolRef[], rest: string): string {
  return symbols.map(formatSymbolToken).join("") + (rest ?? "");
}

/** Textový blok → HTML pro Notion: tokeny na začátek prvního odstavce. */
export function injectSymbolTokens(html: string, symbols: SymbolRef[] | undefined): string {
  if (!symbols?.length) return html;
  const tokens = symbols.map(formatSymbolToken).join(" ");
  const m = /^\s*<p\b[^>]*>/i.exec(html);
  if (m) return html.slice(0, m[0].length) + tokens + " " + html.slice(m[0].length);
  return `<p>${tokens}</p>${html}`;
}

/** Import: vytáhne tokeny z HTML textového bloku (tolerantně, kdekoli v textu). */
export function extractSymbolsFromHtml(html: string): { symbols: SymbolRef[]; html: string } {
  const { symbols, text } = extractSymbolTokens(html ?? "", TEXT_SYMBOL_POSITIONS);
  if (!symbols.length) return { symbols, html };
  const cleaned = text.replace(/(<p\b[^>]*>)\s+/gi, "$1").replace(/<p\b[^>]*>\s*<\/p>/gi, "");
  return { symbols, html: cleaned };
}

export function slugifySymbolName(name: string): string {
  return (name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "piktogram";
}

export function uniqueSymbolCode(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

/** Všechny kódy symbolů použité v blocích (texty i buňky tabulek). */
export function collectSymbolCodes(blocks: Array<{ type: string; content: any }>): Set<string> {
  const out = new Set<string>();
  const cells = (rows: any) => {
    if (!Array.isArray(rows)) return;
    for (const r of rows) if (Array.isArray(r)) for (const c of r) extractSymbolTokens(String(c ?? ""), CELL_SYMBOL_POSITIONS).symbols.forEach((s) => out.add(s.code));
  };
  for (const b of blocks) {
    if (b.type === "text") {
      normalizeSymbolList(b.content?.symbols).forEach((s) => out.add(s.code));
      inlineSymbolsOf(b.content?.html ?? "").forEach((s) => out.add(s.code));
    }
    if (b.type === "table") cells(b.content?.rows);
    if (b.type === "image-table") cells(b.content?.table?.rows);
  }
  return out;
}

// ---------- Inline piktogramy v HTML textového bloku ----------
// Uložená podoba: <img data-sym="code" data-w="20" data-pos="left" contenteditable="false" class="sym sym-left">
// Bez `src`/`style` – podepsané URL z privátního bucketu vyprší, doplní je editor.
const SYM_IMG_RE = /<img\b[^>]*\bdata-sym\s*=\s*["']?[^"'\s>]+[^>]*>/gi;
const attr = (tag: string, name: string) => new RegExp(`\\b${name}\\s*=\\s*["']?([^"'\\s>]+)`, "i").exec(tag)?.[1];

export function parseSymbolImgTag(tag: string): SymbolRef | null {
  return normalizeSymbolRef({ code: attr(tag, "data-sym"), w: attr(tag, "data-w"), pos: attr(tag, "data-pos") });
}

export function symbolImgHtml(s: SymbolRef): string {
  return `<img data-sym="${s.code}" data-w="${s.w}" data-pos="${s.pos}" contenteditable="false" class="sym sym-${s.pos}" alt="">`;
}

/** Normalizuje inline piktogramy (zahodí src/style apod.) – pro ukládání. */
export function cleanSymbolImgs(html: string): string {
  return (html ?? "").replace(SYM_IMG_RE, (t) => { const s = parseSymbolImgTag(t); return s ? symbolImgHtml(s) : ""; });
}

/** Notion/export: inline piktogram → token přesně na místě v textu. */
export function symbolImgsToTokens(html: string): string {
  return (html ?? "").replace(SYM_IMG_RE, (t) => { const s = parseSymbolImgTag(t); return s ? formatSymbolToken(s) : ""; });
}

/** Import: tokeny v textu → inline piktogramy (tolerantní parser; rozbité tokeny zůstanou textem). */
export function tokensToSymbolImgs(html: string): string {
  return (html ?? "").replace(TOKEN_RE, (_m, code: string, params: string) => symbolImgHtml({ code: code.toLowerCase(), ...parseParams(params ?? "", TEXT_SYMBOL_POSITIONS) }));
}

export function inlineSymbolsOf(html: string): SymbolRef[] {
  const out: SymbolRef[] = [];
  for (const t of (html ?? "").match(SYM_IMG_RE) ?? []) { const s = parseSymbolImgTag(t); if (s) out.push(s); }
  return out;
}

/** Odstraní inline piktogramy (prostý text, hledání). */
export function stripSymbolImgs(html: string): string { return (html ?? "").replace(SYM_IMG_RE, ""); }

/** Starý formát `content.symbols` → inline na začátek prvního odstavce. */
export function migrateTextContent<T extends { html?: string; symbols?: any }>(c: T): T {
  if (!c || !("symbols" in c)) return c;
  const list = normalizeSymbolList(c.symbols);
  const { symbols: _drop, ...rest } = c as any;
  let html: string = rest.html ?? "";
  if (list.length) {
    const imgs = list.map(symbolImgHtml).join("");
    const m = /^\s*<p\b[^>]*>/i.exec(html);
    html = m ? html.slice(0, m[0].length) + imgs + html.slice(m[0].length) : `<p>${imgs}</p>${html}`;
  }
  return { ...rest, html } as T;
}

export function migrateBlocksSymbols<B extends { type: string; content: any }>(blocks: B[]): B[] {
  return blocks.map((b) => (b.type === "text" && b.content && "symbols" in b.content ? { ...b, content: migrateTextContent(b.content) } : b));
}

import type { Block } from "@/components/BlockEditor/types";

// ---------- Half-width image + wrapped text (PDF) ----------
// react-pdf has no float. A half-width left/right image and the directly
// following text block are rendered as one unbreakable row (image column +
// side text column); the remaining text flows below at full width. The split is
// an estimate based on NotoSans average glyph width with a safety margin.

export const CONTENT_WIDTH_PT = 495; // A4 595pt − 2 × 50pt padding
export const WRAP_GAP_PT = 12;
export const HALF_COLUMN_PT = CONTENT_WIDTH_PT / 2;
export const SIDE_TEXT_WIDTH_PT = CONTENT_WIDTH_PT - HALF_COLUMN_PT - WRAP_GAP_PT;
const BASE_FONT = 10.5;
const LINE_HEIGHT = 1.5;
const AVG_CHAR_EM = 0.55; // conservative (NotoSans ≈ 0.5–0.53em)
const P_MARGIN = 6;
const LI_MARGIN = 2;
const LI_BULLET = 14;

export type ImageSize = "full" | "half";
export type ImagePosition = "left" | "right" | "center";

export function imageSizeOf(c: any): ImageSize {
  return c?.size === "half" ? "half" : "full";
}
export function imagePositionOf(c: any): ImagePosition {
  return c?.position === "right" || c?.position === "center" ? c.position : "left";
}

/** Image block that wraps the directly following text block. */
export function wrapsNextText(img: Block, next: Block | undefined): boolean {
  if (img.type !== "image" || !next || next.type !== "text") return false;
  if (!img.content?.url) return false;
  return imageSizeOf(img.content) === "half" && imagePositionOf(img.content) !== "center";
}

/** Natural pixel size from a PNG/JPEG data URL (images are inlined before render). */
export function imageDimensions(url: string | undefined): { w: number; h: number } | null {
  if (!url || !url.startsWith("data:")) return null;
  const comma = url.indexOf(",");
  if (comma < 0 || !url.slice(0, comma).includes("base64")) return null;
  let bin: string;
  try { bin = atob(url.slice(comma + 1, comma + 1 + 200000)); } catch { return null; }
  const b = (i: number) => bin.charCodeAt(i) & 0xff;
  if (b(0) === 0x89 && b(1) === 0x50) {
    const w = (b(16) << 24) | (b(17) << 16) | (b(18) << 8) | b(19);
    const h = (b(20) << 24) | (b(21) << 16) | (b(22) << 8) | b(23);
    return w > 0 && h > 0 ? { w, h } : null;
  }
  if (b(0) === 0xff && b(1) === 0xd8) {
    let i = 2;
    while (i + 9 < bin.length) {
      if (b(i) !== 0xff) { i++; continue; }
      const m = b(i + 1);
      const len = (b(i + 2) << 8) | b(i + 3);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        const h = (b(i + 5) << 8) | b(i + 6);
        const w = (b(i + 7) << 8) | b(i + 8);
        return w > 0 && h > 0 ? { w, h } : null;
      }
      i += 2 + len;
    }
  }
  return null;
}

function charsPerLine(widthPt: number, fontSize: number) {
  return Math.max(1, Math.floor(widthPt / (AVG_CHAR_EM * fontSize)));
}

function lineCount(text: string, cpl: number) {
  return text.split("\n").reduce((n, l) => n + Math.max(1, Math.ceil(l.length / cpl)), 0);
}

/** Estimated side height: image (width × ratio, capped) + margins + caption. */
export function sideImageHeight(url: string | undefined, caption: string | undefined, maxImageHeight: number) {
  const dim = imageDimensions(url);
  const ratio = dim ? dim.h / dim.w : 0.75;
  const imgW = HALF_COLUMN_PT * 0.98;
  const imgH = Math.min(imgW * ratio, maxImageHeight);
  const capLines = caption ? lineCount(caption, charsPerLine(HALF_COLUMN_PT, 9)) : 0;
  return imgH + 20 + 2 + capLines * 9 * 1.2;
}

function fontSizeOf(el: Element | null): number {
  const raw = el?.getAttribute("style") ?? "";
  const m = raw.match(/font-size\s*:\s*([\d.]+)(em|rem|px|%)/i);
  if (!m) return BASE_FONT;
  const n = parseFloat(m[1]);
  const u = m[2].toLowerCase();
  if (u === "px") return n * 0.75;
  if (u === "%") return 11 * n / 100;
  return 11 * n;
}

// Text with <br> counted as "\n" in document order.
function flatText(node: Node): string {
  let s = "";
  node.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) s += n.textContent ?? "";
    else if (n.nodeType === Node.ELEMENT_NODE) s += (n as Element).tagName === "BR" ? "\n" : flatText(n);
  });
  return s;
}

/** Keep head [0, cut) or tail [cut, end) of the flat text, preserving inline markup. */
function slicePreserving(root: Element, cut: number, keepHead: boolean): Element {
  const clone = root.cloneNode(true) as Element;
  let off = 0;
  const visit = (node: Node) => {
    Array.from(node.childNodes).forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) {
        const t = n.textContent ?? "";
        const start = off, end = off + t.length;
        off = end;
        if (keepHead) n.textContent = end <= cut ? t : start >= cut ? "" : t.slice(0, cut - start);
        else n.textContent = start >= cut ? t : end <= cut ? "" : t.slice(cut - start);
      } else if (n.nodeType === Node.ELEMENT_NODE) {
        if ((n as Element).tagName === "BR") {
          const pos = off; off += 1;
          if (keepHead ? pos >= cut : pos < cut) n.parentNode?.removeChild(n);
        } else visit(n);
      }
    });
  };
  visit(clone);
  return clone;
}

/** Index in flat text where `lines` lines end, at a word boundary (or -1). */
function cutIndex(text: string, lines: number, cpl: number): number {
  let idx = 0;
  let left = lines;
  const hard = text.split("\n");
  for (let i = 0; i < hard.length; i++) {
    const l = hard[i];
    const need = Math.max(1, Math.ceil(l.length / cpl));
    if (need <= left) { left -= need; idx += l.length + 1; continue; }
    if (left <= 0) return idx > 0 ? idx - 1 : -1;
    const limit = idx + left * cpl;
    const ws = text.lastIndexOf(" ", limit);
    return ws > idx ? ws : idx > 0 ? idx - 1 : -1;
  }
  return -1;
}

type Unit =
  | { kind: "p"; el: Element }
  | { kind: "li"; el: Element; list: Element; n: number };

function toUnits(html: string): Unit[] {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstChild as Element | null;
  const units: Unit[] = [];
  if (!root) return units;
  let buf: Element | null = null;
  const flush = () => { if (buf && flatText(buf).trim()) units.push({ kind: "p", el: buf }); buf = null; };
  Array.from(root.childNodes).forEach((n) => {
    const tag = n.nodeType === Node.ELEMENT_NODE ? (n as Element).tagName : "";
    if (tag === "UL" || tag === "OL") {
      flush();
      const start = parseInt((n as Element).getAttribute("start") ?? "1", 10) || 1;
      Array.from((n as Element).children).filter((c) => c.tagName === "LI")
        .forEach((li, i) => units.push({ kind: "li", el: li, list: n as Element, n: start + i }));
    } else if (tag === "P" || tag === "DIV") {
      flush();
      if (flatText(n).trim()) units.push({ kind: "p", el: n as Element });
    } else if (n.nodeType === Node.TEXT_NODE || n.nodeType === Node.ELEMENT_NODE) {
      if (!buf) buf = doc.createElement("p");
      buf.appendChild(n.cloneNode(true));
    }
  });
  flush();
  return units;
}

function unitsToHtml(units: Unit[]): string {
  let out = "";
  let i = 0;
  while (i < units.length) {
    const u = units[i];
    if (u.kind === "p") { out += u.el.outerHTML; i++; continue; }
    const list = u.list;
    const tag = list.tagName.toLowerCase();
    let items = "";
    const first = u.n;
    while (i < units.length && units[i].kind === "li" && (units[i] as any).list === list) {
      items += units[i].el.outerHTML; i++;
    }
    out += `<${tag}${tag === "ol" && first !== 1 ? ` start="${first}"` : ""}>${items}</${tag}>`;
  }
  return out;
}

/**
 * Split text block HTML into the part beside the image and the rest below it.
 * Every character ends up in exactly one part.
 */
export function splitTextForWrap(html: string, availHeightPt: number, widthPt = SIDE_TEXT_WIDTH_PT): { side: string; rest: string } {
  const units = toUnits(html);
  const side: Unit[] = [];
  const rest: Unit[] = [];
  let used = 0;
  // Safety reserve: one line, so the side column never noticeably exceeds the image.
  const avail = availHeightPt - BASE_FONT * LINE_HEIGHT;
  let full = false;
  for (const u of units) {
    if (full) { rest.push(u); continue; }
    const fs = fontSizeOf(u.el);
    const lh = fs * LINE_HEIGHT;
    const w = u.kind === "li" ? widthPt - LI_BULLET : widthPt;
    const cpl = charsPerLine(w, fs);
    const text = flatText(u.el);
    const h = lineCount(text, cpl) * lh + (u.kind === "li" ? LI_MARGIN : P_MARGIN);
    if (used + h <= avail) { side.push(u); used += h; continue; }
    full = true;
    const fitLines = Math.floor((avail - used - (u.kind === "li" ? LI_MARGIN : P_MARGIN)) / lh);
    const cut = u.kind === "p" && fitLines >= 1 ? cutIndex(text, fitLines, cpl) : -1;
    if (cut > 0 && cut < text.length) {
      side.push({ ...u, el: slicePreserving(u.el, cut, true) });
      rest.push({ ...u, el: slicePreserving(u.el, cut + 1, false) }); // skip the space/newline at cut
    } else rest.push(u);
  }
  return { side: unitsToHtml(side), rest: unitsToHtml(rest) };
}

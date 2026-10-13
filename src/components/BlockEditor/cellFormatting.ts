import { buildCellValue, CELL_PICTOGRAM_GLYPHS, parseCellPictogram } from "./types";

// Explicit discriminator keeps legacy plain cells (including literal < >) intact.
const HTML_PREFIX = "[[html]]";
const escapeText = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function sanitizeCellHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeText(node.textContent ?? "");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (["script", "style", "iframe", "object"].includes(tag)) return "";
    if (tag === "br") return "<br>";
    let inner = Array.from(el.childNodes).map(walk).join("");
    const style = el.style;
    const bold = /^(bold|[6-9]00)$/.test(style.fontWeight);
    if (bold && !["b", "strong"].includes(tag)) inner = `<strong>${inner}</strong>`;
    if (style.fontStyle === "italic" && !["i", "em"].includes(tag)) inner = `<em>${inner}</em>`;
    if (style.textDecoration.includes("underline") && tag !== "u") inner = `<u>${inner}</u>`;
    if (["b", "strong", "i", "em", "u", "sup", "sub"].includes(tag)) return `<${tag}>${inner}</${tag}>`;
    if (["p", "div"].includes(tag) && el.parentElement !== doc.body) return `${el.previousSibling ? "<br>" : ""}${inner}`;
    return inner;
  };
  return Array.from(doc.body.firstElementChild?.childNodes ?? []).map(walk).join("");
}

export function cellTextToHtml(value: string): string {
  return value.startsWith(HTML_PREFIX)
    ? sanitizeCellHtml(value.slice(HTML_PREFIX.length))
    : escapeText(value).replace(/\r?\n/g, "<br>");
}

export function cellHtmlToValue(html: string): string {
  const safe = sanitizeCellHtml(html);
  if (/<(?:b|strong|i|em|u|sup|sub)\b/i.test(safe)) return HTML_PREFIX + safe;
  const doc = new DOMParser().parseFromString(safe.replace(/<br\s*\/?\s*>/gi, "\n"), "text/html");
  return doc.body.textContent ?? "";
}

export function cellPlainText(value: string): string {
  const { text } = parseCellPictogram(value);
  const doc = new DOMParser().parseFromString(cellTextToHtml(text).replace(/<br\s*\/?\s*>/gi, "\n"), "text/html");
  return doc.body.textContent ?? "";
}

export function cellToExportHtml(value: string): string {
  const { pictogram, text } = parseCellPictogram(value);
  const prefix = pictogram === "none" ? "" : `${CELL_PICTOGRAM_GLYPHS[pictogram]} `;
  return prefix + cellTextToHtml(text);
}

export function cellFromExportHtml(html: string): string {
  const safe = sanitizeCellHtml(html).replace(/\n/g, "<br>");
  for (const [kind, glyph] of Object.entries(CELL_PICTOGRAM_GLYPHS)) {
    if (safe.startsWith(glyph)) {
      const pic = kind as keyof typeof CELL_PICTOGRAM_GLYPHS;
      return buildCellValue(pic, cellHtmlToValue(safe.slice(glyph.length).replace(/^\uFE0F?\s*/, "")));
    }
  }
  return cellHtmlToValue(safe);
}
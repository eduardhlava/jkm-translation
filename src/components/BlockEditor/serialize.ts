import type { Block } from "./types";

function escapeHtml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Sanitize allowed inline HTML for Text block (strong/em/a only)
function sanitizeInline(html: string): string {
  if (!html) return "";
  // Quick allow-list pass via DOMParser when available
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
    const root = doc.body.firstChild as HTMLElement | null;
    if (!root) return "";
    const allowed = new Set(["B", "STRONG", "I", "EM", "A", "BR", "P", "SPAN"]);
    const walk = (el: Element): string => {
      let out = "";
      el.childNodes.forEach((n) => {
        if (n.nodeType === Node.TEXT_NODE) {
          out += escapeHtml(n.textContent ?? "");
        } else if (n.nodeType === Node.ELEMENT_NODE) {
          const e = n as Element;
          const tag = e.tagName.toUpperCase();
          if (!allowed.has(tag)) {
            out += walk(e);
            return;
          }
          if (tag === "BR") { out += "<br/>"; return; }
          if (tag === "A") {
            const href = (e as HTMLAnchorElement).getAttribute("href") ?? "#";
            out += `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${walk(e)}</a>`;
            return;
          }
          if (tag === "B" || tag === "STRONG") { out += `<strong>${walk(e)}</strong>`; return; }
          if (tag === "I" || tag === "EM") { out += `<em>${walk(e)}</em>`; return; }
          if (tag === "P") { out += `<p>${walk(e)}</p>`; return; }
          out += walk(e);
        }
      });
      return out;
    };
    return walk(root);
  }
  return escapeHtml(html);
}

export function blockToHtml(b: Block): string {
  switch (b.type) {
    case "heading1": return `<h1>${escapeHtml(b.content.text)}</h1>`;
    case "heading2": return `<h2>${escapeHtml(b.content.text)}</h2>`;
    case "heading3": return `<h3>${escapeHtml(b.content.text)}</h3>`;
    case "heading4": return `<h4>${escapeHtml(b.content.text)}</h4>`;
    case "text": {
      const inner = sanitizeInline(b.content.html ?? "");
      return inner.includes("<p>") ? inner : `<p>${inner}</p>`;
    }
    case "image": {
      const url = escapeHtml(b.content.url ?? "");
      const alt = escapeHtml(b.content.alt ?? "");
      if (!url) return "";
      const w = b.content.width ? ` width="${b.content.width}"` : "";
      return `<p><img src="${url}" alt="${alt}"${w} /></p>`;
    }
    case "table": {
      const rows: string[][] = b.content.rows ?? [];
      if (rows.length === 0) return "";
      const head = b.content.headerRow && rows[0]
        ? `<thead><tr>${rows[0].map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>`
        : "";
      const bodyRows = b.content.headerRow ? rows.slice(1) : rows;
      const body = `<tbody>${bodyRows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
      return `<table>${head}${body}</table>`;
    }
    case "alert":
      return `<blockquote data-callout="alert">⚠️ ${escapeHtml(b.content.text)}</blockquote>`;
    case "info":
      return `<blockquote data-callout="info">ℹ️ ${escapeHtml(b.content.text)}</blockquote>`;
    case "warning":
      return `<blockquote data-callout="warning">❗ ${escapeHtml(b.content.text)}</blockquote>`;
  }
}

export function blocksToHtml(blocks: Block[]): string {
  return [...blocks]
    .sort((a, b) => a.order - b.order)
    .map(blockToHtml)
    .filter(Boolean)
    .join("\n");
}

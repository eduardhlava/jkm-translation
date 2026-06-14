import type { Block } from "./types";

function escapeHtml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Sanitize allowed HTML for Text block (inline + lists)
function sanitizeInline(html: string): string {
  if (!html) return "";
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
    const root = doc.body.firstChild as HTMLElement | null;
    if (!root) return "";
    const allowed = new Set(["B", "STRONG", "I", "EM", "A", "BR", "P", "SPAN", "UL", "OL", "LI"]);
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
          if (tag === "UL") { out += `<ul>${walk(e)}</ul>`; return; }
          if (tag === "OL") { out += `<ol>${walk(e)}</ol>`; return; }
          if (tag === "LI") { out += `<li>${walk(e)}</li>`; return; }
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
      const body = /<(p|ul|ol)\b/i.test(inner) ? inner : `<p>${inner}</p>`;
      const align = b.content.align === "center" || b.content.align === "right" ? b.content.align : "left";
      const sizeMap: Record<string, string> = { small: "0.875rem", normal: "1rem", large: "1.25rem" };
      const fs = sizeMap[b.content.size] ?? sizeMap.normal;
      return `<div style="text-align:${align};font-size:${fs};">${body}</div>`;
    }
    case "pagebreak":
      return `<div style="page-break-before:always;break-before:page;"></div>`;
    case "image": {
      const url = escapeHtml(b.content.url ?? "");
      const alt = escapeHtml(b.content.alt ?? "");
      if (!url) return "";
      const w = b.content.width ? ` width="${b.content.width}"` : "";
      return `<figure><img src="${url}" alt="${alt}"${w} />${alt ? `<figcaption>${alt}</figcaption>` : ""}</figure>`;
    }
    case "table": {
      const rows: string[][] = b.content.rows ?? [];
      if (rows.length === 0) return "";
      const cellStyle = `style="border:1px solid #d1d5db;padding:6px 8px;text-align:left;"`;
      const thStyle = `style="border:1px solid #d1d5db;padding:6px 8px;text-align:left;background-color:#f3f4f6;font-weight:600;"`;
      const head = b.content.headerRow && rows[0]
        ? `<thead><tr>${rows[0].map((c) => `<th ${thStyle}>${escapeHtml(c)}</th>`).join("")}</tr></thead>`
        : "";
      const bodyRows = b.content.headerRow ? rows.slice(1) : rows;
      const body = `<tbody>${bodyRows.map((r) => `<tr>${r.map((c) => `<td ${cellStyle}>${escapeHtml(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
      return `<table style="width:100%;border-collapse:collapse;border:1px solid #d1d5db;">${head}${body}</table>`;
    }
    case "alert":
    case "info":
    case "warning": {
      const cfg = {
        alert:   { icon: "⚠️", border: "#dc2626", bg: "#fef2f2" },
        info:    { icon: "ℹ️", border: "#2563eb", bg: "#eff6ff" },
        warning: { icon: "❗", border: "#d97706", bg: "#fffbeb" },
      }[b.type];
      const wrap = `style="display:flex;align-items:flex-start;gap:12px;border:1px solid ${cfg.border};background-color:${cfg.bg};border-left:4px solid ${cfg.border};border-radius:6px;padding:12px 14px;margin:8px 0;"`;
      const iconS = `style="font-size:28px;line-height:1;flex-shrink:0;"`;
      const textS = `style="flex:1;line-height:1.5;"`;
      return `<blockquote data-callout="${b.type}" ${wrap}><span ${iconS}>${cfg.icon}</span><span ${textS}>${escapeHtml(b.content.text)}</span></blockquote>`;
    }
  }
}

export function blocksToHtml(blocks: Block[]): string {
  return [...blocks]
    .sort((a, b) => a.order - b.order)
    .map(blockToHtml)
    .filter(Boolean)
    .join("\n");
}

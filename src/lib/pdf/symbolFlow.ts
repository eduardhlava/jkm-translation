import { parseSymbolImgTag, type SymbolRef } from "@/lib/symbols/symbolTokens";

/**
 * Rozdělí HTML textového bloku podle inline piktogramů (img[data-sym]) pro PDF,
 * kde react-pdf nemá float:
 * - text  → běžný text plnou šířkou,
 * - center → piktogram na samostatném řádku uprostřed,
 * - float → piktogramy vlevo/vpravo + text od místa piktogramu dál (do dalšího
 *   piktogramu), který se vykreslí vedle a zbytek pod něj.
 * Každý znak textu skončí právě v jednom segmentu, piktogramy se z textu odstraní.
 */
export type FlowSegment =
  | { kind: "text"; html: string }
  | { kind: "center"; sym: SymbolRef }
  | { kind: "float"; left: SymbolRef[]; right: SymbolRef[]; html: string };

const hasText = (html: string) => {
  const d = document.createElement("div");
  d.innerHTML = html;
  return (d.textContent ?? "").replace(/\u00a0/g, " ").trim().length > 0;
};

export function splitHtmlAtSymbols(html: string): FlowSegment[] {
  const doc = new DOMParser().parseFromString(`<div>${html ?? ""}</div>`, "text/html");
  const root = doc.body.firstChild as Element | null;
  if (!root) return [];
  // Volný obsah zabalíme do <p>, aby každý top-level uzel byl element.
  let loose: Element | null = null;
  Array.from(root.childNodes).forEach((n) => {
    const isBlock = n.nodeType === 1 && /^(P|DIV|UL|OL|H[1-6]|BLOCKQUOTE)$/.test((n as Element).tagName);
    if (isBlock) { loose = null; return; }
    if (!loose) { loose = doc.createElement("p"); root.insertBefore(loose, n); }
    loose.appendChild(n);
  });

  type Ev = { kind: "html"; html: string } | { kind: "sym"; sym: SymbolRef };
  const evs: Ev[] = [];
  Array.from(root.children).forEach((el) => {
    const imgs = Array.from(el.querySelectorAll("img[data-sym]"));
    if (!imgs.length) { evs.push({ kind: "html", html: el.outerHTML }); return; }
    // Na střed dělí odstavec; vlevo/vpravo plave od začátku svého (pod)odstavce,
    // takže text odstavce zůstane pohromadě vedle piktogramu.
    const centers = imgs.filter((i) => parseSymbolImgTag(i.outerHTML)?.pos === "center");
    let prev: Node | null = null;
    const piece = (endBefore: Node | null) => {
      const r = doc.createRange();
      if (prev) r.setStartAfter(prev); else r.setStart(el, 0);
      if (endBefore) r.setEndBefore(endBefore); else r.setEnd(el, el.childNodes.length);
      const shell = el.cloneNode(false) as Element;
      shell.appendChild(r.cloneContents());
      shell.querySelectorAll("img[data-sym]").forEach((x) => {
        const s = parseSymbolImgTag(x.outerHTML);
        if (s) evs.push({ kind: "sym", sym: s });
        x.remove();
      });
      evs.push({ kind: "html", html: shell.outerHTML });
    };
    for (const img of centers) {
      piece(img);
      const s = parseSymbolImgTag(img.outerHTML);
      if (s) evs.push({ kind: "sym", sym: s });
      prev = img;
    }
    piece(null);
  });

  const out: FlowSegment[] = [];
  let cur: FlowSegment | null = null;
  const push = (h: string) => {
    if (!hasText(h)) return;
    if (cur && cur.kind === "float") { cur.html += h; return; }
    const last = out[out.length - 1];
    if (last?.kind === "text") last.html += h; else out.push({ kind: "text", html: h });
  };
  for (const e of evs) {
    if (e.kind === "html") { push(e.html); continue; }
    const s = e.sym;
    if (s.pos === "center") { cur = null; out.push({ kind: "center", sym: s }); continue; }
    // Navazující piktogramy bez textu mezi nimi tvoří jeden sloupec.
    if (cur && cur.kind === "float" && !cur.html) { (s.pos === "right" ? cur.right : cur.left).push(s); continue; }
    cur = { kind: "float", left: s.pos === "right" ? [] : [s], right: s.pos === "right" ? [s] : [], html: "" };
    out.push(cur);
  }
  return out;
}

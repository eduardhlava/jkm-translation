// Notion content management for "Obsah" database.
// Actions: list | get | save

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NOTION_VERSION = "2022-06-28";
// "Obsah" database ID extracted from the user-supplied URL
const CONTENT_DB_ID = "5476ad70bdfb42eb905fe74db97627ae";
const SAVE_DELETE_BATCH_SIZE = 36;
const SAVE_APPEND_BATCH_SIZE = 50;

function readPropText(prop: any): string {
  if (!prop) return "";
  switch (prop.type) {
    case "title":
      return (prop.title ?? []).map((t: any) => t.plain_text ?? "").join("");
    case "rich_text":
      return (prop.rich_text ?? []).map((t: any) => t.plain_text ?? "").join("");
    case "select":
      return prop.select?.name ?? "";
    case "status":
      return prop.status?.name ?? "";
    case "multi_select":
      return (prop.multi_select ?? []).map((s: any) => s.name).join(", ");
    case "number":
      return prop.number?.toString() ?? "";
    case "url":
      return prop.url ?? "";
    default:
      return "";
  }
}

// ---------- Notion blocks -> HTML ----------
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function richToHtml(rich: any[]): string {
  if (!rich) return "";
  return rich
    .map((r: any) => {
      let txt = escapeHtml(r.plain_text ?? "");
      const a = r.annotations ?? {};
      if (a.code) txt = `<code>${txt}</code>`;
      if (a.bold) txt = `<strong>${txt}</strong>`;
      if (a.italic) txt = `<em>${txt}</em>`;
      if (a.underline) txt = `<u>${txt}</u>`;
      if (a.strikethrough) txt = `<s>${txt}</s>`;
      if (r.href) txt = `<a href="${escapeHtml(r.href)}" target="_blank" rel="noopener">${txt}</a>`;
      return txt;
    })
    .join("");
}

async function fetchBlockChildren(blockId: string, apiKey: string): Promise<any[]> {
  const all: any[] = [];
  let cursor: string | undefined = undefined;
  do {
    const url = new URL(`https://api.notion.com/v1/blocks/${blockId}/children`);
    url.searchParams.set("page_size", "100");
    if (cursor) url.searchParams.set("start_cursor", cursor);
    const res = await notionFetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Notion-Version": NOTION_VERSION,
      },
    }, "blocks fetch");
    const data = await res.json();
    all.push(...(data.results ?? []).filter((b: any) => !b.archived && !b.in_trash));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return all;
}

async function fetchBlockChildrenPage(blockId: string, apiKey: string, pageSize = 100): Promise<any[]> {
  const url = new URL(`https://api.notion.com/v1/blocks/${blockId}/children`);
  url.searchParams.set("page_size", String(pageSize));
  const res = await notionFetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": NOTION_VERSION,
    },
  }, "blocks page fetch");
  const data = await res.json();
  return (data.results ?? []).filter((b: any) => !b.archived && !b.in_trash);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function notionFetch(url: string, init: RequestInit, context: string): Promise<Response> {
  let lastError = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      const text = await res.text();
      lastError = `Notion ${context} failed [${res.status}]: ${text}`;
      if (![429, 500, 502, 503, 504].includes(res.status)) throw new Error(lastError);
      const retryAfter = Number(res.headers.get("retry-after"));
      await wait(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(8000, 600 * 2 ** attempt));
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      if (attempt === 5) break;
      await wait(Math.min(8000, 600 * 2 ** attempt));
    }
  }
  throw new Error(lastError || `Notion ${context} failed`);
}

async function notionWrite(url: string, init: RequestInit, context: string): Promise<Response> {
  const res = await notionFetch(url, init, context);
  await wait(280); // Respect Notion's write rate limit while keeping large saves under the edge limit.
  return res;
}

async function deleteBlock(blockId: string, apiKey: string): Promise<void> {
  try {
    await notionWrite(`https://api.notion.com/v1/blocks/${blockId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}`, "Notion-Version": NOTION_VERSION },
    }, `delete block ${blockId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("archived")) return;
    throw error;
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function blocksToHtml(blocks: any[], apiKey: string): Promise<string> {
  const out: string[] = [];
  const tables = blocks.filter((b) => b.type === "table");
  const tableRows = new Map<string, any[]>();
  const fetchedTableRows = await mapWithConcurrency(tables, 6, (b) => fetchBlockChildren(b.id, apiKey));
  tables.forEach((b, i) => tableRows.set(b.id, fetchedTableRows[i] ?? []));
  let listBuffer: { type: "ul" | "ol"; items: string[] } | null = null;
  const flushList = () => {
    if (listBuffer) {
      out.push(`<${listBuffer.type}>${listBuffer.items.map((i) => `<li>${i}</li>`).join("")}</${listBuffer.type}>`);
      listBuffer = null;
    }
  };
  for (const b of blocks) {
    const t = b.type;
    if (t === "bulleted_list_item" || t === "numbered_list_item") {
      const wantType = t === "bulleted_list_item" ? "ul" : "ol";
      if (!listBuffer || listBuffer.type !== wantType) {
        flushList();
        listBuffer = { type: wantType, items: [] };
      }
      listBuffer.items.push(richToHtml(b[t].rich_text));
      continue;
    }
    flushList();
    switch (t) {
      case "heading_1":
        out.push(`<h1>${richToHtml(b.heading_1.rich_text)}</h1>`);
        break;
      case "heading_2":
        out.push(`<h2>${richToHtml(b.heading_2.rich_text)}</h2>`);
        break;
      case "heading_3":
        out.push(`<h3>${richToHtml(b.heading_3.rich_text)}</h3>`);
        break;
      case "paragraph": {
        const html = richToHtml(b.paragraph.rich_text);
        out.push(`<p>${html || "<br>"}</p>`);
        break;
      }
      case "quote":
        out.push(`<blockquote><p>${richToHtml(b.quote.rich_text)}</p></blockquote>`);
        break;
      case "divider":
        out.push(`<hr>`);
        break;
      case "code":
        out.push(`<pre><code>${escapeHtml((b.code.rich_text ?? []).map((r: any) => r.plain_text).join(""))}</code></pre>`);
        break;
      case "image": {
        const src = b.image.type === "external" ? b.image.external.url : b.image.file.url;
        const caption = richToHtml(b.image.caption ?? []);
        out.push(`<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(caption.replace(/<[^>]+>/g, ""))}" />${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`);
        break;
      }
      case "table": {
        const rows = tableRows.get(b.id) ?? [];
        const hasHeader = b.table.has_column_header;
        const rowsHtml = rows
          .map((r: any, idx: number) => {
            if (r.type !== "table_row") return "";
            const cells = (r.table_row.cells ?? []).map((c: any) => richToHtml(c)).map((html: string) =>
              hasHeader && idx === 0 ? `<th>${html}</th>` : `<td>${html}</td>`,
            );
            return `<tr>${cells.join("")}</tr>`;
          })
          .join("");
        out.push(`<table>${rowsHtml}</table>`);
        break;
      }
      default:
        // unsupported block types are dropped silently
        break;
    }
  }
  flushList();
  return out.join("\n");
}

// ---------- HTML -> Notion blocks (basic, regex-based to avoid DOM dep) ----------
function textToRich(text: string): any[] {
  if (!text) return [];
  const MAX = 2000; // Notion per-segment limit
  const out: any[] = [];
  for (let i = 0; i < text.length; i += MAX) {
    out.push({ type: "text", text: { content: text.slice(i, i + MAX) } });
  }
  return out;
}

function richPlain(rich: any[] = []): string {
  return rich.map((r: any) => r.plain_text ?? r.text?.content ?? "").join("");
}

function getAttr(attrs: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const m = re.exec(attrs);
  return m ? (m[1] ?? m[2] ?? m[3] ?? null) : null;
}

function isNotionExternalImageUrl(src: string): boolean {
  return /^https?:\/\//i.test(src);
}

// ---------- Image mirroring to Supabase Storage ----------
const IMAGE_BUCKET = "notion-images";

function isNotionHostedImage(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname;
    return (
      h.endsWith("amazonaws.com") ||
      h.endsWith("notion-static.com") ||
      h.endsWith("notion.so") ||
      h.endsWith("notion.site")
    );
  } catch {
    return false;
  }
}

function extFromContentType(ct: string | null): string {
  if (!ct) return "bin";
  const t = ct.toLowerCase();
  if (t.includes("jpeg") || t.includes("jpg")) return "jpg";
  if (t.includes("png")) return "png";
  if (t.includes("webp")) return "webp";
  if (t.includes("gif")) return "gif";
  if (t.includes("svg")) return "svg";
  return "bin";
}

async function sha1Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const mirrorCache = new Map<string, string>();

async function mirrorImageToStorage(url: string): Promise<string> {
  if (mirrorCache.has(url)) return mirrorCache.get(url)!;
  const SUPA_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPA_URL || !SERVICE_KEY) throw new Error("Supabase storage env not configured");

  // Normalize: strip query string for hashing so re-signed URLs map to same file
  const u = new URL(url);
  const normalized = `${u.origin}${u.pathname}`;
  const key = await sha1Hex(normalized);

  // Try to detect existing object first (HEAD)
  for (const ext of ["jpg", "png", "webp", "gif", "svg", "bin"]) {
    const path = `${key}.${ext}`;
    const publicUrl = `${SUPA_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${path}`;
    const head = await fetch(publicUrl, { method: "HEAD" });
    if (head.ok) {
      mirrorCache.set(url, publicUrl);
      return publicUrl;
    }
  }

  // Download original
  const dl = await fetch(url);
  if (!dl.ok) throw new Error(`Image download failed [${dl.status}]: ${url}`);
  const ct = dl.headers.get("content-type");
  const ext = extFromContentType(ct);
  const path = `${key}.${ext}`;
  const bytes = new Uint8Array(await dl.arrayBuffer());

  const upRes = await fetch(`${SUPA_URL}/storage/v1/object/${IMAGE_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      "Content-Type": ct ?? "application/octet-stream",
      "x-upsert": "true",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body: bytes,
  });
  if (!upRes.ok && upRes.status !== 409) {
    throw new Error(`Image upload failed [${upRes.status}]: ${await upRes.text()}`);
  }
  const publicUrl = `${SUPA_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${path}`;
  mirrorCache.set(url, publicUrl);
  return publicUrl;
}

async function mirrorBlockImages(blocks: any[]): Promise<void> {
  const targets: any[] = [];
  for (const b of blocks) {
    if (b?.type === "image" && b.image?.type === "external") {
      const src = b.image.external?.url;
      if (src && isNotionHostedImage(src)) targets.push(b);
    }
  }
  if (!targets.length) return;
  await mapWithConcurrency(targets, 4, async (b) => {
    try {
      const newUrl = await mirrorImageToStorage(b.image.external.url);
      b.image.external.url = newUrl;
    } catch (err) {
      console.error("mirror image failed, falling back to paragraph", err);
      const caption = (b.image.caption ?? []).map((r: any) => r.plain_text ?? r.text?.content ?? "").join("");
      const fallback = imageFallbackParagraph(b.image.external.url, caption || "[obrázek nelze uložit]");
      Object.assign(b, fallback);
      delete (b as any).image;
    }
  });
}

function imageFallbackParagraph(src: string, caption = ""): any {
  const text = caption || (src.startsWith("data:") ? "Obrázek vložený v editoru nelze uložit do Notion jako blok obrázku." : src);
  return {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: textToRich(text) },
  };
}

type TiptapNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, any>;
  content?: TiptapNode[];
};

function tiptapText(nodes: TiptapNode[] = []): string {
  return nodes
    .map((node) => {
      if (node.type === "text") return node.text ?? "";
      if (node.type === "hardBreak") return "\n";
      if (node.type === "image") return node.attrs?.alt || node.attrs?.title || "";
      return tiptapText(node.content ?? []);
    })
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

function imageBlockFromSrc(src: string | undefined, caption = ""): any | null {
  if (!src) return null;
  if (!isNotionExternalImageUrl(src)) return imageFallbackParagraph(src, caption);
  return {
    object: "block",
    type: "image",
    image: {
      type: "external",
      external: { url: src },
      caption: caption ? textToRich(caption) : [],
    },
  };
}

function listItemToBlocks(node: TiptapNode, itemType: "bulleted_list_item" | "numbered_list_item"): any[] {
  const out: any[] = [];
  const primaryText = (node.content ?? [])
    .filter((child) => child.type !== "bulletList" && child.type !== "orderedList")
    .map((child) => tiptapText(child.content ?? []))
    .filter(Boolean)
    .join("\n");

  out.push({
    object: "block",
    type: itemType,
    [itemType]: { rich_text: textToRich(primaryText) },
  });

  for (const child of node.content ?? []) {
    if (child.type === "bulletList" || child.type === "orderedList") out.push(...tiptapNodeToBlocks(child));
  }
  return out;
}

function tiptapNodeToBlocks(node: TiptapNode): any[] {
  const type = node.type;
  switch (type) {
    case "doc":
      return (node.content ?? []).flatMap(tiptapNodeToBlocks);
    case "heading": {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level ?? 1)));
      return [{ object: "block", type: `heading_${level}`, [`heading_${level}`]: { rich_text: textToRich(tiptapText(node.content)) } }];
    }
    case "paragraph":
      return [{ object: "block", type: "paragraph", paragraph: { rich_text: textToRich(tiptapText(node.content)) } }];
    case "blockquote":
      return [{ object: "block", type: "quote", quote: { rich_text: textToRich(tiptapText(node.content)) } }];
    case "codeBlock":
      return [{ object: "block", type: "code", code: { rich_text: textToRich(tiptapText(node.content)), language: "plain text" } }];
    case "horizontalRule":
      return [{ object: "block", type: "divider", divider: {} }];
    case "image": {
      const block = imageBlockFromSrc(node.attrs?.src, node.attrs?.alt || node.attrs?.title || "");
      return block ? [block] : [];
    }
    case "bulletList":
    case "orderedList": {
      const itemType = type === "bulletList" ? "bulleted_list_item" : "numbered_list_item";
      return (node.content ?? []).flatMap((child) => child.type === "listItem" ? listItemToBlocks(child, itemType) : tiptapNodeToBlocks(child));
    }
    case "table": {
      const rows = (node.content ?? []).filter((row) => row.type === "tableRow");
      if (!rows.length) return [];
      const matrix = rows.map((row) => (row.content ?? []).map((cell) => tiptapText(cell.content ?? [])));
      const width = Math.max(1, ...matrix.map((row) => row.length));
      return [{
        object: "block",
        type: "table",
        table: {
          table_width: width,
          has_column_header: rows[0]?.content?.some((cell) => cell.type === "tableHeader") ?? false,
          has_row_header: false,
          children: matrix.map((row) => ({
            object: "block",
            type: "table_row",
            table_row: { cells: Array.from({ length: width }, (_, i) => textToRich(row[i] ?? "")) },
          })),
        },
      }];
    }
    default:
      return (node.content ?? []).flatMap(tiptapNodeToBlocks);
  }
}

function tiptapDocToBlocks(doc: TiptapNode | null | undefined): any[] {
  if (!doc || typeof doc !== "object") return [];
  return tiptapNodeToBlocks(doc);
}

function decodeHtml(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Strip inline tags into plain text + simple annotations. For simplicity store as a single rich text run per block.
function stripTags(html: string): string {
  return decodeHtml(html
    .replace(/<br\s*\/?>(?!\n)/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim());
}

// Parse inline HTML into Notion rich_text with annotations (bold/italic/code/strike/underline + links)
type Annot = { bold?: boolean; italic?: boolean; underline?: boolean; strikethrough?: boolean; code?: boolean };
function pushRich(out: any[], text: string, ann: Annot, href: string | null) {
  if (!text) return;
  const MAX = 2000;
  for (let i = 0; i < text.length; i += MAX) {
    const slice = text.slice(i, i + MAX);
    const seg: any = { type: "text", text: { content: slice } };
    if (href) seg.text.link = { url: href };
    const annotations: any = {};
    if (ann.bold) annotations.bold = true;
    if (ann.italic) annotations.italic = true;
    if (ann.underline) annotations.underline = true;
    if (ann.strikethrough) annotations.strikethrough = true;
    if (ann.code) annotations.code = true;
    if (Object.keys(annotations).length) seg.annotations = annotations;
    if (href) seg.href = href;
    out.push(seg);
  }
}

function htmlToRich(html: string): any[] {
  if (!html) return [];
  const out: any[] = [];
  // Normalize <br> and <p> boundaries to newlines
  const src = html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p\s*>/gi, "\n").replace(/<p\b[^>]*>/gi, "");
  const tagRe = /<\/?([a-zA-Z0-9]+)\b([^>]*)>/g;
  const stack: { tag: string; ann: Annot; href: string | null }[] = [];
  const curAnn = (): Annot => {
    const a: Annot = {};
    for (const s of stack) {
      if (s.ann.bold) a.bold = true;
      if (s.ann.italic) a.italic = true;
      if (s.ann.underline) a.underline = true;
      if (s.ann.strikethrough) a.strikethrough = true;
      if (s.ann.code) a.code = true;
    }
    return a;
  };
  const curHref = (): string | null => {
    for (let i = stack.length - 1; i >= 0; i--) if (stack[i].href) return stack[i].href;
    return null;
  };
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(src)) !== null) {
    if (m.index > last) {
      pushRich(out, decodeHtml(src.slice(last, m.index)), curAnn(), curHref());
    }
    last = m.index + m[0].length;
    const tag = m[1].toLowerCase();
    const attrs = m[2] || "";
    const isClose = m[0].startsWith("</");
    if (isClose) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tag) { stack.splice(i, 1); break; }
      }
    } else {
      const ann: Annot = {};
      let href: string | null = null;
      if (tag === "b" || tag === "strong") ann.bold = true;
      else if (tag === "i" || tag === "em") ann.italic = true;
      else if (tag === "u") ann.underline = true;
      else if (tag === "s" || tag === "strike" || tag === "del") ann.strikethrough = true;
      else if (tag === "code") ann.code = true;
      else if (tag === "a") href = getAttr(attrs, "href");
      // self-closing or unknown tags ignored for stack
      const selfClose = /\/\s*>$/.test(m[0]) || tag === "img";
      if (!selfClose) stack.push({ tag, ann, href });
    }
  }
  if (last < src.length) {
    pushRich(out, decodeHtml(src.slice(last)), curAnn(), curHref());
  }
  return out;
}

function htmlToBlocks(html: string): any[] {
  const blocks: any[] = [];
  // Tokenize at top-level block tags
  const blockRe = /<(h1|h2|h3|p|ul|ol|blockquote|pre|hr|img|figure|table)\b([^>]*)>([\s\S]*?)<\/\1>|<(hr|img)\b([^>]*)\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) !== null) {
    const tag = (m[1] || m[4] || "").toLowerCase();
    const attrs = m[2] || m[5] || "";
    const inner = m[3] ?? "";
    switch (tag) {
      case "h1":
      case "h2":
      case "h3":
        blocks.push({
          object: "block",
          type: `heading_${tag[1]}`,
          [`heading_${tag[1]}`]: { rich_text: htmlToRich(inner) },
        });
        break;
      case "p":
        blocks.push({
          object: "block",
          type: "paragraph",
          paragraph: { rich_text: htmlToRich(inner) },
        });
        break;
      case "blockquote":
        blocks.push({
          object: "block",
          type: "quote",
          quote: { rich_text: htmlToRich(inner) },
        });
        break;
      case "pre":
        blocks.push({
          object: "block",
          type: "code",
          code: { rich_text: textToRich(stripTags(inner)), language: "plain text" },
        });
        break;
      case "hr":
        blocks.push({ object: "block", type: "divider", divider: {} });
        break;
      case "ul":
      case "ol": {
        const liRe = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
        let li: RegExpExecArray | null;
        const itemType = tag === "ul" ? "bulleted_list_item" : "numbered_list_item";
        while ((li = liRe.exec(inner)) !== null) {
          blocks.push({
            object: "block",
            type: itemType,
            [itemType]: { rich_text: htmlToRich(li[1]) },
          });
        }
        break;
      }
      case "img": {
        const src = getAttr(attrs, "src");
        const alt = getAttr(attrs, "alt") ?? "";
        if (src && isNotionExternalImageUrl(src)) {
          blocks.push({
            object: "block",
            type: "image",
            image: { type: "external", external: { url: src }, caption: alt ? textToRich(alt) : [] },
          });
        } else if (src) {
          blocks.push(imageFallbackParagraph(src, alt));
        }
        break;
      }
      case "figure": {
        const imgMatch = /<img\b([^>]*)>/i.exec(inner);
        const src = imgMatch ? getAttr(imgMatch[1], "src") : null;
        const alt = imgMatch ? getAttr(imgMatch[1], "alt") ?? "" : "";
        const capMatch = /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i.exec(inner);
        const caption = capMatch ? stripTags(capMatch[1]) : alt;
        if (src && isNotionExternalImageUrl(src)) {
          blocks.push({
            object: "block",
            type: "image",
            image: {
              type: "external",
              external: { url: src },
              caption: caption ? textToRich(caption) : [],
            },
          });
        } else if (src) {
          blocks.push(imageFallbackParagraph(src, caption));
        }
        break;
      }
      case "table": {
        const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
        const rows: string[][] = [];
        let rm: RegExpExecArray | null;
        while ((rm = rowRe.exec(inner)) !== null) {
          const cellRe = /<(t[hd])\b[^>]*>([\s\S]*?)<\/\1>/gi;
          const cells: string[] = [];
          let cm: RegExpExecArray | null;
          while ((cm = cellRe.exec(rm[1])) !== null) {
            cells.push(stripTags(cm[2]));
          }
          if (cells.length) rows.push(cells);
        }
        if (rows.length) {
          const width = Math.max(...rows.map((r) => r.length));
          blocks.push({
            object: "block",
            type: "table",
            table: {
              table_width: width,
              has_column_header: /<th\b/i.test(inner),
              has_row_header: false,
              children: rows.map((r) => ({
                object: "block",
                type: "table_row",
                table_row: {
                  cells: Array.from({ length: width }, (_, i) => textToRich(r[i] ?? "")),
                },
              })),
            },
          });
        }
        break;
      }
    }
  }
  return blocks;
}

function richSig(rich: any[] = []): string {
  return rich.map((r: any) => {
    const text = r.plain_text ?? r.text?.content ?? "";
    const a = r.annotations ?? {};
    const flags = [a.bold && "b", a.italic && "i", a.underline && "u", a.strikethrough && "s", a.code && "c"].filter(Boolean).join("");
    const href = r.href ?? r.text?.link?.url ?? "";
    return `${text}{${flags}${href ? `|${href}` : ""}}`;
  }).join("");
}

function blockPlain(block: any): string {
  const type = block.type;
  if (type === "table") {
    return `table:${(block.table.children ?? [])
      .map((row: any) => (row.table_row?.cells ?? []).map((cell: any) => richSig(cell)).join("|"))
      .join("/")}`;
  }
  const data = block[type] ?? {};
  return `${type}:${richSig(data.rich_text ?? data.caption ?? [])}`;
}

function blocksFingerprint(blocks: any[]): string {
  return blocks.map(blockPlain).join("\n").replace(/\s+/g, " ").trim();
}

async function notionBlocksFingerprint(blocks: any[], apiKey: string): Promise<string> {
  const tables = blocks.filter((b) => b.type === "table");
  const tableRows = new Map<string, any[]>();
  const fetchedRows = await mapWithConcurrency(tables, 6, (b) => fetchBlockChildren(b.id, apiKey));
  tables.forEach((b, i) => tableRows.set(b.id, fetchedRows[i] ?? []));

  return blocks
    .map((block) => {
      const type = block.type;
      if (type === "table") {
        return `table:${(tableRows.get(block.id) ?? [])
          .filter((row: any) => row.type === "table_row")
          .map((row: any) => (row.table_row?.cells ?? []).map((cell: any) => richSig(cell)).join("|"))
          .join("/")}`;
      }
      const data = block[type] ?? {};
      return `${type}:${richSig(data.rich_text ?? data.caption ?? [])}`;
    })
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- Handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const NOTION_API_KEY = Deno.env.get("NOTION_API_KEY");
    if (!NOTION_API_KEY) throw new Error("NOTION_API_KEY is not configured");

    const body = await req.json();
    const action = body.action as "list" | "get" | "save" | "schema";

    if (action === "schema") {
      const dbRes = await fetch(`https://api.notion.com/v1/databases/${CONTENT_DB_ID}`, {
        headers: { Authorization: `Bearer ${NOTION_API_KEY}`, "Notion-Version": NOTION_VERSION },
      });
      if (!dbRes.ok) throw new Error(`Notion DB read failed [${dbRes.status}]: ${await dbRes.text()}`);
      const db = await dbRes.json();
      const props: Record<string, { type: string; options?: string[] }> = {};
      for (const [name, meta] of Object.entries<any>(db.properties ?? {})) {
        const entry: any = { type: meta.type };
        if (meta.type === "select") entry.options = (meta.select?.options ?? []).map((o: any) => o.name);
        if (meta.type === "status") entry.options = (meta.status?.options ?? []).map((o: any) => o.name);
        if (meta.type === "multi_select") entry.options = (meta.multi_select?.options ?? []).map((o: any) => o.name);
        props[name] = entry;
      }
      return new Response(JSON.stringify({ properties: props }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      const filters: Array<{ property: string; type: string; value: string }> = body.filters ?? [];
      const pageSize: number = body.pageSize ?? 20;
      const startCursor: string | undefined = body.startCursor;
      const titleQuery: string | undefined = body.titleQuery;

      // Need property metadata for proper filter shape
      const dbRes = await fetch(`https://api.notion.com/v1/databases/${CONTENT_DB_ID}`, {
        headers: { Authorization: `Bearer ${NOTION_API_KEY}`, "Notion-Version": NOTION_VERSION },
      });
      if (!dbRes.ok) throw new Error(`Notion DB read failed [${dbRes.status}]: ${await dbRes.text()}`);
      const db = await dbRes.json();
      const propMeta = db.properties ?? {};
      const titleName = Object.entries<any>(propMeta).find(([, p]) => p.type === "title")?.[0];

      const andFilters: any[] = [];
      for (const f of filters) {
        if (!f.value) continue;
        const meta = propMeta[f.property];
        if (!meta) continue;
        if (meta.type === "select") andFilters.push({ property: f.property, select: { equals: f.value } });
        else if (meta.type === "status") andFilters.push({ property: f.property, status: { equals: f.value } });
        else if (meta.type === "multi_select") andFilters.push({ property: f.property, multi_select: { contains: f.value } });
        else if (meta.type === "rich_text") andFilters.push({ property: f.property, rich_text: { contains: f.value } });
      }
      if (titleQuery && titleName) {
        andFilters.push({ property: titleName, title: { contains: titleQuery } });
      }

      const queryBody: any = { page_size: pageSize };
      if (startCursor) queryBody.start_cursor = startCursor;
      if (andFilters.length === 1) queryBody.filter = andFilters[0];
      else if (andFilters.length > 1) queryBody.filter = { and: andFilters };

      const qRes = await fetch(`https://api.notion.com/v1/databases/${CONTENT_DB_ID}/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NOTION_API_KEY}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(queryBody),
      });
      if (!qRes.ok) throw new Error(`Notion query failed [${qRes.status}]: ${await qRes.text()}`);
      const data = await qRes.json();

      const items = (data.results ?? []).map((page: any) => {
        const props: Record<string, string> = {};
        for (const [name] of Object.entries(propMeta)) {
          props[name] = readPropText(page.properties?.[name]);
        }
        return { id: page.id, url: page.url, properties: props };
      });
      return new Response(
        JSON.stringify({ items, next_cursor: data.next_cursor, has_more: data.has_more }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "get") {
      const pageId: string = body.pageId;
      if (!pageId) throw new Error("pageId is required");
      const blocks = await fetchBlockChildren(pageId, NOTION_API_KEY);
      const html = await blocksToHtml(blocks, NOTION_API_KEY);
      return new Response(JSON.stringify({ html }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "checkTitle") {
      const title: string = (body.title ?? "").trim();
      if (!title) throw new Error("title is required");
      const dbRes = await fetch(`https://api.notion.com/v1/databases/${CONTENT_DB_ID}`, {
        headers: { Authorization: `Bearer ${NOTION_API_KEY}`, "Notion-Version": NOTION_VERSION },
      });
      if (!dbRes.ok) throw new Error(`Notion DB read failed [${dbRes.status}]: ${await dbRes.text()}`);
      const db = await dbRes.json();
      const titleName = Object.entries<any>(db.properties ?? {}).find(([, p]) => (p as any).type === "title")?.[0];
      if (!titleName) throw new Error("Title property not found");
      const qRes = await notionFetch(`https://api.notion.com/v1/databases/${CONTENT_DB_ID}/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NOTION_API_KEY}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ filter: { property: titleName, title: { equals: title } }, page_size: 10 }),
      }, "title lookup");
      const data = await qRes.json();
      const matches = (data.results ?? []).map((p: any) => ({ id: p.id, url: p.url }));
      return new Response(JSON.stringify({ matches }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "createPage") {
      const title: string = (body.title ?? "").trim();
      if (!title) throw new Error("title is required");
      const dbRes = await fetch(`https://api.notion.com/v1/databases/${CONTENT_DB_ID}`, {
        headers: { Authorization: `Bearer ${NOTION_API_KEY}`, "Notion-Version": NOTION_VERSION },
      });
      if (!dbRes.ok) throw new Error(`Notion DB read failed [${dbRes.status}]: ${await dbRes.text()}`);
      const db = await dbRes.json();
      const titleName = Object.entries<any>(db.properties ?? {}).find(([, p]) => (p as any).type === "title")?.[0];
      if (!titleName) throw new Error("Title property not found");
      const createRes = await notionWrite(`https://api.notion.com/v1/pages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NOTION_API_KEY}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parent: { database_id: CONTENT_DB_ID },
          properties: { [titleName]: { title: [{ type: "text", text: { content: title } }] } },
        }),
      }, "create page");
      const created = await createRes.json();
      return new Response(JSON.stringify({ id: created.id, url: created.url }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "updateTitle") {
      const pageId: string = body.pageId;
      const title: string = (body.title ?? "").trim();
      if (!pageId || !title) throw new Error("pageId and title are required");
      const pageRes = await notionFetch(`https://api.notion.com/v1/pages/${pageId}`, {
        headers: { Authorization: `Bearer ${NOTION_API_KEY}`, "Notion-Version": NOTION_VERSION },
      }, "fetch page");
      const page = await pageRes.json();
      const titleName = Object.entries<any>(page.properties ?? {}).find(([, p]) => (p as any).type === "title")?.[0];
      if (!titleName) throw new Error("Title property not found on page");
      await notionWrite(`https://api.notion.com/v1/pages/${pageId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${NOTION_API_KEY}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: { [titleName]: { title: [{ type: "text", text: { content: title } }] } },
        }),
      }, "update title");
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "save") {
      const pageId: string = body.pageId;
      const html: string = body.html ?? "";
      const doc = body.doc as TiptapNode | undefined;
      const phase = (body.phase ?? "delete") as "delete" | "append" | "verify";
      const cursor = Math.max(0, Number(body.cursor ?? 0) || 0);
      const after = typeof body.after === "string" ? body.after : undefined;
      if (!pageId) throw new Error("pageId is required");

      const newBlocks = doc ? tiptapDocToBlocks(doc) : htmlToBlocks(html);
      const expected = blocksFingerprint(newBlocks);

      if (phase === "delete") {
        const existing = await fetchBlockChildrenPage(pageId, NOTION_API_KEY, SAVE_DELETE_BATCH_SIZE);
        const deleteSlice = existing.slice(0, SAVE_DELETE_BATCH_SIZE);
        await mapWithConcurrency(deleteSlice, 3, (b) => deleteBlock(b.id, NOTION_API_KEY));
        const nextCursor = cursor + deleteSlice.length;
        const complete = existing.length < SAVE_DELETE_BATCH_SIZE;
        return new Response(JSON.stringify({
          ok: true,
          phase: complete ? "append" : "delete",
          cursor: complete ? 0 : nextCursor,
          total: existing.length,
          processed: nextCursor,
          count: newBlocks.length,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (phase === "append") {
        const batch = newBlocks.slice(cursor, cursor + SAVE_APPEND_BATCH_SIZE);
        let nextAfter = after;
        if (batch.length) {
          await mirrorBlockImages(batch);
          const requestBody: any = { children: batch };
          if (nextAfter) requestBody.after = nextAfter;
          const res = await notionWrite(`https://api.notion.com/v1/blocks/${pageId}/children`, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${NOTION_API_KEY}`,
              "Notion-Version": NOTION_VERSION,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          }, `append block slice ${cursor + 1}-${cursor + batch.length}/${newBlocks.length}`);
          const saved = await res.json();
          nextAfter = saved.results?.[saved.results.length - 1]?.id ?? nextAfter;
        }
        const nextCursor = cursor + batch.length;
        const complete = nextCursor >= newBlocks.length;
        return new Response(JSON.stringify({
          ok: true,
          phase: complete ? "verify" : "append",
          cursor: complete ? 0 : nextCursor,
          after: nextAfter,
          total: newBlocks.length,
          processed: nextCursor,
          count: newBlocks.length,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (phase === "verify") {
        try {
          const actual = await notionBlocksFingerprint(await fetchBlockChildren(pageId, NOTION_API_KEY), NOTION_API_KEY);
          if (actual !== expected) {
            console.warn("notion save verification mismatch (non-fatal)", { pageId, expectedLength: expected.length, actualLength: actual.length });
          } else {
            console.log("notion save completed and verified", { pageId, blocks: newBlocks.length });
          }
        } catch (err) {
          console.warn("notion save verification skipped due to error", err);
        }
        return new Response(JSON.stringify({ ok: true, phase: "done", count: newBlocks.length, async: false }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unknown save phase: ${phase}`);
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: unknown) {
    console.error("notion-content error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

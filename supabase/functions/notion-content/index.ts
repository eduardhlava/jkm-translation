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
    all.push(...(data.results ?? []));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return all;
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
          [`heading_${tag[1]}`]: { rich_text: textToRich(stripTags(inner)) },
        });
        break;
      case "p":
        blocks.push({
          object: "block",
          type: "paragraph",
          paragraph: { rich_text: textToRich(stripTags(inner)) },
        });
        break;
      case "blockquote":
        blocks.push({
          object: "block",
          type: "quote",
          quote: { rich_text: textToRich(stripTags(inner)) },
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
            [itemType]: { rich_text: textToRich(stripTags(li[1])) },
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

function blockPlain(block: any): string {
  const type = block.type;
  if (type === "table") {
    return `table:${(block.table.children ?? [])
      .map((row: any) => (row.table_row?.cells ?? []).map((cell: any) => richPlain(cell)).join("|"))
      .join("/")}`;
  }
  const data = block[type] ?? {};
  return `${type}:${richPlain(data.rich_text ?? data.caption ?? [])}`;
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
          .map((row: any) => (row.table_row?.cells ?? []).map((cell: any) => richPlain(cell)).join("|"))
          .join("/")}`;
      }
      const data = block[type] ?? {};
      return `${type}:${richPlain(data.rich_text ?? data.caption ?? [])}`;
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

    if (action === "save") {
      const pageId: string = body.pageId;
      const html: string = body.html ?? "";
      const doc = body.doc as TiptapNode | undefined;
      if (!pageId) throw new Error("pageId is required");

      const newBlocks = doc ? tiptapDocToBlocks(doc) : htmlToBlocks(html);

      const expected = blocksFingerprint(newBlocks);
      const existing = await fetchBlockChildren(pageId, NOTION_API_KEY);
      for (const b of existing) {
        await notionWrite(`https://api.notion.com/v1/blocks/${b.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${NOTION_API_KEY}`, "Notion-Version": NOTION_VERSION },
        }, `delete block ${b.id}`);
      }

      let after: string | undefined;
      const batches = chunk(newBlocks, 100);
      for (let i = 0; i < batches.length; i++) {
        const requestBody: any = { children: batches[i] };
        if (after) requestBody.after = after;
        const res = await notionWrite(`https://api.notion.com/v1/blocks/${pageId}/children`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${NOTION_API_KEY}`,
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }, `append block batch ${i + 1}/${batches.length}`);
        const saved = await res.json();
        after = saved.results?.[saved.results.length - 1]?.id ?? after;
      }

      const savedHtml = await blocksToHtml(await fetchBlockChildren(pageId, NOTION_API_KEY), NOTION_API_KEY);
      const actual = blocksFingerprint(htmlToBlocks(savedHtml));
      if (actual !== expected) {
        console.error("notion save verification mismatch", { pageId, expectedLength: expected.length, actualLength: actual.length });
        throw new Error("Saved Notion content does not match editor content");
      }
      console.log("notion save completed and verified", { pageId, blocks: newBlocks.length, batches: batches.length });

      return new Response(JSON.stringify({ ok: true, count: newBlocks.length, async: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

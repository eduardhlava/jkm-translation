// Refreshes an expired Notion-hosted (S3-signed) image URL by re-fetching the
// page's blocks from Notion, locating the matching image by its S3 path, and
// mirroring it permanently into the `notion-images` storage bucket.
// Returns a permanent public URL the client can embed in the PDF.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NOTION_VERSION = "2022-06-28";
const IMAGE_BUCKET = "notion-images";

function pathKey(url: string): string | null {
  try {
    return new URL(url).pathname;
  } catch {
    return null;
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
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_DATABASE_ID = "3689450d-3d3f-8024-8801-fdd841839156";

function extractNotionFileOwnerId(url: string): string | null {
  // Notion S3 pathname is usually: /<workspace_id>/<block_or_page_id>/<filename>
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    const uuids = parts.filter((p) => UUID_RE.test(p));
    return uuids[1] ?? null;
  } catch {
    return null;
  }
}

function fileNameKey(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    return parts.at(-1) ?? null;
  } catch {
    return null;
  }
}

function collectPageImageUrls(page: any): string[] {
  const urls: string[] = [];
  const cover = page?.cover;
  if (cover?.type === "external" && cover.external?.url) urls.push(cover.external.url);
  if (cover?.type === "file" && cover.file?.url) urls.push(cover.file.url);
  for (const prop of Object.values(page?.properties ?? {}) as any[]) {
    if (prop?.type === "files") {
      for (const f of prop.files ?? []) {
        if (f?.type === "external" && f.external?.url) urls.push(f.external.url);
        if (f?.type === "file" && f.file?.url) urls.push(f.file.url);
      }
    }
    if (prop?.type === "url" && typeof prop.url === "string" && /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(prop.url)) {
      urls.push(prop.url);
    }
  }
  return urls;
}

async function fetchFreshUrlFromBlock(blockId: string, apiKey: string): Promise<string | null> {
  const res = await fetch(`https://api.notion.com/v1/blocks/${blockId}`, {
    headers: { Authorization: `Bearer ${apiKey}`, "Notion-Version": NOTION_VERSION },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.type !== "image") return null;
  return data.image?.type === "external" ? data.image.external?.url : data.image.file?.url;
}

async function fetchFreshUrlsFromPage(pageId: string, apiKey: string): Promise<string[]> {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: { Authorization: `Bearer ${apiKey}`, "Notion-Version": NOTION_VERSION },
  });
  if (!res.ok) return [];
  return collectPageImageUrls(await res.json());
}

async function fetchFreshUrlFromImageDatabase(staleUrl: string, apiKey: string): Promise<string | null> {
  const stalePath = pathKey(staleUrl);
  const staleFile = fileNameKey(staleUrl);
  let cursor: string | undefined;
  let safety = 20;
  do {
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res = await fetch(`https://api.notion.com/v1/databases/${IMAGE_DATABASE_ID}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const urls = (data.results ?? []).flatMap(collectPageImageUrls);
    const exact = urls.find((u: string) => stalePath && pathKey(u) === stalePath);
    if (exact) return exact;
    const sameFile = urls.find((u: string) => staleFile && fileNameKey(u) === staleFile);
    if (sameFile) return sameFile;
    cursor = data.has_more ? data.next_cursor : undefined;
    safety--;
  } while (cursor && safety > 0);
  return null;
}

async function fetchAllBlocksRecursive(blockId: string, apiKey: string, depth = 0): Promise<any[]> {
  if (depth > 3) return [];
  const all: any[] = [];
  let cursor: string | undefined;
  do {
    const u = new URL(`https://api.notion.com/v1/blocks/${blockId}/children`);
    u.searchParams.set("page_size", "100");
    if (cursor) u.searchParams.set("start_cursor", cursor);
    const res = await fetch(u.toString(), {
      headers: { Authorization: `Bearer ${apiKey}`, "Notion-Version": NOTION_VERSION },
    });
    if (!res.ok) break;
    const data = await res.json();
    for (const b of data.results ?? []) {
      all.push(b);
      if (b.has_children) {
        const kids = await fetchAllBlocksRecursive(b.id, apiKey, depth + 1);
        all.push(...kids);
      }
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return all;
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { url: staleUrl, pageId } = await req.json();
    if (!staleUrl || !pageId) {
      return new Response(JSON.stringify({ error: "Missing url or pageId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const NOTION_KEY = Deno.env.get("NOTION_API_KEY")!;

    const stalePath = pathKey(staleUrl);
    // Reuse mirrored copy if it already exists
    const key = stalePath ? await sha1Hex(stalePath) : null;
    if (key) {
      for (const ext of ["jpg", "png", "webp", "gif", "svg", "bin"]) {
        const publicUrl = `${SUPA_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${key}.${ext}`;
        const head = await fetch(publicUrl, { method: "HEAD" });
        if (head.ok) {
          return new Response(JSON.stringify({ url: publicUrl }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Re-fetch fresh signed URL from Notion.
    // 1) Fast path: extract owner id from the S3 pathname. It can be either an image block id
    //    or a database page id whose file property/cover stores the image.
    let fresh: string | null = null;
    const ownerId = extractNotionFileOwnerId(staleUrl);
    if (ownerId) {
      fresh = await fetchFreshUrlFromBlock(ownerId, NOTION_KEY);
      if (!fresh) {
        const pageUrls = await fetchFreshUrlsFromPage(ownerId, NOTION_KEY);
        fresh = pageUrls.find((u) => pathKey(u) === stalePath) ?? pageUrls.find((u) => fileNameKey(u) === fileNameKey(staleUrl)) ?? pageUrls[0] ?? null;
      }
    }

    // 2) Fallback: recursively scan the document page tree and match by path.
    if (!fresh) {
      const blocks = await fetchAllBlocksRecursive(pageId, NOTION_KEY);
      const urls: string[] = [];
      for (const b of blocks) {
        if (b?.type === "image") {
          const src = b.image?.type === "external" ? b.image.external?.url : b.image.file?.url;
          if (src) urls.push(src);
        }
      }
      fresh = urls.find((u) => pathKey(u) === stalePath) ?? urls.find((u) => fileNameKey(u) === fileNameKey(staleUrl)) ?? null;
    }

    // 3) Fallback for images inserted from the separate "Obrázky" database.
    if (!fresh) {
      fresh = await fetchFreshUrlFromImageDatabase(staleUrl, NOTION_KEY);
    }
    if (!fresh) throw new Error("No matching image found on Notion page");

    const dl = await fetch(fresh);
    if (!dl.ok) throw new Error(`Fresh download failed [${dl.status}]`);
    const ct = dl.headers.get("content-type");
    const ext = extFromContentType(ct);
    const path = `${key ?? await sha1Hex(fresh)}.${ext}`;
    const body = new Uint8Array(await dl.arrayBuffer());

    const up = await fetch(`${SUPA_URL}/storage/v1/object/${IMAGE_BUCKET}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        "Content-Type": ct ?? "application/octet-stream",
        "x-upsert": "true",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
      body,
    });
    if (!up.ok && up.status !== 409) {
      throw new Error(`Upload failed [${up.status}]: ${await up.text()}`);
    }

    const publicUrl = `${SUPA_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${path}`;
    return new Response(JSON.stringify({ url: publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

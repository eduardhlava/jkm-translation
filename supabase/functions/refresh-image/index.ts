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

async function fetchAllBlocks(blockId: string, apiKey: string): Promise<any[]> {
  const all: any[] = [];
  let cursor: string | undefined;
  do {
    const u = new URL(`https://api.notion.com/v1/blocks/${blockId}/children`);
    u.searchParams.set("page_size", "100");
    if (cursor) u.searchParams.set("start_cursor", cursor);
    const res = await fetch(u.toString(), {
      headers: { Authorization: `Bearer ${apiKey}`, "Notion-Version": NOTION_VERSION },
    });
    if (!res.ok) throw new Error(`Notion ${res.status}: ${await res.text()}`);
    const data = await res.json();
    all.push(...(data.results ?? []));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return all;
}

function collectImageUrls(blocks: any[]): string[] {
  const urls: string[] = [];
  for (const b of blocks) {
    if (b?.type === "image") {
      const src = b.image?.type === "external" ? b.image.external?.url : b.image.file?.url;
      if (src) urls.push(src);
    }
  }
  return urls;
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

    // Re-fetch fresh signed URL from Notion
    const blocks = await fetchAllBlocks(pageId, NOTION_KEY);
    const candidates = collectImageUrls(blocks);
    const fresh = candidates.find((u) => pathKey(u) === stalePath) ?? candidates[0];
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

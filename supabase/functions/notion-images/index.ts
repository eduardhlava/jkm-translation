// Loads pages from the "Obrázky" Notion database and returns title + image URL.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NOTION_VERSION = "2022-06-28";
const DEFAULT_DB_ID = "3689450d-3d3f-8024-8801-fdd841839156";

function titleOf(page: any): string {
  const props = page.properties ?? {};
  for (const key of Object.keys(props)) {
    const p = props[key];
    if (p?.type === "title") {
      return (p.title ?? []).map((t: any) => t.plain_text ?? "").join("");
    }
  }
  return "";
}

function imageOf(page: any): string {
  // 1) Cover
  const cover = page.cover;
  if (cover?.type === "external" && cover.external?.url) return cover.external.url;
  if (cover?.type === "file" && cover.file?.url) return cover.file.url;
  // 2) First "files" property containing an image
  const props = page.properties ?? {};
  for (const key of Object.keys(props)) {
    const p = props[key];
    if (p?.type === "files" && Array.isArray(p.files) && p.files.length > 0) {
      const f = p.files[0];
      if (f.type === "external" && f.external?.url) return f.external.url;
      if (f.type === "file" && f.file?.url) return f.file.url;
    }
    if (p?.type === "url" && typeof p.url === "string" && /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(p.url)) {
      return p.url;
    }
  }
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const NOTION_API_KEY = Deno.env.get("NOTION_API_KEY");
    if (!NOTION_API_KEY) throw new Error("NOTION_API_KEY is not configured");

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const databaseId = body.databaseId || DEFAULT_DB_ID;

    const items: { id: string; title: string; image: string; url: string }[] = [];
    let cursor: string | undefined = undefined;
    let safety = 10;
    do {
      const res: Response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NOTION_API_KEY}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ page_size: 100, start_cursor: cursor }),
      });
      if (!res.ok) throw new Error(`Notion query failed [${res.status}]: ${await res.text()}`);
      const data = await res.json();
      for (const page of data.results ?? []) {
        const image = imageOf(page);
        if (!image) continue;
        items.push({ id: page.id, title: titleOf(page), image, url: page.url });
      }
      cursor = data.has_more ? data.next_cursor : undefined;
      safety--;
    } while (cursor && safety > 0);

    return new Response(JSON.stringify({ items, count: items.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("notion-images error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

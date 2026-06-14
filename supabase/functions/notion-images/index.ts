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

function selectOf(page: any, name: string): string {
  const p = page.properties?.[name];
  if (p?.type === "select") return p.select?.name ?? "";
  return "";
}

function imageOf(page: any): string {
  const cover = page.cover;
  if (cover?.type === "external" && cover.external?.url) return cover.external.url;
  if (cover?.type === "file" && cover.file?.url) return cover.file.url;
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
    const typ: string | undefined = body.typ || undefined;
    const stroj: string | undefined = body.stroj || undefined;
    const name: string = typeof body.name === "string" ? body.name.trim() : "";
    const limit: number = Math.min(Math.max(Number(body.limit) || 5, 1), 100);

    // Generate query variants by zero-padding numeric runs (width 1..3)
    // so "Obr1" also matches "Obr01"/"Obr001" and vice versa.
    function nameVariants(q: string): string[] {
      if (!q) return [];
      const parts = q.split(/(\d+)/);
      const numericIdx: number[] = [];
      parts.forEach((p, i) => { if (/^\d+$/.test(p)) numericIdx.push(i); });
      if (numericIdx.length === 0) return [q];
      const widths = [1, 2, 3];
      const variantsPerIdx = numericIdx.map((i) => {
        const n = parseInt(parts[i], 10);
        const s = new Set<string>();
        widths.forEach((w) => s.add(String(n).padStart(w, "0")));
        s.add(parts[i]); // keep original
        return Array.from(s);
      });
      // Cartesian product, capped at 12 variants for safety
      let combos: string[][] = [[]];
      for (const opts of variantsPerIdx) {
        const next: string[][] = [];
        for (const c of combos) for (const o of opts) next.push([...c, o]);
        combos = next;
        if (combos.length > 12) combos = combos.slice(0, 12);
      }
      const out = new Set<string>();
      for (const combo of combos) {
        const copy = parts.slice();
        numericIdx.forEach((idx, k) => { copy[idx] = combo[k]; });
        out.add(copy.join(""));
      }
      return Array.from(out);
    }

    const filters: any[] = [];
    if (typ) filters.push({ property: "typ", select: { equals: typ } });
    if (stroj) filters.push({ property: "stroj", select: { equals: stroj } });
    if (name) {
      const variants = nameVariants(name);
      if (variants.length === 1) {
        filters.push({ property: "název", title: { contains: variants[0] } });
      } else {
        filters.push({ or: variants.map((v) => ({ property: "název", title: { contains: v } })) });
      }
    }

    const queryBody: Record<string, unknown> = {
      page_size: Math.max(limit, 25),
      sorts: [{ timestamp: "created_time", direction: "descending" }],
    };
    if (filters.length === 1) queryBody.filter = filters[0];
    else if (filters.length > 1) queryBody.filter = { and: filters };


    const items: { id: string; title: string; image: string; url: string; typ: string; stroj: string; createdTime: string }[] = [];
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
        body: JSON.stringify({ ...queryBody, start_cursor: cursor }),
      });
      if (!res.ok) throw new Error(`Notion query failed [${res.status}]: ${await res.text()}`);
      const data = await res.json();
      for (const page of data.results ?? []) {
        const image = imageOf(page);
        if (!image) continue;
        items.push({
          id: page.id,
          title: titleOf(page),
          image,
          url: page.url,
          typ: selectOf(page, "typ"),
          stroj: selectOf(page, "stroj"),
          createdTime: page.created_time,
        });
        if (items.length >= limit) break;
      }
      if (items.length >= limit) break;
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

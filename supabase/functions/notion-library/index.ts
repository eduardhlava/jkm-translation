// Browses the Notion "Složky" (folders) and "Obrázky" (files) databases
// like a drive: folders / subfolders / files with metadata.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NOTION_VERSION = "2022-06-28";
const FILES_DB_ID = "3689450d-3d3f-8024-8801-fdd841839156";
const FOLDERS_DB_ID = "29fb66d5-98b9-48da-b616-bcb81db5cd3c";

const NOTION_API_KEY = Deno.env.get("NOTION_API_KEY");

async function notion(path: string, body?: unknown): Promise<any> {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${NOTION_API_KEY}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Notion ${path} failed [${res.status}]: ${await res.text()}`);
  return res.json();
}

function titleOf(page: any): string {
  const props = page.properties ?? {};
  for (const key of Object.keys(props)) {
    const p = props[key];
    if (p?.type === "title") return (p.title ?? []).map((t: any) => t.plain_text ?? "").join("");
  }
  return "";
}

function selectOf(page: any, name: string): string {
  const p = page.properties?.[name];
  return p?.type === "select" ? (p.select?.name ?? "") : "";
}

function relationIds(page: any, name: string): string[] {
  const p = page.properties?.[name];
  if (p?.type !== "relation") return [];
  return (p.relation ?? []).map((r: any) => r.id);
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
  }
  return "";
}

async function queryAll(dbId: string, body: Record<string, unknown> = {}): Promise<any[]> {
  const out: any[] = [];
  let cursor: string | undefined = undefined;
  let safety = 25;
  do {
    const data = await notion(`/databases/${dbId}/query`, {
      page_size: 100,
      ...body,
      start_cursor: cursor,
    });
    out.push(...(data.results ?? []));
    cursor = data.has_more ? data.next_cursor : undefined;
    safety--;
  } while (cursor && safety > 0);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!NOTION_API_KEY) throw new Error("NOTION_API_KEY is not configured");

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const folderId: string | null = body.folderId ?? null;
    const search: string = typeof body.search === "string" ? body.search.trim() : "";

    // 1) All folders (small dataset) → tree + breadcrumbs
    const folderPages = await queryAll(FOLDERS_DB_ID, {
      sorts: [{ property: "název", direction: "ascending" }],
    });
    const folders = folderPages.map((p) => ({
      id: p.id,
      name: titleOf(p),
      parentId: relationIds(p, "nadřazená_složka")[0] ?? null,
      url: p.url as string,
    }));

    const byId = new Map(folders.map((f) => [f.id, f]));
    const norm = (id: string | null) => (id ? id.replace(/-/g, "") : null);
    const target = norm(folderId);
    const children = folders.filter((f) => norm(f.parentId) === target);

    // Breadcrumbs
    const breadcrumbs: { id: string; name: string }[] = [];
    let cur = folderId ? byId.get(folderId) ?? folders.find((f) => norm(f.id) === target) : undefined;
    let guard = 20;
    while (cur && guard-- > 0) {
      breadcrumbs.unshift({ id: cur.id, name: cur.name });
      const parent = cur.parentId;
      cur = parent ? byId.get(parent) ?? folders.find((f) => norm(f.id) === norm(parent)) : undefined;
    }

    // 2) Files in this folder (or unassigned when at root)
    const filters: any[] = [];
    if (folderId) filters.push({ property: "slozka", relation: { contains: folderId } });
    else filters.push({ property: "slozka", relation: { is_empty: true } });
    if (search) filters.push({ property: "název", title: { contains: search } });

    const filePages = await queryAll(FILES_DB_ID, {
      filter: filters.length === 1 ? filters[0] : { and: filters },
      sorts: [{ property: "název", direction: "ascending" }],
    });

    const files = filePages.map((p) => ({
      id: p.id,
      title: titleOf(p),
      image: imageOf(p),
      url: p.url as string,
      typ: selectOf(p, "typ"),
      stroj: selectOf(p, "stroj"),
      stav: selectOf(p, "stav"),
      folderId: relationIds(p, "slozka")[0] ?? null,
      createdTime: p.created_time,
    }));

    return new Response(
      JSON.stringify({ folders: children, allFolders: folders, breadcrumbs, files }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("notion-library error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

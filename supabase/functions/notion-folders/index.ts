// Manages the Notion "Složky" (folders) database: list / create / rename / move.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NOTION_VERSION = "2022-06-28";
const FOLDERS_DB_ID = "29fb66d5-98b9-48da-b616-bcb81db5cd3c";
const NOTION_API_KEY = Deno.env.get("NOTION_API_KEY");

async function notion(path: string, method: string, body?: unknown): Promise<any> {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
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

function relationIds(page: any, name: string): string[] {
  const p = page.properties?.[name];
  if (p?.type !== "relation") return [];
  return (p.relation ?? []).map((r: any) => r.id);
}

async function listFolders() {
  const out: any[] = [];
  let cursor: string | undefined = undefined;
  let safety = 25;
  do {
    const data = await notion(`/databases/${FOLDERS_DB_ID}/query`, "POST", {
      page_size: 100,
      sorts: [{ property: "název", direction: "ascending" }],
      start_cursor: cursor,
    });
    out.push(...(data.results ?? []));
    cursor = data.has_more ? data.next_cursor : undefined;
    safety--;
  } while (cursor && safety > 0);
  return out.map((p) => ({
    id: p.id,
    name: titleOf(p),
    parentId: relationIds(p, "nadřazená_složka")[0] ?? null,
    url: p.url as string,
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!NOTION_API_KEY) throw new Error("NOTION_API_KEY is not configured");
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action: string = body.action ?? "list";

    if (action === "create") {
      const name = String(body.name ?? "").trim();
      if (!name) throw new Error("Název složky je povinný");
      const parentId: string | null = body.parentId ?? null;
      await notion("/pages", "POST", {
        parent: { database_id: FOLDERS_DB_ID },
        properties: {
          "název": { title: [{ text: { content: name } }] },
          ...(parentId
            ? { "nadřazená_složka": { relation: [{ id: parentId }] } }
            : {}),
        },
      });
    } else if (action === "rename") {
      const id = String(body.id ?? "");
      const name = String(body.name ?? "").trim();
      if (!id || !name) throw new Error("Chybí ID nebo název");
      await notion(`/pages/${id}`, "PATCH", {
        properties: { "název": { title: [{ text: { content: name } }] } },
      });
    } else if (action === "move") {
      const id = String(body.id ?? "");
      if (!id) throw new Error("Chybí ID složky");
      const parentId: string | null = body.parentId ?? null;
      if (parentId && parentId === id) throw new Error("Složku nelze vložit do sebe");
      await notion(`/pages/${id}`, "PATCH", {
        properties: {
          "nadřazená_složka": { relation: parentId ? [{ id: parentId }] : [] },
        },
      });
    } else if (action !== "list") {
      throw new Error(`Neznámá akce: ${action}`);
    }

    const folders = await listFolders();
    return new Response(JSON.stringify({ folders }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("notion-folders error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

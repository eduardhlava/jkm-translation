// Fetches pages from a Notion database, filtered by a status property value.
// Returns simplified items with the requested text/rich_text/select properties.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NOTION_VERSION = "2022-06-28";

interface FetchRequest {
  statusProperty?: string;
  statusValue?: string;
  textProperties?: string[];
  databaseId?: string;
  pageSize?: number;
  sortProperty?: string;
  sortDirection?: "ascending" | "descending";
}

function readPropertyText(prop: any): string {
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
      return (prop.multi_select ?? []).map((s: any) => s.name).join("\u0001");
    case "url":
      return prop.url ?? "";
    case "email":
      return prop.email ?? "";
    case "phone_number":
      return prop.phone_number ?? "";
    case "number":
      return prop.number?.toString() ?? "";
    default:
      return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const NOTION_API_KEY = Deno.env.get("NOTION_API_KEY");
    const ENV_DB_ID = Deno.env.get("NOTION_DATABASE_ID");
    if (!NOTION_API_KEY) throw new Error("NOTION_API_KEY is not configured");

    const body: FetchRequest = req.method === "POST" ? await req.json() : {};
    const databaseId = body.databaseId || ENV_DB_ID;
    if (!databaseId) throw new Error("NOTION_DATABASE_ID is not configured");

    let filter: any = undefined;
    let propMetaMap: Record<string, any> = {};

    // Read DB schema once (also helps detect status vs select)
    const dbRes = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        "Notion-Version": NOTION_VERSION,
      },
    });
    if (!dbRes.ok) throw new Error(`Notion DB read failed [${dbRes.status}]: ${await dbRes.text()}`);
    const db = await dbRes.json();
    propMetaMap = db.properties ?? {};

    if (body.statusProperty && body.statusValue) {
      const meta = propMetaMap[body.statusProperty];
      if (!meta) throw new Error(`Property "${body.statusProperty}" not found in database`);
      if (meta.type === "status") {
        filter = { property: body.statusProperty, status: { equals: body.statusValue } };
      } else if (meta.type === "select") {
        filter = { property: body.statusProperty, select: { equals: body.statusValue } };
      } else {
        throw new Error(`Property "${body.statusProperty}" must be of type status or select`);
      }
    }

    let sorts: any = undefined;
    if (body.sortProperty) {
      const sMeta = propMetaMap[body.sortProperty];
      if (sMeta && ["title", "rich_text", "select", "status", "number", "date"].includes(sMeta.type)) {
        sorts = [
          {
            property: body.sortProperty,
            direction: body.sortDirection ?? "ascending",
          },
        ];
      }
    }

    const queryRes = await fetch(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NOTION_API_KEY}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ filter, sorts, page_size: body.pageSize ?? 20 }),
      },
    );

    if (!queryRes.ok) throw new Error(`Notion query failed [${queryRes.status}]: ${await queryRes.text()}`);

    const data = await queryRes.json();
    const wantedProps = body.textProperties ?? [];

    const items = (data.results ?? []).map((page: any) => {
      const props = page.properties ?? {};
      const values: Record<string, string> = {};
      const targets =
        wantedProps.length > 0
          ? wantedProps
          : Object.entries(props)
              .filter(([, p]: [string, any]) => ["title", "rich_text"].includes(p.type))
              .map(([name]) => name);
      for (const name of targets) {
        values[name] = readPropertyText(props[name]);
      }
      return { id: page.id, url: page.url, properties: values };
    });

    return new Response(
      JSON.stringify({ items, count: items.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("notion-fetch error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

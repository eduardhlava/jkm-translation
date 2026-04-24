// Fetches pages from a Notion database, optionally filtered by a status property value.
// Returns simplified items containing only the requested text/rich_text properties.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NOTION_VERSION = "2022-06-28";

interface FetchRequest {
  statusProperty?: string; // e.g. "Status"
  statusValue?: string; // e.g. "To translate"
  textProperties?: string[]; // properties whose text should be returned
  databaseId?: string; // override env DATABASE_ID
  pageSize?: number;
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
      return (prop.multi_select ?? []).map((s: any) => s.name).join(", ");
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

function listAllProperties(properties: Record<string, any>) {
  return Object.entries(properties).map(([name, p]: [string, any]) => ({
    name,
    type: p.type,
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const NOTION_API_KEY = Deno.env.get("NOTION_API_KEY");
    const ENV_DB_ID = Deno.env.get("NOTION_DATABASE_ID");
    if (!NOTION_API_KEY) throw new Error("NOTION_API_KEY is not configured");

    const body: FetchRequest = req.method === "POST" ? await req.json() : {};
    const databaseId = body.databaseId || ENV_DB_ID;
    if (!databaseId) throw new Error("NOTION_DATABASE_ID is not configured");

    // Build filter based on status property
    let filter: any = undefined;
    if (body.statusProperty && body.statusValue) {
      // Try both `status` and `select` types — Notion will reject the wrong one.
      // We'll first attempt to read the database schema to pick the correct one.
      const dbRes = await fetch(
        `https://api.notion.com/v1/databases/${databaseId}`,
        {
          headers: {
            Authorization: `Bearer ${NOTION_API_KEY}`,
            "Notion-Version": NOTION_VERSION,
          },
        },
      );
      if (!dbRes.ok) {
        const text = await dbRes.text();
        throw new Error(`Notion DB read failed [${dbRes.status}]: ${text}`);
      }
      const db = await dbRes.json();
      const propMeta = db.properties?.[body.statusProperty];
      if (!propMeta) {
        throw new Error(
          `Property "${body.statusProperty}" not found in database`,
        );
      }
      if (propMeta.type === "status") {
        filter = {
          property: body.statusProperty,
          status: { equals: body.statusValue },
        };
      } else if (propMeta.type === "select") {
        filter = {
          property: body.statusProperty,
          select: { equals: body.statusValue },
        };
      } else {
        throw new Error(
          `Property "${body.statusProperty}" must be of type status or select`,
        );
      }
    }

    // Query pages
    const queryRes = await fetch(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NOTION_API_KEY}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filter,
          page_size: body.pageSize ?? 100,
        }),
      },
    );

    if (!queryRes.ok) {
      const text = await queryRes.text();
      throw new Error(`Notion query failed [${queryRes.status}]: ${text}`);
    }

    const data = await queryRes.json();
    const wantedProps = body.textProperties ?? [];

    const items = (data.results ?? []).map((page: any) => {
      const props = page.properties ?? {};
      const values: Record<string, string> = {};
      // If no specific list, return all title + rich_text properties
      const targets =
        wantedProps.length > 0
          ? wantedProps
          : Object.entries(props)
              .filter(([, p]: [string, any]) =>
                ["title", "rich_text"].includes(p.type),
              )
              .map(([name]) => name);
      for (const name of targets) {
        values[name] = readPropertyText(props[name]);
      }
      return {
        id: page.id,
        url: page.url,
        properties: values,
        allProperties: listAllProperties(props),
      };
    });

    return new Response(
      JSON.stringify({ items, count: items.length }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
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

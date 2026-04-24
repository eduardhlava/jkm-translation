// Counts all pages in the Notion database matching a status filter.
// Paginates through all results to return a true total count.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NOTION_VERSION = "2022-06-28";

interface CountRequest {
  statusProperty: string;
  statusValue: string;
  databaseId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const NOTION_API_KEY = Deno.env.get("NOTION_API_KEY");
    const ENV_DB_ID = Deno.env.get("NOTION_DATABASE_ID");
    if (!NOTION_API_KEY) throw new Error("NOTION_API_KEY is not configured");

    const body: CountRequest = await req.json();
    const databaseId = body.databaseId || ENV_DB_ID;
    if (!databaseId) throw new Error("NOTION_DATABASE_ID is not configured");
    if (!body.statusProperty || !body.statusValue) {
      throw new Error("statusProperty and statusValue are required");
    }

    // Detect property type
    const dbRes = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        "Notion-Version": NOTION_VERSION,
      },
    });
    if (!dbRes.ok) throw new Error(`Notion DB read failed [${dbRes.status}]: ${await dbRes.text()}`);
    const db = await dbRes.json();
    const meta = (db.properties ?? {})[body.statusProperty];
    if (!meta) throw new Error(`Property "${body.statusProperty}" not found`);

    let filter: any;
    if (meta.type === "status") {
      filter = { property: body.statusProperty, status: { equals: body.statusValue } };
    } else if (meta.type === "select") {
      filter = { property: body.statusProperty, select: { equals: body.statusValue } };
    } else {
      throw new Error(`Property "${body.statusProperty}" must be status or select`);
    }

    let count = 0;
    let cursor: string | undefined = undefined;
    // Safety cap to avoid runaway loops
    for (let i = 0; i < 50; i++) {
      const res = await fetch(
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
            page_size: 100,
            start_cursor: cursor,
          }),
        },
      );
      if (!res.ok) throw new Error(`Notion query failed [${res.status}]: ${await res.text()}`);
      const data = await res.json();
      count += (data.results ?? []).length;
      if (data.has_more && data.next_cursor) cursor = data.next_cursor;
      else break;
    }

    return new Response(
      JSON.stringify({ count }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("notion-count error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

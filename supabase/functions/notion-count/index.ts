// Counts all pages in the Notion database matching a status filter.
// Tries status filter first, falls back to select if needed. Avoids extra DB metadata fetch.

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
  propertyType?: "status" | "select";
  startCursor?: string | null;
  maxPages?: number;
}

async function queryCount(
  databaseId: string,
  apiKey: string,
  filter: any,
  startCursor: string | undefined,
  maxPages: number,
): Promise<
  | { ok: true; count: number; nextCursor: string | null; hasMore: boolean }
  | { ok: false; status: number; text: string }
> {
  let count = 0;
  let cursor: string | undefined = startCursor;
  for (let i = 0; i < maxPages; i++) {
    const res: Response = await fetch(
      `https://api.notion.com/v1/databases/${databaseId}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
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
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, status: res.status, text };
    }
    const data: any = await res.json();
    count += (data.results ?? []).length;
    if (data.has_more && data.next_cursor) {
      cursor = data.next_cursor;
    } else {
      return { ok: true, count, nextCursor: null, hasMore: false };
    }
  }
  return { ok: true, count, nextCursor: cursor ?? null, hasMore: true };
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

    const startCursor = body.startCursor ?? undefined;
    const maxPages = Math.min(Math.max(body.maxPages ?? 10, 1), 50);

    // Try status filter first; if Notion rejects, retry as select.
    const statusFilter = {
      property: body.statusProperty,
      status: { equals: body.statusValue },
    };

    let result = await queryCount(databaseId, NOTION_API_KEY, statusFilter, startCursor, maxPages);

    if (!result.ok && result.status === 400) {
      const selectFilter = {
        property: body.statusProperty,
        select: { equals: body.statusValue },
      };
      result = await queryCount(databaseId, NOTION_API_KEY, selectFilter, startCursor, maxPages);
    }

    if (!result.ok) {
      throw new Error(`Notion query failed [${result.status}]: ${result.text}`);
    }

    return new Response(
      JSON.stringify({
        count: result.count,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      }),
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

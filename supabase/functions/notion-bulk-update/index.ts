// Bulk-updates multiple Notion pages. Each update specifies pageId and a property->value map.
// Property values are written based on detected property type from the page itself.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NOTION_VERSION = "2022-06-28";

interface PageUpdate {
  pageId: string;
  // map property name -> value (string). Type is inferred from the page schema.
  updates: Record<string, string>;
}

interface BulkRequest {
  updates: PageUpdate[];
}

function richText(text: string) {
  return [{ type: "text", text: { content: text } }];
}

async function fetchPage(apiKey: string, pageId: string) {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: { Authorization: `Bearer ${apiKey}`, "Notion-Version": NOTION_VERSION },
  });
  if (!res.ok) throw new Error(`Notion page read failed [${res.status}]: ${await res.text()}`);
  return res.json();
}

async function patchPage(apiKey: string, pageId: string, properties: Record<string, any>) {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ properties }),
  });
  if (!res.ok) throw new Error(`Notion update failed [${res.status}]: ${await res.text()}`);
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const NOTION_API_KEY = Deno.env.get("NOTION_API_KEY");
    if (!NOTION_API_KEY) throw new Error("NOTION_API_KEY is not configured");

    const body: BulkRequest = await req.json();
    if (!body?.updates || !Array.isArray(body.updates)) {
      throw new Error("updates[] is required");
    }

    const results: { pageId: string; ok: boolean; error?: string }[] = [];

    for (const u of body.updates) {
      try {
        const page = await fetchPage(NOTION_API_KEY, u.pageId);
        const existing = page.properties ?? {};
        const payload: Record<string, any> = {};
        for (const [name, value] of Object.entries(u.updates)) {
          const meta = existing[name];
          if (!meta) {
            console.warn(`Property "${name}" missing on page ${u.pageId}`);
            continue;
          }
          switch (meta.type) {
            case "title":
              payload[name] = { title: richText(value) };
              break;
            case "rich_text":
              payload[name] = { rich_text: richText(value) };
              break;
            case "status":
              payload[name] = { status: { name: value } };
              break;
            case "select":
              payload[name] = { select: value ? { name: value } : null };
              break;
            default:
              console.warn(`Property "${name}" type ${meta.type} unsupported`);
          }
        }
        if (Object.keys(payload).length > 0) {
          await patchPage(NOTION_API_KEY, u.pageId, payload);
        }
        results.push({ pageId: u.pageId, ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        console.error("update failed", u.pageId, msg);
        results.push({ pageId: u.pageId, ok: false, error: msg });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    return new Response(
      JSON.stringify({ success: true, okCount, total: results.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("notion-bulk-update error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

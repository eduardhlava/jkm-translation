// Updates a Notion page: writes translated text properties and optionally a new status.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NOTION_VERSION = "2022-06-28";

interface UpdateRequest {
  pageId: string;
  // map of Notion property name -> new plain text value
  textUpdates: Record<string, string>;
  // optional status update
  statusProperty?: string;
  newStatusValue?: string;
  databaseId?: string;
}

function buildRichTextValue(text: string) {
  return [
    {
      type: "text",
      text: { content: text },
    },
  ];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const NOTION_API_KEY = Deno.env.get("NOTION_API_KEY");
    const ENV_DB_ID = Deno.env.get("NOTION_DATABASE_ID");
    if (!NOTION_API_KEY) throw new Error("NOTION_API_KEY is not configured");

    const body: UpdateRequest = await req.json();
    if (!body?.pageId) throw new Error("pageId is required");

    const databaseId = body.databaseId || ENV_DB_ID;

    // We need property types to build the right payload.
    // Easiest: read the page itself.
    const pageRes = await fetch(
      `https://api.notion.com/v1/pages/${body.pageId}`,
      {
        headers: {
          Authorization: `Bearer ${NOTION_API_KEY}`,
          "Notion-Version": NOTION_VERSION,
        },
      },
    );
    if (!pageRes.ok) {
      const text = await pageRes.text();
      throw new Error(`Notion page read failed [${pageRes.status}]: ${text}`);
    }
    const page = await pageRes.json();
    const existingProps = page.properties ?? {};

    const propertiesPayload: Record<string, any> = {};

    for (const [name, value] of Object.entries(body.textUpdates ?? {})) {
      const existing = existingProps[name];
      if (!existing) {
        console.warn(`Property "${name}" not found on page, skipping`);
        continue;
      }
      if (existing.type === "title") {
        propertiesPayload[name] = { title: buildRichTextValue(value) };
      } else if (existing.type === "rich_text") {
        propertiesPayload[name] = { rich_text: buildRichTextValue(value) };
      } else {
        console.warn(
          `Property "${name}" type ${existing.type} not supported, skipping`,
        );
      }
    }

    // Status update
    if (body.statusProperty && body.newStatusValue) {
      const existing = existingProps[body.statusProperty];
      if (existing?.type === "status") {
        propertiesPayload[body.statusProperty] = {
          status: { name: body.newStatusValue },
        };
      } else if (existing?.type === "select") {
        propertiesPayload[body.statusProperty] = {
          select: { name: body.newStatusValue },
        };
      }
    }

    const patchRes = await fetch(
      `https://api.notion.com/v1/pages/${body.pageId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${NOTION_API_KEY}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ properties: propertiesPayload }),
      },
    );

    if (!patchRes.ok) {
      const text = await patchRes.text();
      throw new Error(`Notion update failed [${patchRes.status}]: ${text}`);
    }

    const updated = await patchRes.json();

    return new Response(
      JSON.stringify({ success: true, pageId: updated.id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("notion-update error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

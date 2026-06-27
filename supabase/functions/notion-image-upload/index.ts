// Uploads image to Supabase storage (public) and creates a Notion page in the
// "Obrázky" database with title/typ/stroj and the image as page cover.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NOTION_VERSION = "2022-06-28";
const DEFAULT_DB_ID = "3689450d-3d3f-8024-8801-fdd841839156";

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const NOTION_API_KEY = Deno.env.get("NOTION_API_KEY");
    if (!NOTION_API_KEY) throw new Error("NOTION_API_KEY is not configured");

    // Debug: GET returns DB schema so we can inspect property names/types
    if (req.method === "GET") {
      const url = new URL(req.url);
      const dbId = url.searchParams.get("db") || DEFAULT_DB_ID;
      const r = await fetch(`https://api.notion.com/v1/databases/${dbId}`, {
        headers: { Authorization: `Bearer ${NOTION_API_KEY}`, "Notion-Version": NOTION_VERSION },
      });
      const j = await r.json();
      const props: Record<string, string> = {};
      for (const [k, v] of Object.entries(j.properties ?? {})) props[k] = (v as any).type;
      return new Response(JSON.stringify({ properties: props }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = await req.json();
    const {
      fileBase64,
      fileName,
      contentType,
      title,
      typ,
      stroj,
      databaseId,
    }: {
      fileBase64: string;
      fileName: string;
      contentType?: string;
      title: string;
      typ?: string;
      stroj?: string;
      databaseId?: string;
    } = body ?? {};

    if (!fileBase64 || !fileName || !title) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Upload to public storage
    const ext = (fileName.split(".").pop() || "png").toLowerCase();
    const path = `notion-uploads/${crypto.randomUUID()}.${ext}`;
    const bytes = decodeBase64(fileBase64);
    const { error: upErr } = await supabase.storage.from("notion-images").upload(path, bytes, {
      contentType: contentType || "application/octet-stream",
      upsert: false,
    });
    if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);
    const { data: pub } = supabase.storage.from("notion-images").getPublicUrl(path);
    const publicUrl = pub.publicUrl;

    // 2) Create Notion page (also fill "soubor" files property so the image
    // shows in the database's gallery/table view, not only as page cover).
    const properties: Record<string, unknown> = {
      "název": { title: [{ text: { content: title } }] },
      "soubor": {
        files: [
          { name: `${title}.${ext}`, type: "external", external: { url: publicUrl } },
        ],
      },
    };
    if (typ) properties["typ"] = { select: { name: typ } };
    if (stroj) properties["stroj"] = { select: { name: stroj } };

    const pageBody = {
      parent: { database_id: databaseId || DEFAULT_DB_ID },
      properties,
      cover: { type: "external", external: { url: publicUrl } },
    };

    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pageBody),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Notion create failed [${res.status}]: ${txt}`);
    }
    const page = await res.json();

    return new Response(
      JSON.stringify({
        id: page.id,
        url: page.url,
        image: publicUrl,
        title,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("notion-image-upload error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

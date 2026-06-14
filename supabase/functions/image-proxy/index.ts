// Proxy for fetching images that lack CORS headers (e.g. Notion S3 signed URLs).
// Returns the image bytes with proper Content-Type and CORS headers so that
// @react-pdf/renderer (which uses fetch()) can embed them in generated PDFs.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let url: string | null = null;
    if (req.method === "GET") {
      url = new URL(req.url).searchParams.get("url");
    } else {
      const body = await req.json().catch(() => ({}));
      url = body?.url ?? null;
    }
    if (!url) {
      return new Response(JSON.stringify({ error: "Missing url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const upstream = await fetch(url);
    if (!upstream.ok) {
      await upstream.body?.cancel().catch(() => undefined);
      return new Response(null, {
        status: 204,
        headers: { ...corsHeaders, "Cache-Control": "no-store" },
      });
    }

    const contentType = upstream.headers.get("Content-Type") ?? "application/octet-stream";
    const body = await upstream.arrayBuffer();
    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const sanitizeFilename = (value: string) => {
  const cleaned = value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
  return (cleaned || "dokument.pdf").endsWith(".pdf") ? cleaned || "dokument.pdf" : `${cleaned}.pdf`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const contentType = req.headers.get("content-type") ?? "";
    const body = contentType.includes("application/x-www-form-urlencoded")
      ? Object.fromEntries((await req.formData()).entries())
      : await req.json();
    const filename = sanitizeFilename(String(body.filename ?? "dokument.pdf"));
    const base64 = String(body.file ?? "").replace(/^data:[^,]+,/, "");
    if (!base64) throw new Error("Chybí PDF data.");

    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    return new Response(bytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": String(bytes.byteLength),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stažení PDF selhalo.";
    return new Response(message, { status: 400, headers: corsHeaders });
  }
});
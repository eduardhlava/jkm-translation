// Converts a CAD drawing (DWG/DXF) to a raster PNG via CloudConvert,
// so it can be embedded into the generated PDF (@react-pdf/renderer supports
// raster images only).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CC_API = "https://api.cloudconvert.com/v2";
// Target raster width — CAD drawings need enough resolution so dimensions
// and thin lines stay readable. Can be tuned later.
const TARGET_WIDTH = 2000;

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const API_KEY = Deno.env.get("CLOUDCONVERT_API_KEY");
    if (!API_KEY) throw new Error("CLOUDCONVERT_API_KEY is not configured");

    const { fileBase64, fileName } = (await req.json()) ?? {};
    if (!fileBase64 || !fileName) {
      return new Response(JSON.stringify({ error: "Missing fileBase64 or fileName" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ext = String(fileName).split(".").pop()?.toLowerCase();
    if (ext !== "dwg" && ext !== "dxf") {
      return new Response(JSON.stringify({ error: "Podporovány jsou pouze soubory .dwg a .dxf" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jobRes = await fetch(`${CC_API}/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tasks: {
          "import-1": {
            operation: "import/base64",
            file: fileBase64,
            filename: fileName,
          },
          "convert-1": {
            operation: "convert",
            input: "import-1",
            input_format: ext,
            output_format: "png",
            // CloudConvert image output supports width/height for cad -> png.
            width: TARGET_WIDTH,
          },
          "export-1": {
            operation: "export/url",
            input: "convert-1",
          },
        },
      }),
    });

    if (!jobRes.ok) {
      const txt = await jobRes.text();
      throw new Error(`CloudConvert job create failed [${jobRes.status}]: ${txt}`);
    }
    const jobJson = await jobRes.json();
    const jobId = jobJson?.data?.id;
    if (!jobId) throw new Error("CloudConvert job id missing");

    // Poll until finished / error (timeout ~60 s)
    let job: any = null;
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000));
      const r = await fetch(`${CC_API}/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
      });
      if (!r.ok) continue;
      const j = await r.json();
      job = j?.data;
      if (job?.status === "finished" || job?.status === "error") break;
    }

    if (!job) throw new Error("Konverze vypršela (timeout)");
    if (job.status === "error") {
      const msg = (job.tasks ?? [])
        .filter((t: any) => t.status === "error" && t.message)
        .map((t: any) => t.message)
        .join("; ");
      throw new Error(msg || "Konverze v CloudConvert selhala");
    }
    if (job.status !== "finished") throw new Error("Konverze vypršela (timeout)");

    const exportTask = (job.tasks ?? []).find(
      (t: any) => t.operation === "export/url" && t.status === "finished",
    );
    const url = exportTask?.result?.files?.[0]?.url;
    if (!url) throw new Error("Výsledný PNG soubor nebyl nalezen");

    const fileRes = await fetch(url);
    if (!fileRes.ok) throw new Error(`Stažení PNG selhalo [${fileRes.status}]`);
    const bytes = new Uint8Array(await fileRes.arrayBuffer());

    return new Response(
      JSON.stringify({ imageBase64: bytesToBase64(bytes), contentType: "image/png" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("convert-cad-to-png error:", error instanceof Error ? error.message : error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

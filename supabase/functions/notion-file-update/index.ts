// Updates a file page in the Notion files database: title, typ, stroj, folder relation.
import {
  FILES_DB_ID,
  choiceType,
  choiceValue,
  corsHeaders,
  json,
  notion,
  schemaCache,
  toList,
} from "../_shared/notion.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body.id ?? "").trim();
    const title = String(body.title ?? "").trim();
    if (!id) return json({ error: "Chybí ID souboru." }, 400);
    if (!title) return json({ error: "Název nesmí být prázdný." }, 400);
    const typ = toList(body.typ);
    const stroj = toList(body.stroj);
    if ([...typ, ...stroj].some((v) => v.includes(","))) {
      return json({ error: "Hodnoty Typ a Stroj nesmí obsahovat čárku." }, 400);
    }
    const folderId: string | null = body.folderId ? String(body.folderId) : null;

    const db = await schemaCache()(FILES_DB_ID);
    await notion(`/pages/${id}`, "PATCH", {
      properties: {
        "název": { title: [{ text: { content: title } }] },
        typ: choiceValue(choiceType(db, "typ"), typ),
        stroj: choiceValue(choiceType(db, "stroj"), stroj),
        slozka: { relation: folderId ? [{ id: folderId }] : [] },
      },
    });
    return json({ ok: true });
  } catch (error: unknown) {
    console.error("notion-file-update error:", error);
    return json({ error: error instanceof Error ? error.message : "Neznámá chyba" }, 500);
  }
});

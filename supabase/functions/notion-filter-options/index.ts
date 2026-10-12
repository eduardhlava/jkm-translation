// Manages options of "typ" and "stroj" properties in the Notion files database.
import {
  FILES_DB_ID,
  choiceType,
  corsHeaders,
  json,
  notion,
  schemaCache,
  valuesOf,
} from "../_shared/notion.ts";

const PROPS = ["typ", "stroj"] as const;
type Prop = (typeof PROPS)[number];

function optionsOf(db: any, prop: Prop): { id: string; name: string; color?: string }[] {
  const p = db.properties?.[prop];
  if (!p) return [];
  return (p[p.type]?.options ?? []).map((o: any) => ({ id: o.id, name: o.name, color: o.color }));
}

function validate(name: string, existing: { id: string; name: string }[], exceptId?: string) {
  if (!name) throw new Error("Název nesmí být prázdný.");
  if (name.includes(",")) throw new Error("Název nesmí obsahovat čárku.");
  if (name.length > 100) throw new Error("Název je příliš dlouhý (max. 100 znaků).");
  const dup = existing.find((o) => o.id !== exceptId && o.name.toLowerCase() === name.toLowerCase());
  if (dup) throw new Error(`Položka „${dup.name}“ už existuje.`);
}

async function patchOptions(prop: Prop, type: string, options: unknown[]) {
  await notion(`/databases/${FILES_DB_ID}`, "PATCH", {
    properties: { [prop]: { [type]: { options } } },
  });
}

const keep = (o: { id: string; name: string; color?: string }) => ({ id: o.id, name: o.name, color: o.color });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const getDb = schemaCache();
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action: string = body.action ?? "list";

    if (action === "add" || action === "rename") {
      const prop = body.property as Prop;
      if (!PROPS.includes(prop)) throw new Error("Neplatná vlastnost (povoleno: typ, stroj).");
      const db = await getDb(FILES_DB_ID);
      const type = db.properties?.[prop]?.type;
      if (type !== "select" && type !== "multi_select") {
        throw new Error(`Vlastnost „${prop}“ v Notion není typu select ani multi_select.`);
      }
      const opts = optionsOf(db, prop);
      const name = String(body.name ?? "").trim();

      if (action === "add") {
        validate(name, opts);
        await patchOptions(prop, type, [...opts.map(keep), { name }]);
      } else {
        const id = String(body.id ?? "");
        const target = opts.find((o) => o.id === id);
        if (!target) throw new Error("Položka nebyla nalezena (mohla být mezitím změněna).");
        validate(name, opts, id);
        if (target.name !== name) {
          // 1) Try native rename by option id
          let renamed = false;
          try {
            await patchOptions(prop, type, opts.map((o) => (o.id === id ? { id, name, color: o.color } : keep(o))));
            const check = optionsOf(await getDb(FILES_DB_ID, true), prop);
            renamed = check.some((o) => o.id === id && o.name === name);
          } catch (e) {
            console.warn("native rename failed, using fallback:", e);
          }
          // 2) Fallback: add new option, remap pages, remove old option
          if (!renamed) {
            const fresh = optionsOf(await getDb(FILES_DB_ID, true), prop);
            if (!fresh.some((o) => o.name === name)) {
              await patchOptions(prop, type, [...fresh.map(keep), { name }]);
            }
            let cursor: string | undefined;
            let guard = 50;
            do {
              const filter = type === "multi_select"
                ? { property: prop, multi_select: { contains: target.name } }
                : { property: prop, select: { equals: target.name } };
              const data = await notion(`/databases/${FILES_DB_ID}/query`, "POST", {
                page_size: 100,
                filter,
                start_cursor: cursor,
              });
              for (const page of data.results ?? []) {
                const vals = valuesOf(page, prop);
                const next = Array.from(new Set(vals.map((v) => (v === target.name ? name : v))));
                await notion(`/pages/${page.id}`, "PATCH", {
                  properties: {
                    [prop]: type === "multi_select"
                      ? { multi_select: next.map((n) => ({ name: n })) }
                      : { select: { name } },
                  },
                });
              }
              cursor = data.has_more ? data.next_cursor : undefined;
            } while (cursor && guard-- > 0);
            const after = optionsOf(await getDb(FILES_DB_ID, true), prop);
            await patchOptions(prop, type, after.filter((o) => o.id !== id).map(keep));
          }
        }
      }
    } else if (action !== "list") {
      throw new Error(`Neznámá akce: ${action}`);
    }

    const db = await getDb(FILES_DB_ID, true);
    return json({
      typ: optionsOf(db, "typ"),
      stroj: optionsOf(db, "stroj"),
      types: { typ: choiceType(db, "typ"), stroj: choiceType(db, "stroj") },
    });
  } catch (error: unknown) {
    console.error("notion-filter-options error:", error);
    return json({ error: error instanceof Error ? error.message : "Neznámá chyba" }, 500);
  }
});

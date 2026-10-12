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
type Opt = { id: string; name: string; color?: string };

function optionsOf(db: any, prop: Prop): Opt[] {
  const p = db.properties?.[prop];
  if (!p) return [];
  return (p[p.type]?.options ?? []).map((o: any) => ({ id: o.id, name: o.name, color: o.color }));
}

function validate(name: string, existing: Opt[], exceptId?: string) {
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

const keep = (o: Opt) => ({ id: o.id, name: o.name, color: o.color });

function valueFilter(type: string, prop: Prop, name: string) {
  return type === "multi_select"
    ? { property: prop, multi_select: { contains: name } }
    : { property: prop, select: { equals: name } };
}

async function pagesWith(type: string, prop: Prop, name: string, max = Infinity): Promise<any[]> {
  const out: any[] = [];
  let cursor: string | undefined;
  let guard = 100;
  do {
    const data = await notion(`/databases/${FILES_DB_ID}/query`, "POST", {
      page_size: 100,
      filter: valueFilter(type, prop, name),
      start_cursor: cursor,
    });
    out.push(...(data.results ?? []));
    if (out.length >= max) break;
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor && guard-- > 0);
  return out;
}

function titleOf(page: any): string {
  for (const p of Object.values<any>(page.properties ?? {})) {
    if (p?.type === "title") return (p.title ?? []).map((t: any) => t.plain_text ?? "").join("");
  }
  return page.id;
}

/** Replace value `from` with `to` on all pages. Returns titles of pages that failed. */
async function remap(type: string, prop: Prop, from: string, to: string): Promise<string[]> {
  const failed: string[] = [];
  const pages = await pagesWith(type, prop, from);
  for (const page of pages) {
    try {
      const vals = valuesOf(page, prop);
      const next = Array.from(new Set(vals.map((v) => (v === from ? to : v))));
      await notion(`/pages/${page.id}`, "PATCH", {
        properties: {
          [prop]: type === "multi_select"
            ? { multi_select: next.map((n) => ({ name: n })) }
            : { select: { name: to } },
        },
      });
    } catch (e) {
      console.error("remap failed for", page.id, e);
      failed.push(titleOf(page) || page.id);
    }
  }
  return failed;
}

async function countUsage(db: any): Promise<Record<Prop, Record<string, number>>> {
  const counts: Record<Prop, Record<string, number>> = { typ: {}, stroj: {} };
  let cursor: string | undefined;
  let guard = 200;
  do {
    const data = await notion(`/databases/${FILES_DB_ID}/query`, "POST", {
      page_size: 100,
      start_cursor: cursor,
    });
    for (const page of data.results ?? []) {
      for (const prop of PROPS) {
        for (const v of new Set(valuesOf(page, prop))) counts[prop][v] = (counts[prop][v] ?? 0) + 1;
      }
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor && guard-- > 0);
  void db;
  return counts;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const getDb = schemaCache();
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action: string = body.action ?? "list";

    if (["add", "rename", "delete", "merge"].includes(action)) {
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
      } else if (action === "delete") {
        const target = opts.find((o) => o.id === String(body.id ?? ""));
        if (!target) throw new Error("Položka nebyla nalezena (mohla být mezitím změněna).");
        const used = await pagesWith(type, prop, target.name, 1);
        if (used.length > 0) {
          throw new Error(`Položku „${target.name}“ stále používají soubory – nelze ji smazat. Použijte Sloučit do…`);
        }
        await patchOptions(prop, type, opts.filter((o) => o.id !== target.id).map(keep));
      } else if (action === "merge") {
        const source = opts.find((o) => o.id === String(body.sourceId ?? ""));
        const target = opts.find((o) => o.id === String(body.targetId ?? ""));
        if (!source || !target) throw new Error("Zdrojová nebo cílová položka nebyla nalezena.");
        if (source.id === target.id) throw new Error("Položku nelze sloučit sama se sebou.");
        const failed = await remap(type, prop, source.name, target.name);
        if (failed.length) {
          throw new Error(
            `Sloučení nedokončeno – nepodařilo se přepsat ${failed.length} soubor(ů): ${failed.join(", ")}. Položka „${source.name}“ nebyla odstraněna.`,
          );
        }
        const after = optionsOf(await getDb(FILES_DB_ID, true), prop);
        await patchOptions(prop, type, after.filter((o) => o.id !== source.id).map(keep));
      } else {
        const id = String(body.id ?? "");
        const target = opts.find((o) => o.id === id);
        if (!target) throw new Error("Položka nebyla nalezena (mohla být mezitím změněna).");
        validate(name, opts, id);
        if (target.name !== name) {
          let renamed = false;
          try {
            await patchOptions(prop, type, opts.map((o) => (o.id === id ? { id, name, color: o.color } : keep(o))));
            const check = optionsOf(await getDb(FILES_DB_ID, true), prop);
            renamed = check.some((o) => o.id === id && o.name === name);
          } catch (e) {
            console.warn("native rename failed, using fallback:", e);
          }
          if (!renamed) {
            const fresh = optionsOf(await getDb(FILES_DB_ID, true), prop);
            if (!fresh.some((o) => o.name === name)) {
              await patchOptions(prop, type, [...fresh.map(keep), { name }]);
            }
            const failed = await remap(type, prop, target.name, name);
            if (failed.length) {
              throw new Error(
                `Přejmenování nedokončeno – nepodařilo se přepsat: ${failed.join(", ")}.`,
              );
            }
            const after = optionsOf(await getDb(FILES_DB_ID, true), prop);
            await patchOptions(prop, type, after.filter((o) => o.id !== id).map(keep));
          }
        }
      }
    } else if (action !== "list") {
      throw new Error(`Neznámá akce: ${action}`);
    }

    const db = await getDb(FILES_DB_ID, true);
    const withCounts = body.counts !== false;
    const counts = withCounts ? await countUsage(db) : { typ: {}, stroj: {} };
    const decorate = (prop: Prop) =>
      optionsOf(db, prop).map((o) => ({ ...o, count: (counts as any)[prop][o.name] ?? 0 }));
    return json({
      typ: decorate("typ"),
      stroj: decorate("stroj"),
      types: { typ: choiceType(db, "typ"), stroj: choiceType(db, "stroj") },
    });
  } catch (error: unknown) {
    console.error("notion-filter-options error:", error);
    return json({ error: error instanceof Error ? error.message : "Neznámá chyba" }, 500);
  }
});

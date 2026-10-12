// Shared Notion helpers (Notion-Version 2022-06-28).
export const NOTION_VERSION = "2022-06-28";
export const FILES_DB_ID = "3689450d-3d3f-8024-8801-fdd841839156";
export const FOLDERS_DB_ID = "29fb66d5-98b9-48da-b616-bcb81db5cd3c";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function notion(path: string, method = "GET", body?: unknown): Promise<any> {
  const key = Deno.env.get("NOTION_API_KEY");
  if (!key) throw new Error("NOTION_API_KEY není nastaven");
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Notion ${method} ${path} selhalo [${res.status}]: ${await res.text()}`);
  return res.json();
}

/** Per-request schema cache. */
export function schemaCache() {
  const cache = new Map<string, any>();
  return async (dbId: string, fresh = false) => {
    if (!fresh && cache.has(dbId)) return cache.get(dbId);
    const db = await notion(`/databases/${dbId}`);
    cache.set(dbId, db);
    return db;
  };
}

export type ChoiceType = "select" | "multi_select";

export function choiceType(db: any, prop: string): ChoiceType {
  const t = db?.properties?.[prop]?.type;
  return t === "multi_select" ? "multi_select" : "select";
}

export function toList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

/** Read select/multi_select page property as string[]. */
export function valuesOf(page: any, name: string): string[] {
  const props = page.properties ?? {};
  const key = Object.keys(props).find(
    (k) => k.toLowerCase().replace(/[_\s]/g, "") === name.toLowerCase().replace(/[_\s]/g, ""),
  );
  const p = key ? props[key] : undefined;
  if (!p) return [];
  if (p.type === "select") return p.select?.name ? [p.select.name] : [];
  if (p.type === "multi_select") return (p.multi_select ?? []).map((s: any) => s.name).filter(Boolean);
  return [];
}

export function choiceValue(type: ChoiceType, values: string[]) {
  if (type === "multi_select") return { multi_select: values.map((name) => ({ name })) };
  return { select: values[0] ? { name: values[0] } : null };
}

export function choiceFilter(type: ChoiceType, prop: string, value: string) {
  return type === "multi_select"
    ? { property: prop, multi_select: { contains: value } }
    : { property: prop, select: { equals: value } };
}

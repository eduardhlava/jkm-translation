import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const STROJ_OPTIONS = [
  "JCM", "JGS", "JGP", "JHA", "JHV", "JHP", "JHS", "JHI", "JHD", "JHC",
  "JCT", "JGT", "JGD", "JGC", "JCR", "JCC", "JAB", "JVR",
  "JCP", "JTE", "JMS", "JTU", "JCS", "JVE", "JVL", "JVC", "JTR",
];

export type FilterOption = { id: string; name: string; color?: string };
export type FilterOptionsData = { typ: FilterOption[]; stroj: FilterOption[] };

export const sortCs = (list: unknown[]) =>
  Array.from(new Set(list.flatMap((v) => (Array.isArray(v) ? v : [v])).filter(Boolean).map(String))).sort(
    (a, b) => a.localeCompare(b, "cs"),
  );

/** Normalize a value that may be a string (legacy select) or string[] (multi_select). */
export const asList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter(Boolean).map(String) : typeof v === "string" && v ? [v] : [];

export async function callFilterOptions(body: Record<string, unknown>): Promise<FilterOptionsData> {
  const { data, error } = await supabase.functions.invoke("notion-filter-options", { body });
  if ((data as any)?.error) throw new Error((data as any).error);
  if (error) {
    let msg = error.message;
    try {
      const ctx = (error as any).context;
      if (ctx?.json) msg = (await ctx.json())?.error ?? msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return { typ: (data as any)?.typ ?? [], stroj: (data as any)?.stroj ?? [] };
}

/** Options for pickers: typ from Notion, stroj = Notion ∪ STROJ_OPTIONS. */
export function useFilterOptions(enabled = true) {
  const [typ, setTyp] = useState<string[]>([]);
  const [stroj, setStroj] = useState<string[]>(sortCs(STROJ_OPTIONS));
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const d = await callFilterOptions({ action: "list" });
      setTyp(sortCs(d.typ.map((o) => o.name)));
      setStroj(sortCs([...d.stroj.map((o) => o.name), ...STROJ_OPTIONS]));
    } catch (e) {
      console.error("notion-filter-options:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) void reload();
  }, [enabled, reload]);

  return { typ, stroj, loading, reload };
}

import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { collectSymbolCodes } from "./symbolTokens";

export const SYMBOL_BUCKET = "symbols";

export interface SymbolRow {
  id: string;
  code: string;
  name: string;
  file_path: string;
  render_path: string | null;
  width_px: number;
  height_px: number;
  default_width_mm: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

// ---------- Knihovna (sdílená cache v paměti) ----------
let rows: SymbolRow[] = [];
let byCode = new Map<string, SymbolRow>();
let loaded = false;
let loading: Promise<SymbolRow[]> | null = null;
const listeners = new Set<() => void>();
let version = 0;
const emit = () => { version++; listeners.forEach((l) => l()); };

export async function loadSymbols(force = false): Promise<SymbolRow[]> {
  if (loaded && !force) return rows;
  if (loading && !force) return loading;
  loading = (async () => {
    const { data, error } = await supabase.from("symbols").select("*").order("name");
    loading = null;
    if (error) throw error;
    rows = (data ?? []).map((r: any) => ({ ...r, default_width_mm: Number(r.default_width_mm) || 20 }));
    byCode = new Map(rows.map((r) => [r.code, r]));
    loaded = true;
    emit();
    return rows;
  })();
  return loading;
}

export function getSymbol(code: string): SymbolRow | undefined { return byCode.get(code); }

export function useSymbols() {
  useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => version);
  useEffect(() => { void loadSymbols().catch(() => undefined); }, []);
  return { list: rows, byCode, loaded, reload: () => loadSymbols(true) };
}

// ---------- Podepsané URL (soukromé úložiště) ----------
const SIGN_SECONDS = 60 * 60;
const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const signed = new Map<string, { url: string; exp: number }>();
const pending = new Map<string, Promise<string | null>>();
let batch: string[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;
const batchWaiters = new Map<string, Array<(u: string | null) => void>>();

function flushBatch() {
  const paths = batch;
  batch = [];
  batchTimer = null;
  void (async () => {
    const { data } = await supabase.storage.from(SYMBOL_BUCKET).createSignedUrls(paths, SIGN_SECONDS);
    const exp = Date.now() + SIGN_SECONDS * 1000;
    const map = new Map<string, string>();
    (data ?? []).forEach((d: any) => { if (d.path && d.signedUrl) map.set(d.path, d.signedUrl); });
    for (const p of paths) {
      const url = map.get(p) ?? null;
      if (url) signed.set(p, { url, exp });
      pending.delete(p);
      (batchWaiters.get(p) ?? []).forEach((w) => w(url));
      batchWaiters.delete(p);
    }
  })();
}

export function cachedSignedUrl(path: string): string | null {
  const e = signed.get(path);
  return e && e.exp - Date.now() > REFRESH_MARGIN_MS ? e.url : null;
}

/** Dávkově podepsané URL, cache 1 h, obnova 5 min před vypršením. */
export function signedSymbolUrl(path: string): Promise<string | null> {
  const hit = cachedSignedUrl(path);
  if (hit) return Promise.resolve(hit);
  const p = pending.get(path);
  if (p) return p;
  const prom = new Promise<string | null>((resolve) => {
    const list = batchWaiters.get(path) ?? [];
    list.push(resolve);
    batchWaiters.set(path, list);
    batch.push(path);
    if (!batchTimer) batchTimer = setTimeout(flushBatch, 30);
  });
  pending.set(path, prom);
  return prom;
}

export function useSymbolUrl(row: SymbolRow | undefined): string | null {
  const path = row ? row.render_path || row.file_path : null;
  const [url, setUrl] = useState<string | null>(() => (path ? cachedSignedUrl(path) : null));
  useEffect(() => {
    if (!path) { setUrl(null); return; }
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      void signedSymbolUrl(path).then((u) => {
        if (!alive) return;
        setUrl(u);
        const e = signed.get(path);
        if (e) timer = setTimeout(run, Math.max(10_000, e.exp - Date.now() - REFRESH_MARGIN_MS + 1000));
      });
    };
    run();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [path]);
  return url;
}

// ---------- PDF: obrázky se vloží jako data URL před vykreslením ----------
export interface PdfSymbolAsset { src: string; ratio: number }
const pdfAssets = new Map<string, PdfSymbolAsset & { key: string }>();

export function pdfSymbolAsset(code: string): PdfSymbolAsset | undefined { return pdfAssets.get(code); }

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

/** Stáhne zmenšené verze všech symbolů použitých v blocích (jednou, s cache podle verze souboru). */
export async function preparePdfSymbols(blocks: Array<{ type: string; content: any }>): Promise<void> {
  const codes = collectSymbolCodes(blocks);
  if (!codes.size) return;
  try { await loadSymbols(); } catch { return; }
  await Promise.all([...codes].map(async (code) => {
    const row = byCode.get(code);
    if (!row) { pdfAssets.delete(code); return; }
    const path = row.render_path || row.file_path;
    const key = `${path}@${row.updated_at}`;
    if (pdfAssets.get(code)?.key === key) return;
    const { data, error } = await supabase.storage.from(SYMBOL_BUCKET).download(path);
    if (error || !data) return;
    const src = await blobToDataUrl(data.type === "image/png" || data.type === "image/jpeg" ? data : new Blob([data], { type: "image/png" }));
    const ratio = row.width_px > 0 && row.height_px > 0 ? row.width_px / row.height_px : 1;
    pdfAssets.set(code, { src, ratio, key });
  }));
}

/** Jen pro testy. */
export function __setPdfSymbolAsset(code: string, asset: PdfSymbolAsset | null) {
  if (asset) pdfAssets.set(code, { ...asset, key: "test" }); else pdfAssets.delete(code);
}

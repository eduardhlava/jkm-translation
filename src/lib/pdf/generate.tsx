import { pdf } from "@react-pdf/renderer";
import type { Block } from "@/components/BlockEditor/types";
import { DocumentPdf, type PageMap } from "./DocumentPdf";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const type = res.headers.get("Content-Type") || "image/png";
    return `data:${type};base64,${arrayBufferToBase64(buf)}`;
  } catch {
    return null;
  }
}

async function fetchAsDataUrl(url: string, pageId?: string): Promise<{ data: string | null; permanentUrl?: string }> {
  // 1) Direct fetch (Supabase Storage etc. with CORS).
  const direct = await urlToDataUrl(url);
  if (direct) return { data: direct };

  // 2) Proxy through edge function (handles non-CORS hosts while URL is still valid).
  const proxied = await urlToDataUrl(`${SUPABASE_URL}/functions/v1/image-proxy?url=${encodeURIComponent(url)}`);
  if (proxied) return { data: proxied };

  // 3) URL is likely expired (Notion S3 signed URL). Rehydrate via Notion API.
  if (pageId) {
    try {
      const { data, error } = await supabase.functions.invoke("refresh-image", { body: { url, pageId } });
      if (error) throw error;
      const freshUrl = (data as any)?.url as string | undefined;
      if (freshUrl) {
        const data2 = await urlToDataUrl(freshUrl);
        if (data2) return { data: data2, permanentUrl: freshUrl };
      }
    } catch (e) {
      console.warn("[pdf] refresh-image failed for", url, e);
    }
  }
  return { data: null };
}

async function inlineImages(blocks: Block[], pageId?: string): Promise<{ blocks: Block[]; rewrites: Map<string, string> }> {
  const cache = new Map<string, { data: string | null; permanentUrl?: string }>();
  const rewrites = new Map<string, string>();
  const out = await Promise.all(
    blocks.map(async (b) => {
      if (b.type !== "image") return b;
      const url: string | undefined = (b.content as any)?.url;
      if (!url || url.startsWith("data:")) return b;
      let entry = cache.get(url);
      if (!entry) {
        entry = await fetchAsDataUrl(url, pageId);
        cache.set(url, entry);
      }
      if (entry.permanentUrl) rewrites.set(url, entry.permanentUrl);
      if (!entry.data) return b;
      return { ...b, content: { ...b.content, url: entry.data } } as Block;
    }),
  );
  return { blocks: out, rewrites };
}

export async function generateDocumentPdf(
  title: string,
  blocks: Block[],
  options: { numberHeadings?: boolean; pageId?: string; onImagesRehydrated?: (rewrites: Map<string, string>) => void } = {},
): Promise<Blob> {
  const { numberHeadings, pageId, onImagesRehydrated } = options;
  const { blocks: prepared, rewrites } = await inlineImages(blocks, pageId);
  if (rewrites.size && onImagesRehydrated) onImagesRehydrated(rewrites);

  // Pass 1: render with the real TOC layout and collect the actual page numbers.
  const collector: PageMap = new Map();
  await pdf(
    <DocumentPdf
      title={title}
      blocks={prepared}
      includeToc
      pageMap={new Map()}
      collector={collector}
      numberHeadings={numberHeadings}
    />,
  ).toBlob();

  // Pass 2: final document with TOC
  return await pdf(
    <DocumentPdf
      title={title}
      blocks={prepared}
      includeToc
      pageMap={collector}
      numberHeadings={numberHeadings}
    />,
  ).toBlob();
}

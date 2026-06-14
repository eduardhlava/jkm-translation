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

async function fetchAsDataUrl(url: string): Promise<string | null> {
  // Try direct fetch first (works for CORS-enabled hosts like Supabase Storage).
  try {
    const res = await fetch(url);
    if (res.ok) {
      const buf = await res.arrayBuffer();
      const type = res.headers.get("Content-Type") || "image/png";
      return `data:${type};base64,${arrayBufferToBase64(buf)}`;
    }
  } catch {
    /* fall through to proxy */
  }
  // Fallback: edge function proxy (handles Notion S3 signed URLs without CORS).
  try {
    const proxyUrl = `${SUPABASE_URL}/functions/v1/image-proxy?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const type = res.headers.get("Content-Type") || "image/png";
    return `data:${type};base64,${arrayBufferToBase64(buf)}`;
  } catch (e) {
    console.warn("[pdf] image proxy failed for", url, e);
    return null;
  }
}

async function inlineImages(blocks: Block[]): Promise<Block[]> {
  const cache = new Map<string, string | null>();
  return await Promise.all(
    blocks.map(async (b) => {
      if (b.type !== "image") return b;
      const url: string | undefined = (b.content as any)?.url;
      if (!url || url.startsWith("data:")) return b;
      let data = cache.get(url);
      if (data === undefined) {
        data = await fetchAsDataUrl(url);
        cache.set(url, data);
      }
      if (!data) return b;
      return { ...b, content: { ...b.content, url: data } } as Block;
    }),
  );
}

export async function generateDocumentPdf(
  title: string,
  blocks: Block[],
  options: { numberHeadings?: boolean } = {},
): Promise<Blob> {
  const { numberHeadings } = options;
  const prepared = await inlineImages(blocks);

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

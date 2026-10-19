import type { Block } from "@/components/BlockEditor/types";
import type { DocumentMetadata } from "@/components/DocumentMetadata/types";

/** A stale or missing pagination snapshot prompts confirmation, not a disabled preview. */
export function isPaginationCurrent(fingerprint: string, paginatedSnapshot: string | null): boolean {
  return paginatedSnapshot !== null && fingerprint === paginatedSnapshot;
}

/**
 * Fingerprint obsahu relevantního pro layout PDF. URL obrázků se záměrně
 * ignorují (nahrazují se konstantou) – rehydratace dočasných Notion URL na
 * permanentní nemění layout a nesmí znovu zamknout náhled PDF. Obrázky jsou
 * identifikovány id bloku.
 */
export function layoutFingerprint(
  blocks: Block[],
  numberHeadings: boolean | undefined,
  metadata: DocumentMetadata | undefined,
): string {
  const stripped = blocks.map((b) => {
    if (b.type === "image") {
      return { ...b, content: { ...b.content, url: "" } };
    }
    if (b.type === "image-table" && b.content?.image) {
      return { ...b, content: { ...b.content, image: { ...b.content.image, url: "" } } };
    }
    return b;
  });
  return JSON.stringify({ blocks: stripped, numberHeadings, metadata });
}

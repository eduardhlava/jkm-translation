import { pdf } from "@react-pdf/renderer";
import type { Block } from "@/components/BlockEditor/types";
import { DocumentPdf } from "./DocumentPdf";
import { inlineImages, inlineMetadataAssets } from "./generate";
import type { DocumentMetadata } from "@/components/DocumentMetadata/types";

/**
 * Automatické stránkování dokumentu.
 *
 * Pravidla:
 *  - Před každým H1 (kromě prvního bloku a případu, kdy před ním už je konec
 *    stránky) se vloží automatický konec stránky.
 *  - H2/H3/H4 nesmí zůstat na spodku stránky s méně než KEEP_WITH_NEXT_PT
 *    prostorem pod sebou (cca 3 řádky textu). Detekce používá reálný layout
 *    react-pdf (measure režim DocumentPdf s minPresenceAhead).
 *  - Řetězce nadpisů (H2→H3→H4 bez obsahu mezi nimi) se řeší vložením konce
 *    stránky před PRVNÍ nadpis řetězce.
 *  - Nikdy nevkládáme konec stránky za jiný konec stránky ani jako první blok.
 *
 * Automatické konce stránky jsou běžné `pagebreak` bloky s content.auto = true;
 * při dalším spuštění se nejdřív odstraní a počítají se znovu. Ruční konce
 * stránky (bez příznaku auto) se nikdy nemažou.
 */

// Body text: 10.5pt × lineHeight 1.5 = 15.75pt na řádek → 3 řádky ≈ 47.25pt
export const KEEP_WITH_NEXT_PT = 3 * 10.5 * 1.5;

const MAX_ITERATIONS = 6;

const KEEP_WITH_NEXT_TYPES = new Set(["heading2", "heading3", "heading4"]);

function autoBreak(order: number): Block {
  return {
    id: crypto.randomUUID(),
    type: "pagebreak",
    template: "default",
    order,
    content: { auto: true },
  };
}

function renumber(blocks: Block[]): Block[] {
  return blocks.map((b, i) => ({ ...b, order: i }));
}

/** Odstraní všechny automatické konce stránky (ruční zůstávají) a přečísluje order. */
export function stripAutoBreaks(blocks: Block[]): Block[] {
  return renumber(blocks.filter((b) => !(b.type === "pagebreak" && b.content?.auto === true)));
}

/**
 * Pravidlo H1: před každý heading1 vloží automatický konec stránky, kromě
 * prvního bloku dokumentu a případu, kdy mu bezprostředně předchází pagebreak.
 */
export function applyH1Rule(blocks: Block[]): { blocks: Block[]; inserted: number } {
  const out: Block[] = [];
  let inserted = 0;
  for (const b of blocks) {
    if (b.type === "heading1" && out.length > 0 && out[out.length - 1].type !== "pagebreak") {
      out.push(autoBreak(0));
      inserted++;
    }
    out.push(b);
  }
  return { blocks: renumber(out), inserted };
}

/**
 * Vloží automatické konce stránky před nadpisy se zjištěným porušením
 * keep-with-next. Řetězce nadpisů (nadpisy bezprostředně za sebou) se řeší
 * vložením konce před první nadpis řetězce. Nikdy nevloží konec za jiný konec
 * ani jako první blok.
 */
export function insertBreaksBefore(
  blocks: Block[],
  violatingIds: Set<string>,
): { blocks: Block[]; inserted: number } {
  const targets = new Set<string>();
  for (const id of violatingIds) {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) continue;
    let first = idx;
    while (first - 1 >= 0 && blocks[first - 1].type.startsWith("heading")) first--;
    targets.add(blocks[first].id);
  }
  const out: Block[] = [];
  let inserted = 0;
  for (const b of blocks) {
    if (targets.has(b.id) && out.length > 0 && out[out.length - 1].type !== "pagebreak") {
      out.push(autoBreak(0));
      inserted++;
    }
    out.push(b);
  }
  return { blocks: renumber(out), inserted };
}

export interface ArrangeOptions {
  numberHeadings?: boolean;
  metadata?: DocumentMetadata;
  pageId?: string;
}

/**
 * Uspořádá stránkování dokumentu: odstraní staré automatické konce stránky,
 * aplikuje pravidlo H1 a iterativně měří reálný layout react-pdf, dokud
 * nezmizí všechna porušení keep-with-next (max MAX_ITERATIONS průchodů).
 */
export async function arrangePagination(
  blocks: Block[],
  options: ArrangeOptions = {},
): Promise<{ blocks: Block[]; inserted: number }> {
  const { numberHeadings, metadata, pageId } = options;

  let current = stripAutoBreaks(blocks);
  const h1 = applyH1Rule(current);
  current = h1.blocks;
  let inserted = h1.inserted;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    // Měření musí používat stejné inline obrázky jako reálné PDF, jinak by
    // se lišily výšky obrázků a tím i stránkování.
    const [{ blocks: prepared }, preparedMetadata] = await Promise.all([
      inlineImages(current, pageId),
      inlineMetadataAssets(metadata, pageId),
    ]);

    const headingPages = new Map<string, number>();
    const prevEndPages = new Map<string, number>();
    await pdf(
      <DocumentPdf
        title=""
        blocks={prepared}
        includeToc
        pageMap={new Map()}
        numberHeadings={numberHeadings}
        metadata={preparedMetadata}
        measure={{ keepWithNextPt: KEEP_WITH_NEXT_PT, headingPages, prevEndPages }}
      />,
    ).toBlob();

    const violations = new Set<string>();
    for (const b of prepared) {
      if (!KEEP_WITH_NEXT_TYPES.has(b.type)) continue;
      const headingPage = headingPages.get(b.id);
      const prevEndPage = prevEndPages.get(b.id);
      if (headingPage !== undefined && prevEndPage !== undefined && headingPage > prevEndPage) {
        violations.add(b.id);
      }
    }

    if (violations.size === 0) break;
    const res = insertBreaksBefore(current, violations);
    inserted += res.inserted;
    current = res.blocks;
  }

  return { blocks: current, inserted };
}

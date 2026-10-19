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
 *    react-pdf (measure režim DocumentPdf se sondou – minPresenceAhead se
 *    v naší struktuře ukázal jako nespolehlivý, ověřeno empiricky).
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

const MAX_ITERATIONS = 10;

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
 * Vloží automatické konce stránky před bloky se zjištěným porušením
 * (keep-with-next nadpisů nebo rozdělená tabulka). Je-li cílový blok
 * bezprostředně předcházen nadpisem či řetězcem nadpisů (bez obsahu mezi
 * nimi), konec se vloží před PRVNÍ nadpis řetězce, aby nadpisy zůstaly
 * spolu s obsahem. Nikdy nevloží konec za jiný konec ani jako první blok.
 * Vrací i mapu původní cílové id → id vloženého konce (pro případný revert).
 */
export function insertBreaksBefore(
  blocks: Block[],
  violatingIds: Set<string>,
): { blocks: Block[]; inserted: number; breaksByTarget: Map<string, string> } {
  const resolved = new Map<string, string>(); // původní cíl → id prvního bloku řetězce
  for (const id of violatingIds) {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) continue;
    let first = idx;
    while (first - 1 >= 0 && blocks[first - 1].type.startsWith("heading")) first--;
    resolved.set(id, blocks[first].id);
  }
  const out: Block[] = [];
  const breaksByTarget = new Map<string, string>();
  let inserted = 0;
  for (const b of blocks) {
    const targetsHere = [...resolved.entries()].filter(([, firstId]) => firstId === b.id).map(([targetId]) => targetId);
    if (targetsHere.length > 0 && out.length > 0 && out[out.length - 1].type !== "pagebreak") {
      const brk = autoBreak(0);
      out.push(brk);
      inserted++;
      for (const targetId of targetsHere) breaksByTarget.set(targetId, brk.id);
    }
    out.push(b);
  }
  return { blocks: renumber(out), inserted, breaksByTarget };
}

/**
 * Odebere konkrétní automatický konec stránky (revert pro tabulku delší než
 * stránka) a přečísluje order. Ostatní konce (auto i ruční) zůstávají.
 */
export function revertAutoBreak(blocks: Block[], breakId: string): Block[] {
  return renumber(blocks.filter((b) => !(b.id === breakId && b.type === "pagebreak" && b.content?.auto === true)));
}

export interface ArrangeOptions {
  numberHeadings?: boolean;
  metadata?: DocumentMetadata;
  pageId?: string;
}

/**
 * Namapuje aktuální bloky na jejich připravené (inline) verze podle id.
 * Nově vložené automatické konce stránky v prepared neexistují a projdou
 * beze změny.
 */
export function toPreparedBlocks(current: Block[], prepared: Block[]): Block[] {
  const byId = new Map(prepared.map((b) => [b.id, b]));
  return current.map((b) => byId.get(b.id) ?? b);
}

/** Aplikuje rehydratované (permanentní) URL obrázků na vracené bloky. */
export function applyImageRewrites(blocks: Block[], rewrites: Map<string, string>): Block[] {
  if (rewrites.size === 0) return blocks;
  return blocks.map((b) => {
    if (b.type === "image" && b.content?.url && rewrites.has(b.content.url)) {
      return { ...b, content: { ...b.content, url: rewrites.get(b.content.url) } };
    }
    if (b.type === "image-table" && b.content?.image?.url && rewrites.has(b.content.image.url)) {
      return { ...b, content: { ...b.content, image: { ...b.content.image, url: rewrites.get(b.content.image.url) } } };
    }
    return b;
  });
}

/**
 * Uspořádá stránkování dokumentu: odstraní staré automatické konce stránky,
 * aplikuje pravidlo H1 a iterativně měří reálný layout react-pdf, dokud
 * nezmizí všechna porušení keep-with-next (max MAX_ITERATIONS průchodů).
 *
 * Porušení keep-with-next nastává, když:
 *  - se pod nadpis H2/H3/H4 nevejde KEEP_WITH_NEXT_PT prostoru (sonda), NEBO
 *  - první obsahový blok za řetězcem nadpisů je nezalomitelný (obrázek,
 *    image-table, callout, text s piktogramem, spacer, první řádek tabulky)
 *    a odskočí na další stránku, takže nadpis zůstane na spodku stránky sám
 *    (nextStartPage > headingPage).
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

  // Obrázky inline JEDNOU před smyčkou – iterace jen vkládají konce stránky,
  // takže se inline verze mapují podle id (šetří síťové požadavky i
  // refresh-image volání). Měření musí používat stejné inline obrázky jako
  // reálné PDF, jinak by se lišily výšky obrázků a tím i stránkování.
  const [{ blocks: preparedBase, rewrites }, preparedMetadata] = await Promise.all([
    inlineImages(current, pageId),
    inlineMetadataAssets(metadata, pageId),
  ]);

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const prepared = toPreparedBlocks(current, preparedBase);

    const headingPages = new Map<string, number>();
    const prevEndPages = new Map<string, number>();
    const nextStartPages = new Map<string, number>();
    await pdf(
      <DocumentPdf
        title=""
        blocks={prepared}
        includeToc
        pageMap={new Map()}
        numberHeadings={numberHeadings}
        metadata={preparedMetadata}
        measure={{ keepWithNextPt: KEEP_WITH_NEXT_PT, headingPages, prevEndPages, nextStartPages }}
      />,
    ).toBlob();

    const violations = new Set<string>();
    for (const b of prepared) {
      if (!KEEP_WITH_NEXT_TYPES.has(b.type)) continue;
      const headingPage = headingPages.get(b.id);
      const prevEndPage = prevEndPages.get(b.id);
      if (headingPage !== undefined && prevEndPage !== undefined && headingPage > prevEndPage) {
        violations.add(b.id);
        continue;
      }
      const nextStartPage = nextStartPages.get(b.id);
      if (headingPage !== undefined && nextStartPage !== undefined && nextStartPage > headingPage) {
        violations.add(b.id);
      }
    }

    if (violations.size === 0) break;
    const res = insertBreaksBefore(current, violations);
    inserted += res.inserted;
    current = res.blocks;
  }

  return { blocks: applyImageRewrites(current, rewrites), inserted };
}

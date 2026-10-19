import { pdf } from "@react-pdf/renderer";
import type { Block } from "@/components/BlockEditor/types";
import { DocumentPdf } from "./DocumentPdf";
import { inlineImages, inlineMetadataAssets, loadLogoDataUrl } from "./generate";
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
 *  - Piktogram sám nebrání dělení obsahu: text je zalomitelný, obrázky si ponechají
 *    vlastní wrap={false} a tabulky se mohou dělit pouze mezi řádky.
 *  - Tabulka (ani tabulková část image-table) se nesmí lámat přes stránky –
 *    jinak se před ni vloží konec stránky. Tabulka delší než stránka se
 *    nepřesouvá (vložený konec se revertuje a tabulka se označí jako tooLong).
 *    Image-table nejprve přesune celý blok; pokud se tabulková část stále láme,
 *    nahradí vnější konec interním autoTableBreak před tabulkou. Teprve když
 *    se láme i na nové stránce, interní konec odstraní a označí tooLong.
 *  - Nikdy nevkládáme konec stránky za jiný konec stránky ani jako první blok.
 *
 * Automatické konce stránky jsou běžné `pagebreak` bloky s content.auto = true;
 * při dalším spuštění se nejdřív odstraní a počítají se znovu. Ruční konce
 * stránky (bez příznaku auto) se nikdy nemažou.
 */

// Body text: 10.5pt × lineHeight 1.5 = 15.75pt na řádek → 3 řádky ≈ 47.25pt
export const KEEP_WITH_NEXT_PT = 3 * 10.5 * 1.5;

const MAX_ITERATIONS = 80;
export const PAGINATION_BUILD_MARKER = "[paginate] v6";

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
  return renumber(blocks.filter((b) => !(b.type === "pagebreak" && b.content?.auto === true)).map((b) => {
    if (b.type !== "image-table") return b;
    const { autoTableBreak: _autoTableBreak, ...content } = b.content;
    return { ...b, content };
  }));
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
  return current.map((b) => {
    const preparedBlock = byId.get(b.id);
    if (!preparedBlock) return b;
    // Keep the once-inlined assets, but measure the CURRENT internal break.
    return { ...preparedBlock, order: b.order, content: { ...preparedBlock.content, autoTableBreak: b.content?.autoTableBreak } };
  });
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

export interface MeasureResult {
  headingPages: Map<string, number>;
  prevEndPages: Map<string, number>;
  nextStartPages: Map<string, number>;
  tableStartPages: Map<string, number>;
  tablePartStartPages: Map<string, number>;
  tableEndPages: Map<string, number>;
}

export type MeasureFn = (blocks: Block[]) => Promise<MeasureResult>;

export interface RemainingViolation {
  id: string;
  type: Block["type"];
  text: string;
}

/** Final verification never suppresses too-long tables or unfixable headings. */
export function collectRemaining(blocks: Block[], m: MeasureResult): RemainingViolation[] {
  const ids = new Set(findViolations(blocks, m, new Set()));
  return blocks.filter((b) => ids.has(b.id)).map((b) => ({
    id: b.id,
    type: b.type,
    text: b.type.startsWith("heading") ? (b.content?.text ?? "") : "Tabulka",
  }));
}

/**
 * Najde porušení v POŘADÍ DOKUMENTU (nadpis keep-with-next nebo rozdělená
 * tabulka). Vrací id bloků s porušením seřazené podle pořadí.
 */
export function findViolations(blocks: Block[], m: MeasureResult, tooLong: Set<string>): string[] {
  const out: string[] = [];
  for (const b of blocks) {
    if (KEEP_WITH_NEXT_TYPES.has(b.type)) {
      const hp = m.headingPages.get(b.id);
      const pe = m.prevEndPages.get(b.id);
      const ns = m.nextStartPages.get(b.id);
      if (hp !== undefined && ((pe !== undefined && hp > pe) || (ns !== undefined && ns > hp))) out.push(b.id);
      continue;
    }
    if ((b.type === "table" || b.type === "image-table") && !tooLong.has(b.id)) {
      const s = (b.type === "image-table" ? m.tablePartStartPages : m.tableStartPages).get(b.id);
      const e = m.tableEndPages.get(b.id);
      if (s !== undefined && e !== undefined && e > s) out.push(b.id);
    }
  }
  return out;
}

/**
 * Sekvenční smyčka: v každém průchodu se změří layout a vyřeší se jen PRVNÍ
 * porušení v pořadí dokumentu (vložení konce posune vše za ním, takže další
 * porušení by byla měřena na zastaralém layoutu). Obsah před vloženým koncem
 * se nemění, takže výsledek je přesný.
 */
export async function runPaginationLoop(
  start: Block[],
  measure: MeasureFn,
  opts: { maxIterations?: number; onProgress?: (pass: number) => void } = {},
): Promise<{ blocks: Block[]; inserted: number; tooLongTables: number; unresolved: number; passes: number; remaining: RemainingViolation[] }> {
  const max = opts.maxIterations ?? MAX_ITERATIONS;
  let current = start;
  let inserted = 0;
  const tooLong = new Set<string>();
  let pending: { tableId: string; stage: "whole" | "internal"; breakId?: string } | null = null;
  const setTableBreak = (id: string, enabled: boolean) => {
    current = current.map((b) => {
      if (b.id !== id) return b;
      const { autoTableBreak: _autoTableBreak, ...content } = b.content;
      return { ...b, content: enabled ? { ...content, autoTableBreak: true } : content };
    });
  };
  let passes = 0;

  for (;;) {
    if (passes >= max) {
      // Final verification below also runs when the safety limit is reached.
      break;
    }
    passes++;
    opts.onProgress?.(passes);
    const m = await measure(current);

    if (pending) {
      const { tableId, stage, breakId } = pending;
      pending = null;
      const target = current.find((b) => b.id === tableId);
      const isImageTable = target?.type === "image-table";
      const s = (isImageTable ? m.tablePartStartPages : m.tableStartPages).get(tableId);
      const e = m.tableEndPages.get(tableId);
      if (s !== undefined && e !== undefined && e > s) {
        if (breakId) {
          current = revertAutoBreak(current, breakId);
          inserted--;
        }
        if (isImageTable && stage === "whole") {
          setTableBreak(tableId, true);
          inserted++;
          pending = { tableId, stage: "internal" };
          continue; // Step B: remeasure the table starting on a fresh page.
        }
        if (stage === "internal") {
          setTableBreak(tableId, false);
          inserted--;
        }
        tooLong.add(tableId);
        continue; // přeměřit po revertu
      }
    }

    const violations = findViolations(current, m, tooLong);
    if (violations.length === 0) break;

    let handled = false;
    for (const id of violations) {
      const res = insertBreaksBefore(current, new Set([id]));
      if (res.inserted === 0) {
        // Already at the first block / after a break: Step A cannot add a break.
        // Image-table still needs Step B, not a premature tooLong classification.
        const tgt = current.find((b) => b.id === id);
        if (tgt?.type === "image-table") {
          setTableBreak(id, true);
          inserted++;
          pending = { tableId: id, stage: "internal" };
          handled = true;
          break;
        }
        if (tgt?.type === "table") tooLong.add(id);
        continue;
      }
      inserted += res.inserted;
      const tgt = current.find((b) => b.id === id);
      const brk = res.breaksByTarget.get(id);
      if (tgt && brk && (tgt.type === "table" || tgt.type === "image-table")) pending = { tableId: id, stage: "whole", breakId: brk };
      current = res.blocks;
      handled = true;
      break;
    }
    if (!handled) {
      break;
    }
  }
  // Always remeasure the returned layout, even after convergence or a revert.
  // Include problems that insertion guards and the tooLong skip could not fix.
  const remaining = collectRemaining(current, await measure(current));
  return { blocks: current, inserted, tooLongTables: tooLong.size, unresolved: remaining.length, passes, remaining };
}

export async function arrangePagination(
  blocks: Block[],
  options: ArrangeOptions & { onProgress?: (pass: number) => void } = {},
): Promise<{ blocks: Block[]; inserted: number; tooLongTables: number; unresolved: number; remaining: RemainingViolation[] }> {
  const { numberHeadings, metadata, pageId, onProgress } = options;

  const h1 = applyH1Rule(stripAutoBreaks(blocks));

  // Obrázky, metadata i logo inline JEDNOU před smyčkou.
  const [{ blocks: preparedBase, rewrites }, preparedMetadata, logoDataUrl] = await Promise.all([
    inlineImages(h1.blocks, pageId),
    inlineMetadataAssets(metadata, pageId),
    loadLogoDataUrl(),
  ]);

  const measure: MeasureFn = async (current) => {
    const m: MeasureResult = {
      headingPages: new Map(), prevEndPages: new Map(), nextStartPages: new Map(),
      tableStartPages: new Map(), tablePartStartPages: new Map(), tableEndPages: new Map(),
    };
    await pdf(
      <DocumentPdf
        title=""
        blocks={toPreparedBlocks(current, preparedBase)}
        includeToc
        pageMap={new Map()}
        numberHeadings={numberHeadings}
        metadata={preparedMetadata}
        logoDataUrl={logoDataUrl ?? undefined}
        measure={{ keepWithNextPt: KEEP_WITH_NEXT_PT, ...m }}
      />,
    ).toBlob();
    return m;
  };

  const res = await runPaginationLoop(h1.blocks, measure, { onProgress });
  const inserted = h1.inserted + res.inserted;
  console.info(PAGINATION_BUILD_MARKER, { passes: res.passes, inserted, tooLong: res.tooLongTables, unresolved: res.unresolved, remaining: res.remaining });
  return { blocks: applyImageRewrites(res.blocks, rewrites), inserted, tooLongTables: res.tooLongTables, unresolved: res.unresolved, remaining: res.remaining };
}

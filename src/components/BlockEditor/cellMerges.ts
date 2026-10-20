import type { CellMerge } from "./types";

/**
 * Slučování buněk v řádku tabulky. `rows` zůstávají obdélníkové pole stringů;
 * zakryté buňky (c+1 … c+span-1) mají prázdný obsah. Sloučení se ukládá do
 * Notion metadat bloku (serialize.ts), takže přežije round-trip.
 */

/** Odstraní neplatné, přesahující a překrývající se sloučení. */
export function normalizeMerges(merges: CellMerge[] | undefined, rows: string[][]): CellMerge[] {
  if (!Array.isArray(merges)) return [];
  const sorted = merges
    .filter((m) =>
      m &&
      Number.isInteger(m.r) && Number.isInteger(m.c) && Number.isInteger(m.span) &&
      m.r >= 0 && m.r < rows.length &&
      m.c >= 0 && m.span >= 2 &&
      m.c + m.span <= (rows[m.r]?.length ?? 0)
    )
    .map((m) => ({ r: m.r, c: m.c, span: m.span }))
    .sort((a, b) => a.r - b.r || a.c - b.c);
  const out: CellMerge[] = [];
  for (const m of sorted) {
    const overlaps = out.some(
      (o) => o.r === m.r && m.c < o.c + o.span && o.c < m.c + m.span
    );
    if (!overlaps) out.push(m);
  }
  return out;
}

/** Sloučení, které na buňce (r, c) ZAČÍNÁ (anchor), nebo null. */
export function mergeAt(merges: CellMerge[], r: number, c: number): CellMerge | null {
  return merges.find((m) => m.r === r && m.c === c) ?? null;
}

/** Sloučení, které buňku (r, c) ZAKRÝVÁ (není to anchor), nebo null. */
export function coveredBy(merges: CellMerge[], r: number, c: number): CellMerge | null {
  return merges.find((m) => m.r === r && c > m.c && c < m.c + m.span) ?? null;
}

/**
 * Sloučí buňku (r, c) s buňkou vpravo; pokud je vpravo sloučená skupina,
 * připojí se celá. Texty se spojí na nové řádky, zakryté buňky se vyprázdní.
 */
export function mergeCellsRight(
  rows: string[][],
  merges: CellMerge[],
  r: number,
  c: number
): { rows: string[][]; merges: CellMerge[] } {
  const row = rows[r];
  if (!row) return { rows, merges };
  const anchor = mergeAt(merges, r, c);
  const leftSpan = anchor?.span ?? 1;
  const nextC = c + leftSpan;
  if (nextC >= row.length) return { rows, merges };
  const right = mergeAt(merges, r, nextC);
  const rightSpan = right?.span ?? 1;
  const span = leftSpan + rightSpan;

  const parts: string[] = [];
  for (let i = c; i < c + span; i++) {
    const t = row[i];
    if (t && t.trim()) parts.push(t);
  }
  const nextRows = rows.map((rw, ri) =>
    ri !== r
      ? rw
      : rw.map((cell, ci) => {
          if (ci === c) return parts.join("\n");
          if (ci > c && ci < c + span) return "";
          return cell;
        })
  );
  const nextMerges = normalizeMerges(
    [...merges.filter((m) => m !== anchor && m !== right), { r, c, span }],
    nextRows
  );
  return { rows: nextRows, merges: nextMerges };
}

/** Zruší sloučení začínající na (r, c); obsah zůstává v první buňce. */
export function unmergeCell(
  rows: string[][],
  merges: CellMerge[],
  r: number,
  c: number
): { rows: string[][]; merges: CellMerge[] } {
  return { rows, merges: merges.filter((m) => !(m.r === r && m.c === c)) };
}

/** Vložení sloupce před index `idx`: sloučení uvnitř se rozšíří, za ním se posune. */
export function remapInsertColumn(merges: CellMerge[], idx: number): CellMerge[] {
  return merges.map((m) => {
    if (idx <= m.c) return { ...m, c: m.c + 1 };
    if (idx < m.c + m.span) return { ...m, span: m.span + 1 };
    return m;
  });
}

/** Smazání sloupce `idx`: sloučení se zúží; span < 2 → sloučení zaniká. */
export function remapDeleteColumn(merges: CellMerge[], idx: number): CellMerge[] {
  const out: CellMerge[] = [];
  for (const m of merges) {
    if (idx < m.c) out.push({ ...m, c: m.c - 1 });
    else if (idx >= m.c + m.span) out.push(m);
    else if (m.span - 1 >= 2) out.push({ ...m, span: m.span - 1 });
    // span-1 < 2 → sloučení zaniká
  }
  return out;
}

/** Vložení řádku před index `idx`. */
export function remapInsertRow(merges: CellMerge[], idx: number): CellMerge[] {
  return merges.map((m) => (m.r >= idx ? { ...m, r: m.r + 1 } : m));
}

/** Smazání řádku `idx`: sloučení v něm zanikají, další se posunou. */
export function remapDeleteRow(merges: CellMerge[], idx: number): CellMerge[] {
  const out: CellMerge[] = [];
  for (const m of merges) {
    if (m.r === idx) continue;
    out.push(m.r > idx ? { ...m, r: m.r - 1 } : m);
  }
  return out;
}

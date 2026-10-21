import type { CellMerge } from "./types";

/**
 * Slučování buněk tabulky jako obdélníky: (r, c) je levá horní (anchor) buňka,
 * `span` = počet sloupců, `rowSpan` = počet řádků (výchozí 1). `rows` zůstávají
 * obdélníkové pole stringů; zakryté buňky mají prázdný obsah. Sloučení se ukládá
 * do Notion metadat bloku (serialize.ts), takže přežije round-trip.
 */

export const rowSpanOf = (m: CellMerge): number => m.rowSpan ?? 1;

function clean(r: number, c: number, span: number, rowSpan: number): CellMerge {
  return rowSpan > 1 ? { r, c, span, rowSpan } : { r, c, span };
}
function isValidSize(span: number, rowSpan: number) {
  return span >= 1 && rowSpan >= 1 && (span >= 2 || rowSpan >= 2);
}
function intersects(a: CellMerge, b: CellMerge) {
  return a.r < b.r + rowSpanOf(b) && b.r < a.r + rowSpanOf(a) && a.c < b.c + b.span && b.c < a.c + a.span;
}

/** Odstraní neplatné, přesahující a překrývající se sloučení. */
export function normalizeMerges(merges: CellMerge[] | undefined, rows: string[][]): CellMerge[] {
  if (!Array.isArray(merges)) return [];
  const sorted = merges
    .filter((m) => {
      if (!m || !Number.isInteger(m.r) || !Number.isInteger(m.c) || !Number.isInteger(m.span)) return false;
      const rs = m.rowSpan === undefined ? 1 : m.rowSpan;
      if (!Number.isInteger(rs)) return false;
      if (!isValidSize(m.span, rs) || m.r < 0 || m.c < 0) return false;
      if (m.r + rs > rows.length) return false;
      for (let i = m.r; i < m.r + rs; i++) if (m.c + m.span > (rows[i]?.length ?? 0)) return false;
      return true;
    })
    .map((m) => clean(m.r, m.c, m.span, m.rowSpan ?? 1))
    .sort((a, b) => a.r - b.r || a.c - b.c);
  const out: CellMerge[] = [];
  for (const m of sorted) if (!out.some((o) => intersects(o, m))) out.push(m);
  return out;
}

/** Sloučení, které na buňce (r, c) ZAČÍNÁ (anchor), nebo null. */
export function mergeAt(merges: CellMerge[], r: number, c: number): CellMerge | null {
  return merges.find((m) => m.r === r && m.c === c) ?? null;
}

/** Sloučení, které buňku (r, c) ZAKRÝVÁ (není to anchor), nebo null. */
export function coveredBy(merges: CellMerge[], r: number, c: number): CellMerge | null {
  return merges.find((m) =>
    r >= m.r && r < m.r + rowSpanOf(m) && c >= m.c && c < m.c + m.span && !(r === m.r && c === m.c)
  ) ?? null;
}

/** Jakékoli sloučení, které buňku obsahuje (anchor i zakrytou). */
function containing(merges: CellMerge[], r: number, c: number): CellMerge | null {
  return merges.find((m) => r >= m.r && r < m.r + rowSpanOf(m) && c >= m.c && c < m.c + m.span) ?? null;
}

/** Obdélník buňky (r, c): její sloučení, nebo 1×1. */
function rectOf(merges: CellMerge[], r: number, c: number): CellMerge {
  return mergeAt(merges, r, c) ?? { r, c, span: 1 };
}

export type MergeCheck = { ok: true; target: CellMerge; reason?: undefined } | { ok: false; target?: undefined; reason?: string };
export const MERGE_WIDTH_MISMATCH = "Nelze sloučit – nesouhlasí šířka buněk";
export const MERGE_HEIGHT_MISMATCH = "Nelze sloučit – nesouhlasí výška buněk";
export const MERGE_HEADER = "Hlavičku nelze sloučit s tělem tabulky";

/**
 * Najde sousední skupinu (r0..r0+h-1 × c0..c0+w-1): buď existující sloučení
 * přesně v tomto pásu (rozměr podél pásu se musí shodovat), nebo volné buňky
 * tloušťky 1. Vrací rozměr ve směru slučování.
 */
function neighbour(merges: CellMerge[], dir: "right" | "down", a: CellMerge): { ok: true; size: number } | { ok: false } {
  const rs = rowSpanOf(a);
  const r0 = dir === "right" ? a.r : a.r + rs;
  const c0 = dir === "right" ? a.c + a.span : a.c;
  const anchor = mergeAt(merges, r0, c0);
  if (anchor) {
    if (dir === "right" ? rowSpanOf(anchor) === rs : anchor.span === a.span) {
      return { ok: true, size: dir === "right" ? anchor.span : rowSpanOf(anchor) };
    }
    return { ok: false };
  }
  const len = dir === "right" ? rs : a.span;
  for (let i = 0; i < len; i++) {
    const rr = dir === "right" ? r0 + i : r0;
    const cc = dir === "right" ? c0 : c0 + i;
    if (containing(merges, rr, cc)) return { ok: false };
  }
  return { ok: true, size: 1 };
}

export function canMergeRight(rows: string[][], merges: CellMerge[], r: number, c: number): MergeCheck {
  const a = rectOf(merges, r, c);
  const cols = rows[r]?.length ?? 0;
  if (a.c + a.span >= cols) return { ok: false };
  const n = neighbour(merges, "right", a);
  if (!n.ok) return { ok: false, reason: rowSpanOf(a) > 1 ? MERGE_HEIGHT_MISMATCH : MERGE_WIDTH_MISMATCH };
  return { ok: true, target: clean(a.r, a.c, a.span + n.size, rowSpanOf(a)) };
}

export function canMergeDown(rows: string[][], merges: CellMerge[], r: number, c: number, headerRow = false): MergeCheck {
  const a = rectOf(merges, r, c);
  const rs = rowSpanOf(a);
  if (a.r + rs >= rows.length) return { ok: false };
  if (headerRow && a.r === 0) return { ok: false, reason: MERGE_HEADER };
  const n = neighbour(merges, "down", a);
  if (!n.ok) return { ok: false, reason: MERGE_WIDTH_MISMATCH };
  return { ok: true, target: clean(a.r, a.c, a.span, rs + n.size) };
}

/** Použije nový obdélník: texty se spojí (po řádcích) do anchoru, zakryté se vyprázdní. */
function applyRect(rows: string[][], merges: CellMerge[], t: CellMerge) {
  const rs = rowSpanOf(t);
  const parts: string[] = [];
  for (let i = t.r; i < t.r + rs; i++) {
    for (let j = t.c; j < t.c + t.span; j++) {
      const v = rows[i]?.[j];
      if (v && v.trim()) parts.push(v);
    }
  }
  const nextRows = rows.map((rw, ri) =>
    ri < t.r || ri >= t.r + rs
      ? rw
      : rw.map((cell, ci) => {
          if (ci < t.c || ci >= t.c + t.span) return cell;
          return ri === t.r && ci === t.c ? parts.join("\n") : "";
        })
  );
  const nextMerges = normalizeMerges([...merges.filter((m) => !intersects(m, t)), t], nextRows);
  return { rows: nextRows, merges: nextMerges };
}

/** Sloučí buňku (r, c) se skupinou vpravo (stejně vysokou). */
export function mergeCellsRight(rows: string[][], merges: CellMerge[], r: number, c: number) {
  const check = canMergeRight(rows, merges, r, c);
  if (!check.ok) return { rows, merges };
  return applyRect(rows, merges, check.target);
}

/** Sloučí buňku (r, c) se skupinou pod ní (stejně širokou). */
export function mergeCellsDown(rows: string[][], merges: CellMerge[], r: number, c: number, headerRow = false) {
  const check = canMergeDown(rows, merges, r, c, headerRow);
  if (!check.ok) return { rows, merges };
  return applyRect(rows, merges, check.target);
}

/** Zruší sloučení začínající na (r, c); obsah zůstává v první buňce. */
export function unmergeCell(rows: string[][], merges: CellMerge[], r: number, c: number) {
  return { rows, merges: merges.filter((m) => !(m.r === r && m.c === c)) };
}

function keep(out: CellMerge[], r: number, c: number, span: number, rs: number) {
  if (isValidSize(span, rs)) out.push(clean(r, c, span, rs));
}

/** Vložení sloupce před index `idx`: sloučení uvnitř se rozšíří, za ním se posune. */
export function remapInsertColumn(merges: CellMerge[], idx: number): CellMerge[] {
  return merges.map((m) => {
    if (idx <= m.c) return { ...m, c: m.c + 1 };
    if (idx < m.c + m.span) return { ...m, span: m.span + 1 };
    return m;
  });
}

/** Smazání sloupce `idx`: sloučení se zúží; rozměr 1×1 → zaniká. */
export function remapDeleteColumn(merges: CellMerge[], idx: number): CellMerge[] {
  const out: CellMerge[] = [];
  for (const m of merges) {
    if (idx < m.c) out.push({ ...m, c: m.c - 1 });
    else if (idx >= m.c + m.span) out.push(m);
    else keep(out, m.r, m.c, m.span - 1, rowSpanOf(m));
  }
  return out;
}

/** Vložení řádku před index `idx`: uvnitř svislého sloučení ho zvětší. */
export function remapInsertRow(merges: CellMerge[], idx: number): CellMerge[] {
  return merges.map((m) => {
    if (idx <= m.r) return { ...m, r: m.r + 1 };
    if (idx < m.r + rowSpanOf(m)) return clean(m.r, m.c, m.span, rowSpanOf(m) + 1);
    return m;
  });
}

/** Smazání řádku `idx`: sloučení se zmenší, 1×1 zaniká, další se posunou. */
export function remapDeleteRow(merges: CellMerge[], idx: number): CellMerge[] {
  const out: CellMerge[] = [];
  for (const m of merges) {
    const rs = rowSpanOf(m);
    if (idx < m.r) out.push({ ...m, r: m.r - 1 });
    else if (idx >= m.r + rs) out.push(m);
    else keep(out, m.r, m.c, m.span, rs - 1);
  }
  return out;
}

/**
 * Smaže řádek včetně přepočtu sloučení. Když se maže řádek s anchorem svislého
 * sloučení, obsah anchoru se přesune do nového prvního řádku sloučení.
 */
export function deleteRowWithMerges(rows: string[][], merges: CellMerge[], idx: number) {
  const moved = rows.map((r) => [...r]);
  for (const m of merges) {
    if (m.r === idx && rowSpanOf(m) > 1 && moved[idx + 1]) moved[idx + 1][m.c] = moved[idx][m.c];
  }
  return { rows: moved.filter((_, i) => i !== idx), merges: remapDeleteRow(merges, idx) };
}

/** Pojistka po importu: zakrytá buňka s textem sloučení ruší. */
export function coveredCellsEmpty(rows: string[][], m: CellMerge): boolean {
  for (let i = m.r; i < m.r + rowSpanOf(m); i++) {
    for (let j = m.c; j < m.c + m.span; j++) {
      if (i === m.r && j === m.c) continue;
      const v = rows[i]?.[j];
      if (v && v.trim()) return false;
    }
  }
  return true;
}

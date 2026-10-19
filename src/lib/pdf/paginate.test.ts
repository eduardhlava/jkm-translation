import { describe, it, expect } from "vitest";
import { stripAutoBreaks, applyH1Rule, insertBreaksBefore, toPreparedBlocks, applyImageRewrites, revertAutoBreak, KEEP_WITH_NEXT_PT } from "./paginate";
import type { Block, BlockType } from "@/components/BlockEditor/types";

let seq = 0;
function blk(type: BlockType, content: any = {}): Block {
  return { id: `b${++seq}`, type, template: "default", order: 0, content };
}
function list(...blocks: Block[]): Block[] {
  return blocks.map((b, i) => ({ ...b, order: i }));
}

describe("stripAutoBreaks", () => {
  it("odstraní automatické konce stránky a zachová ruční", () => {
    const blocks = list(
      blk("text", { html: "a" }),
      blk("pagebreak", { auto: true }),
      blk("pagebreak", {}),
      blk("text", { html: "b" }),
    );
    const out = stripAutoBreaks(blocks);
    expect(out.map((b) => b.type)).toEqual(["text", "pagebreak", "text"]);
    expect(out[1].content.auto).toBeUndefined();
    expect(out.map((b) => b.order)).toEqual([0, 1, 2]);
  });

  it("přečísluje order po odstranění", () => {
    const blocks = list(blk("pagebreak", { auto: true }), blk("heading1", { text: "A" }));
    const out = stripAutoBreaks(blocks);
    expect(out).toHaveLength(1);
    expect(out[0].order).toBe(0);
  });
});

describe("applyH1Rule", () => {
  it("vloží konec stránky před každý H1 uprostřed dokumentu", () => {
    const blocks = list(
      blk("text", { html: "x" }),
      blk("heading1", { text: "A" }),
      blk("text", { html: "y" }),
      blk("heading1", { text: "B" }),
    );
    const { blocks: out, inserted } = applyH1Rule(blocks);
    expect(inserted).toBe(2);
    expect(out.map((b) => b.type)).toEqual(["text", "pagebreak", "heading1", "text", "pagebreak", "heading1"]);
    expect(out[1].content.auto).toBe(true);
  });

  it("nevloží konec před první blok dokumentu", () => {
    const blocks = list(blk("heading1", { text: "A" }), blk("text", { html: "x" }));
    const { inserted } = applyH1Rule(blocks);
    expect(inserted).toBe(0);
  });

  it("nevyrobí dva konce stránky za sebou", () => {
    const blocks = list(
      blk("text", { html: "x" }),
      blk("pagebreak", {}),
      blk("heading1", { text: "A" }),
    );
    const { inserted } = applyH1Rule(blocks);
    expect(inserted).toBe(0);
  });
});

describe("insertBreaksBefore", () => {
  it("vloží konec před nadpis s porušením", () => {
    const blocks = list(blk("text", { html: "x" }), blk("heading2", { text: "A" }), blk("text", { html: "y" }));
    const { blocks: out, inserted } = insertBreaksBefore(blocks, new Set([blocks[1].id]));
    expect(inserted).toBe(1);
    expect(out.map((b) => b.type)).toEqual(["text", "pagebreak", "heading2", "text"]);
  });

  it("řetězec nadpisů: konec se vloží před první nadpis řetězce", () => {
    const blocks = list(
      blk("text", { html: "x" }),
      blk("heading2", { text: "A" }),
      blk("heading3", { text: "B" }),
      blk("heading4", { text: "C" }),
      blk("text", { html: "y" }),
    );
    const { blocks: out, inserted } = insertBreaksBefore(blocks, new Set([blocks[3].id]));
    expect(inserted).toBe(1);
    expect(out.map((b) => b.type)).toEqual(["text", "pagebreak", "heading2", "heading3", "heading4", "text"]);
  });

  it("nevloží konec za jiný konec stránky ani jako první blok", () => {
    const blocks = list(blk("pagebreak", {}), blk("heading2", { text: "A" }));
    const { inserted } = insertBreaksBefore(blocks, new Set([blocks[1].id]));
    expect(inserted).toBe(0);

    const first = list(blk("heading2", { text: "A" }), blk("text", { html: "x" }));
    expect(insertBreaksBefore(first, new Set([first[0].id])).inserted).toBe(0);
  });

  it("ignoruje neznámá id", () => {
    const blocks = list(blk("text", { html: "x" }));
    expect(insertBreaksBefore(blocks, new Set(["nope"])).inserted).toBe(0);
  });
});

describe("KEEP_WITH_NEXT_PT", () => {
  it("odpovídá 3 řádkům základního textu (10.5pt × 1.5)", () => {
    expect(KEEP_WITH_NEXT_PT).toBeCloseTo(47.25, 2);
  });
});

describe("toPreparedBlocks", () => {
  it("namapuje bloky podle id na prepared verze a zachová nové auto konce stránky", () => {
    const t = blk("text", { html: "a" });
    const auto = blk("pagebreak", { auto: true });
    const current = list(t, auto);
    const prepared = [{ ...t, content: { html: "a", _inlined: true } }];
    const out = toPreparedBlocks(current, prepared);
    expect(out[0].content._inlined).toBe(true);
    expect(out[1].id).toBe(auto.id);
    expect(out[1].content.auto).toBe(true);
  });
});

describe("applyImageRewrites", () => {
  it("přepíše URL obrázku i image-table podle rewrites", () => {
    const img = blk("image", { url: "old", alt: "a" });
    const it_ = blk("image-table", { image: { url: "old2", alt: "" }, table: { headerRow: true, rows: [] } });
    const txt = blk("text", { html: "x" });
    const rw = new Map([["old", "new"], ["old2", "new2"]]);
    const out = applyImageRewrites(list(img, it_, txt), rw);
    expect(out[0].content.url).toBe("new");
    expect(out[1].content.image.url).toBe("new2");
    expect(out[2].content.html).toBe("x");
  });

  it("bez rewrites vrátí bloky beze změny", () => {
    const blocks = list(blk("image", { url: "old" }));
    expect(applyImageRewrites(blocks, new Map())).toBe(blocks);
  });
});

describe("insertBreaksBefore – cíl tabulka", () => {
  it("řetězec H2→H3→tabulka: konec se vloží před H2", () => {
    const h2 = blk("heading2", { text: "A" });
    const h3 = blk("heading3", { text: "B" });
    const tbl = blk("table", { headerRow: true, rows: [["a"]] });
    const blocks = list(blk("text", { html: "x" }), h2, h3, tbl);
    const { blocks: out, inserted, breaksByTarget } = insertBreaksBefore(blocks, new Set([tbl.id]));
    expect(inserted).toBe(1);
    expect(out.map((b) => b.type)).toEqual(["text", "pagebreak", "heading2", "heading3", "table"]);
    expect(breaksByTarget.get(tbl.id)).toBe(out[1].id);
  });

  it("nevloží konec, když je tabulka první blok nebo za ní už je konec stránky", () => {
    const tbl1 = blk("table", { headerRow: true, rows: [["a"]] });
    const first = insertBreaksBefore(list(tbl1), new Set([tbl1.id]));
    expect(first.inserted).toBe(0);
    expect(first.blocks.map((b) => b.type)).toEqual(["table"]);

    const tbl2 = blk("table", { headerRow: true, rows: [["a"]] });
    const afterBreak = insertBreaksBefore(list(blk("pagebreak", {}), tbl2), new Set([tbl2.id]));
    expect(afterBreak.inserted).toBe(0);
    expect(afterBreak.blocks.map((b) => b.type)).toEqual(["pagebreak", "table"]);
  });
});

describe("revertAutoBreak", () => {
  it("odebere jen zadaný auto konec a ostatní konce zachová", () => {
    const auto1 = blk("pagebreak", { auto: true });
    const auto2 = blk("pagebreak", { auto: true });
    const manual = blk("pagebreak", {});
    const blocks = list(blk("text", { html: "a" }), auto1, blk("table", { rows: [["x"]] }), auto2, manual, blk("text", { html: "b" }));
    const out = revertAutoBreak(blocks, auto1.id);
    expect(out.map((b) => b.id)).toEqual([blocks[0].id, blocks[2].id, auto2.id, manual.id, blocks[5].id]);
    expect(out.map((b) => b.order)).toEqual([0, 1, 2, 3, 4]);
  });

  it("neodstraní ruční konec stránky ani cizí blok se stejným id typu", () => {
    const manual = blk("pagebreak", {});
    const blocks = list(manual, blk("text", { html: "a" }));
    const out = revertAutoBreak(blocks, manual.id);
    expect(out).toHaveLength(2);
  });
});

import { runPaginationLoop, type MeasureResult } from "./paginate";

/** Jednoduchý simulovaný layout: stránka 100 jednotek, výška v content.h. */
function fakeMeasure(blocks: Block[]): Promise<MeasureResult> {
  const PAGE = 100;
  const m: MeasureResult = { headingPages: new Map(), prevEndPages: new Map(), nextStartPages: new Map(), tableStartPages: new Map(), tableEndPages: new Map() };
  let page = 1, y = 0;
  let chain: string[] = [];
  for (const b of blocks) {
    if (b.type === "pagebreak") { if (y > 0) { page++; y = 0; } continue; }
    const h = b.content.h ?? 10;
    const isH = b.type.startsWith("heading");
    if (isH) {
      m.prevEndPages.set(b.id, page);
      if (y + h > PAGE) { page++; y = 0; }
      m.headingPages.set(b.id, page);
      y += h;
      chain.push(b.id);
      continue;
    }
    if (b.type === "table") {
      m.tableStartPages.set(b.id, page);
      for (const id of chain) m.nextStartPages.set(id, page);
      y += h;
      while (y > PAGE) { page++; y -= PAGE; }
      m.tableEndPages.set(b.id, page);
    } else {
      if (y + h > PAGE) { page++; y = 0; } // nezalomitelný blok
      for (const id of chain) m.nextStartPages.set(id, page);
      y += h;
    }
    chain = [];
  }
  return Promise.resolve(m);
}

describe("runPaginationLoop (sekvenční)", () => {
  it("posun po prvním konci odstraní pozdější falešné porušení a vyřeší skutečná", async () => {
    // t1 60, tabulka A 50 (rozdělená 1/2), t2 30, tabulka B 50.
    // Při hromadném vkládání by se B (na staré pozici rozdělená) zbytečně posunula.
    const A = blk("table", { h: 50 });
    const B = blk("table", { h: 50 });
    const blocks = list(blk("text", { h: 60 }), A, blk("text", { h: 30 }), B);
    const before = await fakeMeasure(blocks);
    expect(before.tableEndPages.get(B.id)! > before.tableStartPages.get(B.id)!).toBe(true);
    const res = await runPaginationLoop(blocks, fakeMeasure);
    expect(res.inserted).toBe(1);
    const after = await fakeMeasure(res.blocks);
    expect(after.tableEndPages.get(A.id)).toBe(after.tableStartPages.get(A.id));
    expect(after.tableEndPages.get(B.id)).toBe(after.tableStartPages.get(B.id));
    expect(res.unresolved).toBe(0);
  });

  it("tabulka delší než stránka se revertuje a označí tooLong", async () => {
    const T = blk("table", { h: 150 });
    const res = await runPaginationLoop(list(blk("text", { h: 50 }), T), fakeMeasure);
    expect(res.inserted).toBe(0);
    expect(res.tooLongTables).toBe(1);
    expect(res.blocks.some((b) => b.type === "pagebreak")).toBe(false);
  });

  it("nadpis s obrázkem, který odskočí, se přesune s ním", async () => {
    const h = blk("heading2", { h: 5 });
    const res = await runPaginationLoop(list(blk("text", { h: 80 }), h, blk("image", { h: 40 })), fakeMeasure);
    expect(res.blocks.map((b) => b.type)).toEqual(["text", "pagebreak", "heading2", "image"]);
  });

  it("při dosažení limitu vrátí počet nevyřešených", async () => {
    const blocks = list(blk("text", { h: 60 }), blk("table", { h: 50 }), blk("text", { h: 60 }), blk("table", { h: 50 }));
    const res = await runPaginationLoop(blocks, fakeMeasure, { maxIterations: 1 });
    expect(res.unresolved).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from "vitest";
import { stripAutoBreaks, applyH1Rule, insertBreaksBefore, KEEP_WITH_NEXT_PT } from "./paginate";
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

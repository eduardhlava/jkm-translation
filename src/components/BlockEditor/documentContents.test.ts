import { describe, expect, it } from "vitest";
import { buildDocumentContents } from "./documentContents";
import type { Block, BlockType } from "./types";

const block = (id: string, type: BlockType, order: number, text = id, unlisted = false): Block => ({ id, type, order, template: "default", content: { text, unlisted } });

describe("document contents", () => {
  it("includes only H1–H3 in block order", () => {
    const result = buildDocumentContents([block("h3", "heading3", 3), block("h4", "heading4", 4), block("h1", "heading1", 0), block("text", "text", 1), block("h2", "heading2", 2)], false);
    expect(result.map(({ id, level }) => [id, level])).toEqual([["h1", 1], ["h2", 2], ["h3", 3]]);
  });
  it("uses editor numbering for H1–H3", () => {
    const blocks = [block("a", "heading1", 0), block("b", "heading2", 1), block("c", "heading3", 2), block("d", "heading1", 3)];
    expect(buildDocumentContents(blocks, true).map((item) => item.number)).toEqual(["1", "1.1", "1.1.1", "2"]);
    expect(buildDocumentContents(blocks, false).map((item) => item.number)).toEqual([undefined, undefined, undefined, undefined]);
  });
  it("keeps unlisted headings without numbering and does not count them", () => {
    expect(buildDocumentContents([block("a", "heading1", 0), block("u", "heading1", 1, "Unlisted", true), block("b", "heading1", 2)], true).map(({ id, number, unlisted }) => ({ id, number, unlisted }))).toEqual([
      { id: "a", number: "1", unlisted: false }, { id: "u", number: undefined, unlisted: true }, { id: "b", number: "2", unlisted: false },
    ]);
  });
  it("uses the unnamed fallback for empty and whitespace headings", () => {
    expect(buildDocumentContents([block("a", "heading1", 0, ""), block("b", "heading2", 1, "  ")], false).map((item) => item.text)).toEqual(["(bez názvu)", "(bez názvu)"]);
  });
});
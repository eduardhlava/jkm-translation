import { describe, expect, it } from "vitest";
import { cloneElement } from "react";
import { Font, pdf } from "@react-pdf/renderer";
import { resolve } from "node:path";
import {
  canMergeDown, canMergeRight, deleteRowWithMerges, mergeCellsDown, mergeCellsRight,
  remapDeleteColumn, remapDeleteRow, remapInsertColumn, remapInsertRow, unmergeCell,
  MERGE_HEADER, MERGE_WIDTH_MISMATCH,
} from "./cellMerges";
import { createBlock } from "./types";
import { blocksToHtml } from "./serialize";
import { parseDocumentHtml, parseDocumentJson } from "./importJson";
import { DocumentPdf } from "@/lib/pdf/DocumentPdf";

Font.clear();
Font.register({ family: "Helvetica", src: resolve("src/assets/fonts/NotoSans-Regular.ttf") });
Font.register({ family: "NotoSans", fonts: [
  { src: resolve("src/assets/fonts/NotoSans-Regular.ttf"), fontWeight: "normal" },
  { src: resolve("src/assets/fonts/NotoSans-Bold.ttf"), fontWeight: "bold" },
] });

const ROWS = [
  ["A", "B", "C"],
  ["D", "E", "F"],
  ["G", "H", "I"],
];

describe("merge down (rowspan)", () => {
  it("merges two rows and joins text", () => {
    const { rows, merges } = mergeCellsDown(ROWS, [], 0, 0);
    expect(merges).toEqual([{ r: 0, c: 0, span: 1, rowSpan: 2 }]);
    expect(rows[0][0]).toBe("A\nD");
    expect(rows[1][0]).toBe("");
  });
  it("repeating merges three rows", () => {
    const a = mergeCellsDown(ROWS, [], 0, 1);
    const b = mergeCellsDown(a.rows, a.merges, 0, 1);
    expect(b.merges).toEqual([{ r: 0, c: 1, span: 1, rowSpan: 3 }]);
    expect(b.rows.map((r) => r[1])).toEqual(["B\nE\nH", "", ""]);
    expect(canMergeDown(b.rows, b.merges, 0, 1).ok).toBe(false);
  });
  it("horizontal + down gives a rectangle", () => {
    const a = mergeCellsRight(ROWS, [], 0, 0);
    const b = mergeCellsDown(a.rows, a.merges, 0, 0);
    expect(b.merges).toEqual([{ r: 0, c: 0, span: 2, rowSpan: 2 }]);
    expect(b.rows[0]).toEqual(["A\nB\nD\nE", "", "C"]);
    expect(b.rows[1]).toEqual(["", "", "F"]);
    const u = unmergeCell(b.rows, b.merges, 0, 0);
    expect(u.merges).toEqual([]);
  });
  it("forbids merging down into a merge of different width", () => {
    const merges = [{ r: 0, c: 0, span: 2 }, { r: 1, c: 1, span: 2 }];
    const check = canMergeDown(ROWS, merges, 0, 0);
    expect(check.ok).toBe(false);
    expect(check.reason).toBe(MERGE_WIDTH_MISMATCH);
    expect(mergeCellsDown(ROWS, merges, 0, 0).merges).toBe(merges);
  });
  it("forbids merging right into a group of different height", () => {
    const merges = [{ r: 0, c: 0, span: 1, rowSpan: 2 }, { r: 1, c: 1, span: 2 }];
    expect(canMergeRight(ROWS, merges, 0, 0).ok).toBe(false);
    const ok = mergeCellsRight(ROWS, [{ r: 0, c: 0, span: 1, rowSpan: 2 }, { r: 0, c: 1, span: 1, rowSpan: 2 }], 0, 0);
    expect(ok.merges).toEqual([{ r: 0, c: 0, span: 2, rowSpan: 2 }]);
  });
  it("header row cannot merge down into the body", () => {
    const check = canMergeDown(ROWS, [], 0, 0, true);
    expect(check.ok).toBe(false);
    expect(check.reason).toBe(MERGE_HEADER);
    expect(canMergeDown(ROWS, [], 1, 0, true).ok).toBe(true);
  });
});

describe("rowspan remaps", () => {
  const m = [{ r: 0, c: 0, span: 1, rowSpan: 2 }];
  it("inserting a row inside grows, before shifts", () => {
    expect(remapInsertRow(m, 1)).toEqual([{ r: 0, c: 0, span: 1, rowSpan: 3 }]);
    expect(remapInsertRow(m, 0)).toEqual([{ r: 1, c: 0, span: 1, rowSpan: 2 }]);
    expect(remapInsertRow(m, 2)).toEqual(m);
  });
  it("deleting a row shrinks; 1×1 disappears", () => {
    expect(remapDeleteRow(m, 1)).toEqual([]);
    expect(remapDeleteRow([{ r: 0, c: 0, span: 1, rowSpan: 3 }], 2)).toEqual([{ r: 0, c: 0, span: 1, rowSpan: 2 }]);
    expect(remapDeleteRow([{ r: 0, c: 0, span: 2, rowSpan: 2 }], 0)).toEqual([{ r: 0, c: 0, span: 2 }]);
  });
  it("deleting the anchor row keeps its text", () => {
    const { rows, merges } = deleteRowWithMerges([["X", "1"], ["", "2"], ["", "3"]], [{ r: 0, c: 0, span: 1, rowSpan: 3 }], 0);
    expect(rows.map((r) => r[0])).toEqual(["X", ""]);
    expect(merges).toEqual([{ r: 0, c: 0, span: 1, rowSpan: 2 }]);
  });
  it("columns: insert inside widens, delete narrows a rectangle", () => {
    const rect = [{ r: 0, c: 0, span: 2, rowSpan: 2 }];
    expect(remapInsertColumn(rect, 1)).toEqual([{ r: 0, c: 0, span: 3, rowSpan: 2 }]);
    expect(remapDeleteColumn(rect, 1)).toEqual([{ r: 0, c: 0, span: 1, rowSpan: 2 }]);
    expect(remapDeleteColumn([{ r: 0, c: 0, span: 2 }], 1)).toEqual([]);
  });
});

describe("rowspan persistence", () => {
  const mk = () => {
    const b = createBlock("table", 0);
    b.content = { headerRow: false, rows: [["Spojeno", "1"], ["", "2"]], merges: [{ r: 0, c: 0, span: 1, rowSpan: 2 }] };
    return b;
  };
  it("Notion round-trip keeps rowSpan", () => {
    const imported = parseDocumentHtml(blocksToHtml([mk()])).blocks[0];
    expect(imported.content.merges).toEqual([{ r: 0, c: 0, span: 1, rowSpan: 2 }]);
  });
  it("cancels the merge when a covered cell returns non-empty", () => {
    const b = mk();
    const html = blocksToHtml([b]);
    // second row's first (covered) cell is the first empty <td>
    const edited = html.replace(/<td([^>]*)><\/td>/, "<td$1>z Notion</td>");
    expect(edited).not.toBe(html);
    const imported = parseDocumentHtml(edited).blocks[0];
    expect(imported.content.merges).toBeUndefined();
    expect(imported.content.rows[1][0]).toBe("z Notion");
  });
  it("JSON import accepts rowSpan", () => {
    const { blocks } = parseDocumentJson(JSON.stringify([
      { type: "table", content: { rows: ROWS, merges: [{ r: 0, c: 2, span: 1, rowSpan: 3 }] } },
    ]));
    expect(blocks[0].content.merges).toEqual([{ r: 0, c: 2, span: 1, rowSpan: 3 }]);
  });
});

type LayoutNode = { type: string; box?: { top: number; left: number; width: number; height: number }; children?: LayoutNode[] };

describe("PDF rowspan render", () => {
  it("merged cell is as tall as the rows it spans", async () => {
    const b = createBlock("table", 0);
    b.content = {
      headerRow: false,
      rows: [["Slouceno", "prvni", "x"], ["", "druhy\nradek", "y"]],
      merges: [{ r: 0, c: 0, span: 1, rowSpan: 2 }],
      colWidths: [30, 40, 30],
      rowColors: [null, "#fef3c7"],
    };
    let layout: LayoutNode | undefined;
    const doc = DocumentPdf({ title: "", blocks: [b], includeToc: false });
    await pdf(cloneElement(doc, { onRender: (d: { _INTERNAL__LAYOUT__DATA_: LayoutNode }) => { layout = d._INTERNAL__LAYOUT__DATA_; } })).toBuffer();
    let found: LayoutNode | undefined;
    const walk = (n: LayoutNode) => {
      const ch = n.children ?? [];
      if (!found && ch.length === 3 && ch[0].type === "TEXT" && ch[1].type === "VIEW" && (ch[1].children ?? []).length === 2) found = n;
      ch.forEach(walk);
    };
    walk(layout!);
    expect(found).toBeDefined();
    const [merged, strip] = found!.children!;
    const sum = strip.children!.reduce((a, c) => a + (c.box?.height ?? 0), 0);
    expect(sum).toBeGreaterThan(15);
    expect(merged.box!.height).toBeCloseTo(sum, 1);
  });
});

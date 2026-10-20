import { describe, expect, it } from "vitest";
import { Font, pdf } from "@react-pdf/renderer";
import { resolve } from "node:path";

// Local font paths let the real renderer run without network requests.
Font.clear();
Font.register({ family: "Helvetica", src: resolve("src/assets/fonts/NotoSans-Regular.ttf") });
Font.register({ family: "NotoSans", fonts: [
  { src: resolve("src/assets/fonts/NotoSans-Regular.ttf"), fontWeight: "normal" },
  { src: resolve("src/assets/fonts/NotoSans-Bold.ttf"), fontWeight: "bold" },
] });
import {
  coveredBy,
  mergeAt,
  mergeCellsRight,
  normalizeMerges,
  remapDeleteColumn,
  remapDeleteRow,
  remapInsertColumn,
  unmergeCell,
} from "./cellMerges";
import { createBlock } from "./types";
import { blocksToHtml } from "./serialize";
import { parseDocumentHtml, parseDocumentJson } from "./importJson";
import { DocumentPdf } from "@/lib/pdf/DocumentPdf";

const ROWS = [
  ["A", "B", "C"],
  ["1", "2", "3"],
];

describe("cellMerges normalization", () => {
  it("drops invalid, out-of-range and overlapping merges", () => {
    const m = normalizeMerges(
      [
        { r: 0, c: 0, span: 2 },
        { r: 0, c: 1, span: 2 }, // overlaps previous
        { r: 0, c: 2, span: 3 }, // out of range
        { r: 5, c: 0, span: 2 }, // row out of range
        { r: 1, c: 0, span: 1 }, // span < 2
        { r: 1, c: 1, span: 2 },
      ],
      ROWS
    );
    expect(m).toEqual([
      { r: 0, c: 0, span: 2 },
      { r: 1, c: 1, span: 2 },
    ]);
    expect(coveredBy(m, 0, 1)).toEqual({ r: 0, c: 0, span: 2 });
    expect(coveredBy(m, 0, 0)).toBeNull();
    expect(mergeAt(m, 1, 1)).toEqual({ r: 1, c: 1, span: 2 });
  });
});

describe("merge / unmerge", () => {
  it("joins text on new lines and clears covered cells", () => {
    const { rows, merges } = mergeCellsRight(ROWS, [], 0, 0);
    expect(rows[0]).toEqual(["A\nB", "", "C"]);
    expect(merges).toEqual([{ r: 0, c: 0, span: 2 }]);
  });
  it("attaches a whole merged group on the right", () => {
    const first = mergeCellsRight(ROWS, [], 0, 1); // B+C
    const second = mergeCellsRight(first.rows, first.merges, 0, 0);
    expect(second.rows[0]).toEqual(["A\nB\nC", "", ""]);
    expect(second.merges).toEqual([{ r: 0, c: 0, span: 3 }]);
  });
  it("unmerge keeps content in the first cell", () => {
    const merged = mergeCellsRight(ROWS, [], 0, 0);
    const { rows, merges } = unmergeCell(merged.rows, merged.merges, 0, 0);
    expect(rows[0]).toEqual(["A\nB", "", "C"]);
    expect(merges).toEqual([]);
  });
  it("does nothing at the last column", () => {
    const { rows, merges } = mergeCellsRight(ROWS, [], 0, 2);
    expect(rows).toBe(ROWS);
    expect(merges).toEqual([]);
  });
});

describe("structural remaps", () => {
  const mg = [{ r: 0, c: 1, span: 2 }];
  it("inserting a column inside a merge widens it, before it shifts it", () => {
    expect(remapInsertColumn(mg, 2)).toEqual([{ r: 0, c: 1, span: 3 }]);
    expect(remapInsertColumn(mg, 0)).toEqual([{ r: 0, c: 2, span: 2 }]);
    expect(remapInsertColumn(mg, 3)).toEqual(mg);
  });
  it("deleting a column shrinks a merge and drops it below span 2", () => {
    expect(remapDeleteColumn(mg, 1)).toEqual([]); // anchor removed → span 1 → gone
    expect(remapDeleteColumn([{ r: 0, c: 0, span: 3 }], 1)).toEqual([{ r: 0, c: 0, span: 2 }]);
    expect(remapDeleteColumn(mg, 0)).toEqual([{ r: 0, c: 0, span: 2 }]);
  });
  it("deleting a row drops its merges and shifts later rows", () => {
    const m = [
      { r: 0, c: 0, span: 2 },
      { r: 2, c: 0, span: 2 },
    ];
    expect(remapDeleteRow(m, 0)).toEqual([{ r: 1, c: 0, span: 2 }]);
  });
});

describe("Notion round-trip", () => {
  const mkBlock = () => {
    const block = createBlock("table", 0);
    block.content = {
      headerRow: false,
      rows: [
        ["Společné", "", "C"],
        ["1", "2", "3"],
      ],
      merges: [{ r: 0, c: 0, span: 2 }],
    };
    return block;
  };
  it("restores merges from block metadata", () => {
    const imported = parseDocumentHtml(blocksToHtml([mkBlock()])).blocks[0];
    expect(imported.content.merges).toEqual([{ r: 0, c: 0, span: 2 }]);
    expect(imported.content.rows[0]).toEqual(["Společné", "", "C"]);
  });
  it("cancels a merge when a covered cell comes back non-empty from Notion", () => {
    const html = blocksToHtml([mkBlock()]).replace(
      /<td([^>]*)><\/td>/,
      '<td$1>dopsáno v Notion</td>'
    );
    const imported = parseDocumentHtml(html).blocks[0];
    expect(imported.content.merges).toBeUndefined();
    expect(imported.content.rows[0]).toEqual(["Společné", "dopsáno v Notion", "C"]);
  });
  it("stores merges for image-table under tmg", () => {
    const block = createBlock("image-table", 0);
    block.content = {
      image: { url: "test.png", alt: "" },
      table: { headerRow: false, rows: [["X", ""]], merges: [{ r: 0, c: 0, span: 2 }] },
    };
    const imported = parseDocumentHtml(blocksToHtml([block])).blocks[0];
    expect(imported.content.table.merges).toEqual([{ r: 0, c: 0, span: 2 }]);
  });
});

describe("JSON import", () => {
  it("accepts and normalizes content.merges", () => {
    const { blocks } = parseDocumentJson(JSON.stringify([
      { type: "table", content: { rows: ROWS, merges: [{ r: 0, c: 0, span: 2 }, { r: 9, c: 0, span: 5 }] } },
    ]));
    expect(blocks[0].content.merges).toEqual([{ r: 0, c: 0, span: 2 }]);
  });
  it("accepts content.table.merges for image-table", () => {
    const { blocks } = parseDocumentJson(JSON.stringify([
      { type: "image-table", content: { image: { url: "x.png" }, table: { rows: ROWS, merges: [{ r: 1, c: 0, span: 2 }] } } },
    ]));
    expect(blocks[0].content.table.merges).toEqual([{ r: 1, c: 0, span: 2 }]);
  });
});

describe("PDF render", () => {
  it("renders a table with merged cells without errors", async () => {
    const block = createBlock("table", 0);
    block.content = {
      headerRow: true,
      rows: [
        ["Hlavička přes dva sloupce", "", "C"],
        ["1", "2", "3"],
      ],
      merges: [{ r: 0, c: 0, span: 2 }],
      colWidths: [40, 30, 30],
    };
    // Render throws on layout errors; completing without throwing is the assertion.
    await pdf(<DocumentPdf title="" blocks={[block]} includeToc={false} />).toBuffer();
  });
});

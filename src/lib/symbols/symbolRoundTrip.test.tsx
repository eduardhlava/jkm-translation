import { describe, expect, it } from "vitest";
import { Font, pdf } from "@react-pdf/renderer";
import { resolve } from "node:path";
import { blocksToHtml } from "@/components/BlockEditor/serialize";
import { parseDocumentHtml } from "@/components/BlockEditor/importJson";
import { cellFromExportHtml, cellPlainText, cellToExportHtml } from "@/components/BlockEditor/cellFormatting";
import type { Block } from "@/components/BlockEditor/types";
import { DocumentPdf } from "@/lib/pdf/DocumentPdf";
import { layoutFingerprint } from "@/lib/pdf/fingerprint";
import { __setPdfSymbolAsset } from "./symbolStore";

Font.clear();
Font.register({ family: "Helvetica", src: resolve("src/assets/fonts/NotoSans-Regular.ttf") });
Font.register({ family: "NotoSans", fonts: [
  { src: resolve("src/assets/fonts/NotoSans-Regular.ttf"), fontWeight: "normal" },
  { src: resolve("src/assets/fonts/NotoSans-Bold.ttf"), fontWeight: "bold" },
  { src: resolve("src/assets/fonts/NotoSans-Regular.ttf"), fontStyle: "italic" },
  { src: resolve("src/assets/fonts/NotoSans-Bold.ttf"), fontWeight: "bold", fontStyle: "italic" },
] });

// 1×1 px PNG
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const mk = (blocks: Array<Omit<Block, "order" | "template">>): Block[] => blocks.map((b, order) => ({ ...b, order, template: "default" })) as Block[];

describe("library symbols round-trip", () => {
  it("text block symbols survive blocksToHtml → import", () => {
    const blocks = mk([{ id: "t", type: "text", content: { html: "<p>Dotáhněte šrouby.</p>", align: "left", size: "normal", pictogram: "alert", symbols: [{ code: "screw-cz", w: 25, pos: "right" }] } }]);
    const back = parseDocumentHtml(blocksToHtml(blocks)).blocks[0];
    expect(back.content.symbols).toEqual([{ code: "screw-cz", w: 25, pos: "right" }]);
    expect(back.content.html).toBe("<p>Dotáhněte šrouby.</p>");
    expect(back.content.pictogram).toBe("alert");
  });

  it("cell with built-in pictogram, symbol and bold text round-trips through export HTML", () => {
    const cell = "[[pic:info]] [[sym:a|w=10|pos=top]][[html]]<strong>Pozor</strong>";
    const back = cellFromExportHtml(cellToExportHtml(cell));
    expect(back).toBe("[[pic:info]] [[sym:a|w=10|pos=top]][[html]]<strong>Pozor</strong>");
    expect(cellPlainText(cell)).toBe("Pozor");
  });

  it("fingerprint changes with symbol size or position", () => {
    const a = mk([{ id: "t", type: "text", content: { html: "<p>x</p>", symbols: [{ code: "a", w: 20, pos: "left" }] } }]);
    const b = mk([{ id: "t", type: "text", content: { html: "<p>x</p>", symbols: [{ code: "a", w: 30, pos: "left" }] } }]);
    const c = mk([{ id: "t", type: "text", content: { html: "<p>x</p>", symbols: [{ code: "a", w: 20, pos: "right" }] } }]);
    const fa = layoutFingerprint(a, false, undefined);
    expect(fa).not.toBe(layoutFingerprint(b, false, undefined));
    expect(fa).not.toBe(layoutFingerprint(c, false, undefined));
  });

  it("renders text and table symbols (known and unknown) in the PDF", async () => {
    __setPdfSymbolAsset("known", { src: PNG, ratio: 1 });
    const long = `<p>${Array.from({ length: 40 }, (_, i) => `Věta ${i + 1} o bezpečném provozu stroje.`).join(" ")}</p>`;
    const blocks = mk([
      { id: "t1", type: "text", content: { html: long, symbols: [{ code: "known", w: 30, pos: "left" }, { code: "known", w: 20, pos: "right" }] } },
      { id: "t2", type: "text", content: { html: "<p>Na střed</p>", symbols: [{ code: "known", w: 40, pos: "center" }, { code: "missing", w: 20, pos: "left" }] } },
      { id: "tb", type: "table", content: { headerRow: true, rows: [["A", "B"], ["[[pic:alert]] [[sym:known|w=8|pos=left]]text", "[[sym:missing|pos=top]]x"]], merges: [] } },
    ]);
    const buf = await pdf(<DocumentPdf title="" blocks={blocks} includeToc={false} />).toBuffer();
    expect(buf).toBeTruthy();
    __setPdfSymbolAsset("known", null);
  }, 30000);
});

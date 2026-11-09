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
import { cleanSymbolImgs, inlineSymbolsOf, symbolImgHtml } from "./symbolTokens";
import { splitHtmlAtSymbols } from "@/lib/pdf/symbolFlow";

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
  it("legacy block-level symbols migrate inline and round-trip at the same place", () => {
    const blocks = mk([{ id: "t", type: "text", content: { html: "<p>Dotáhněte šrouby.</p>", align: "left", size: "normal", pictogram: "alert", symbols: [{ code: "screw-cz", w: 25, pos: "right" }] } }]);
    const html = blocksToHtml(blocks);
    expect(html).toContain("<p>[[sym:screw-cz|w=25|pos=right]]Dotáhněte šrouby.</p>");
    const back = parseDocumentHtml(html).blocks[0];
    expect(back.content.symbols).toBeUndefined();
    expect(inlineSymbolsOf(back.content.html)).toEqual([{ code: "screw-cz", w: 25, pos: "right" }]);
    expect(back.content.pictogram).toBe("alert");
  });

  it("inline symbol token stays at its exact text position through Notion HTML", () => {
    const html = `<p>První věta. Druhá ${symbolImgHtml({ code: "hak", w: 20, pos: "left" })}věta.</p>`;
    const out = blocksToHtml(mk([{ id: "t", type: "text", content: { html } }]));
    expect(out).toContain("Druhá [[sym:hak|w=20|pos=left]]věta.");
    expect(out).not.toContain("<img");
    const back = parseDocumentHtml(out).blocks[0];
    expect(back.content.html).toContain(`Druhá ${symbolImgHtml({ code: "hak", w: 20, pos: "left" })}věta.`);
  });

  it("a left/right symbol mid-paragraph floats the whole paragraph beside it", () => {
    const segs = splitHtmlAtSymbols(`<p>Před</p><p>Jedna. Dru${symbolImgHtml({ code: "h", w: 20, pos: "right" })}há.</p>`);
    expect(segs).toEqual([{ kind: "text", html: "<p>Před</p>" }, { kind: "float", left: [], right: [{ code: "h", w: 20, pos: "right" }], html: "<p>Jedna. Druhá.</p>" }]);
  });

  it("saved HTML never keeps signed URLs", () => {
    expect(cleanSymbolImgs('<img src="https://x/sig?token=1" data-sym="a" data-w="20" data-pos="right" style="width:44px" class="sym sym-right sym-selected">'))
      .toBe(symbolImgHtml({ code: "a", w: 20, pos: "right" }));
  });

  it("PDF flow splits text around center and float symbols without losing text", () => {
    const segs = splitHtmlAtSymbols(`<p>A ${symbolImgHtml({ code: "c", w: 20, pos: "center" })} B</p><p>C ${symbolImgHtml({ code: "l", w: 20, pos: "left" })}D</p><p>E</p>`);
    expect(segs.map((s) => s.kind)).toEqual(["text", "center", "text", "float"]);
    const text = segs.map((s) => ("html" in s ? s.html.replace(/<[^>]+>/g, "") : "|")).join("");
    expect(text.replace(/\s+/g, "")).toBe("A|BCDE");
    expect(segs.some((s) => "html" in s && s.html.includes("data-sym"))).toBe(false);
  });

  it("cell with built-in pictogram, symbol and bold text round-trips through export HTML", () => {
    const cell = "[[pic:info]] [[sym:a|w=10|pos=top]][[html]]<strong>Pozor</strong>";
    const back = cellFromExportHtml(cellToExportHtml(cell));
    expect(back).toBe("[[pic:info]] [[sym:a|w=10|pos=top]][[html]]<strong>Pozor</strong>");
    expect(cellPlainText(cell)).toBe("Pozor");
  });

  it("fingerprint changes with symbol size or position", () => {
    const a = mk([{ id: "t", type: "text", content: { html: `<p>${symbolImgHtml({ code: "a", w: 20, pos: "left" })}x</p>` } }]);
    const b = mk([{ id: "t", type: "text", content: { html: `<p>${symbolImgHtml({ code: "a", w: 30, pos: "left" })}x</p>` } }]);
    const c = mk([{ id: "t", type: "text", content: { html: `<p>${symbolImgHtml({ code: "a", w: 20, pos: "right" })}x</p>` } }]);
    const fa = layoutFingerprint(a, false, undefined);
    expect(fa).not.toBe(layoutFingerprint(b, false, undefined));
    expect(fa).not.toBe(layoutFingerprint(c, false, undefined));
    const d = mk([{ id: "t", type: "text", content: { html: `<p>x${symbolImgHtml({ code: "a", w: 20, pos: "left" })}</p>` } }]);
    expect(fa).not.toBe(layoutFingerprint(d, false, undefined));
  });

  it("renders text and table symbols (known and unknown) in the PDF", async () => {
    __setPdfSymbolAsset("known", { src: PNG, ratio: 1 });
    const long = `<p>${Array.from({ length: 40 }, (_, i) => `Věta ${i + 1} o bezpečném provozu stroje.`).join(" ")}</p>`;
    const blocks = mk([
      { id: "t1", type: "text", content: { html: long.replace("<p>", `<p>${symbolImgHtml({ code: "known", w: 30, pos: "left" })}`).replace("Věta 5 ", `${symbolImgHtml({ code: "known", w: 20, pos: "right" })}Věta 5 `) } },
      { id: "t2", type: "text", content: { html: "<p>Na střed</p>", symbols: [{ code: "known", w: 40, pos: "center" }, { code: "missing", w: 20, pos: "left" }] } },
      { id: "tb", type: "table", content: { headerRow: true, rows: [["A", "B"], ["[[pic:alert]] [[sym:known|w=8|pos=left]]text", "[[sym:missing|pos=top]]x"]], merges: [] } },
    ]);
    const buf = await pdf(<DocumentPdf title="" blocks={blocks} includeToc={false} />).toBuffer();
    expect(buf).toBeTruthy();
    __setPdfSymbolAsset("known", null);
  }, 30000);
});

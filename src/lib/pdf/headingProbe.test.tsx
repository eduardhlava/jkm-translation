import { describe, expect, it } from "vitest";
import { Font, pdf } from "@react-pdf/renderer";
import { resolve } from "node:path";
import { DocumentPdf, type MeasureContext } from "./DocumentPdf";
import type { Block } from "@/components/BlockEditor/types";

// Real renderer regression: a breakable paragraph must not defeat the 3-line
// reservation. Local font paths let the renderer run without network requests.
Font.clear();
Font.register({ family: "Helvetica", src: resolve("src/assets/fonts/NotoSans-Regular.ttf") });
Font.register({ family: "NotoSans", fonts: [
  { src: resolve("src/assets/fonts/NotoSans-Regular.ttf"), fontWeight: "normal" },
  { src: resolve("src/assets/fonts/NotoSans-Bold.ttf"), fontWeight: "bold" },
] });

function fixture(spacers: number): Block[] {
  return [
    ...Array.from({ length: spacers }, (_, i) => ({
      id: `space-${i}`, type: "spacer" as const, content: {},
    })),
    { id: "heading", type: "heading2" as const, content: { text: "PROBE HEADING" } },
    { id: "text", type: "text" as const, content: { html: "<p>Following breakable text.</p>" } },
  ].map((b, order) => ({ ...b, order, template: "default" }));
}

function measurement(): MeasureContext {
  return {
    keepWithNextPt: 47.25, headingPages: new Map(), prevEndPages: new Map(),
    nextStartPages: new Map(), tableStartPages: new Map(), tableEndPages: new Map(),
  };
}

describe("real DocumentPdf heading probe", () => {
  it("reserves 47.25pt for breakable text near the bottom, unlike no probe", async () => {
    const blocks = fixture(21);
    const baseline = new Map<string, number>();
    await pdf(<DocumentPdf title="" blocks={blocks} includeToc={false} collector={baseline} />).toBuffer();
    const measure = measurement();
    await pdf(<DocumentPdf title="" blocks={blocks} includeToc={false} measure={measure} />).toBuffer();
    expect(baseline.get("heading")).toBe(1);
    expect(measure.prevEndPages.get("heading")).toBe(1);
    expect(measure.headingPages.get("heading")).toBe(2);
  });

  it("long pictogram text starts beside its heading and continues on the next page", async () => {
    const blocks = fixture(16);
    const text = blocks.find((b) => b.id === "text");
    if (!text) throw new Error("Missing fixture text");
    text.content = { pictogram: "warning", html: `<p>${Array.from({ length: 30 }, (_, i) => `Warning ${i + 1}: Follow all safety precautions before operating this machinery.`).join(" ")}</p>` };
    blocks.push({ id: "after", type: "heading2", template: "default", order: blocks.length, content: { text: "AFTER LONG TEXT" } });
    const measure = measurement();
    const collector = new Map<string, number>();
    await pdf(<DocumentPdf title="" blocks={blocks} includeToc={false} measure={measure} collector={collector} />).toBuffer();
    expect(measure.headingPages.get("heading")).toBe(1);
    expect(measure.nextStartPages.get("heading")).toBe(1);
    expect(collector.get("after")).toBe(2);
  });

  it("pictogram tables split by rows like normal tables", async () => {
    const blocks = fixture(16).filter((b) => b.id !== "text");
    blocks.push({ id: "table", type: "table", template: "default", order: blocks.length,
      content: { pictogram: "warning", headerRow: false, rows: Array.from({ length: 20 }, (_, i) => [`Row ${i + 1}`]) } });
    const measure = measurement();
    await pdf(<DocumentPdf title="" blocks={blocks} includeToc={false} measure={measure} />).toBuffer();
    expect(measure.tableStartPages.get("table")).toBe(1);
    expect(measure.tableEndPages.get("table")).toBe(2);
    expect(measure.nextStartPages.get("heading")).toBe(1);
  });
});
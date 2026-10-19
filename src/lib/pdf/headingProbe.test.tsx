import { describe, expect, it, vi } from "vitest";
import { cloneElement } from "react";
import { Font, pdf } from "@react-pdf/renderer";
import { resolve } from "node:path";
import { DocumentPdf, type MeasureContext } from "./DocumentPdf";
import type { Block } from "@/components/BlockEditor/types";
import { runPaginationLoop, toPreparedBlocks } from "./paginate";

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
    nextStartPages: new Map(), tableStartPages: new Map(), tablePartStartPages: new Map(), tableEndPages: new Map(),
  };
}

type LayoutNode = {
  type: string;
  box?: { top: number; left: number; width: number; height: number };
  props?: { fixed?: boolean };
  style?: { position?: string };
  children?: LayoutNode[];
};

function assertNoFlowOverlap(node: LayoutNode) {
  const children = (node.children ?? []).filter((child) =>
    child.box && child.box.height > 0 && !child.props?.fixed && child.style?.position !== "absolute"
  );
  // Row siblings intentionally share a vertical range; only compare vertical
  // siblings whose horizontal ranges overlap (e.g. paragraphs/image/caption).
  for (let i = 1; i < children.length; i++) {
    const previous = children[i - 1].box;
    const current = children[i].box;
    if (!previous || !current) continue;
    if (current.left < previous.left + previous.width && previous.left < current.left + current.width) {
      expect(current.top + 0.1).toBeGreaterThanOrEqual(previous.top + previous.height);
    }
  }
  for (const child of node.children ?? []) assertNoFlowOverlap(child);
}

describe("real DocumentPdf portrait image safety", () => {
  const portrait = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAZAAAASwAQAAAAD9UCHwAAAAzElEQVR42u3LMQEAAAgDoGn/zjODP/xM87VRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRFEVRcvmiCl8ejtCLAAAAAElFTkSuQmCC";

  it.each(["image", "image-table"] as const)("caps %s at 640pt without squeezing adjacent paragraphs", async (type) => {
    const image = { url: portrait, alt: "Portrait caption" };
    const blocks: Block[] = [
      ...fixture(5).filter((b) => b.type === "spacer"),
      { id: "before", type: "text", template: "default", order: 5, content: { html: "<p>Paragraph before portrait.</p>" } },
      { id: "portrait", type, template: "default", order: 6, content: type === "image" ? image : { image, table: { rows: [["One row"]] } } },
      { id: "after", type: "text", template: "default", order: 7, content: { html: "<p>Paragraph after portrait.</p>" } },
    ];
    let layout: LayoutNode | undefined;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      // Capture the renderer's resolved layout, not a mocked measurement or
      // JSX style snapshot. Before the fix the 400×1200 image exceeds a page.
      const document = DocumentPdf({ title: "", blocks, includeToc: false, measure: measurement() });
      await pdf(cloneElement(document, { onRender: (data: { _INTERNAL__LAYOUT__DATA_: LayoutNode }) => {
        layout = data._INTERNAL__LAYOUT__DATA_;
      } })).toBuffer();
      if (!layout) throw new Error("Renderer did not return layout");
      console.log(JSON.stringify(layout, (key, value) => ["image", "data", "lines", "glyphs"].includes(key) ? undefined : value).slice(0, 16000)); console.log(warn.mock.calls);
      expect(layout.children).toHaveLength(2);
      const images: Array<{ node: LayoutNode; page: number; parent: LayoutNode }> = [];
      const paragraphs: Array<{ node: LayoutNode; page: number }> = [];
      const walk = (node: LayoutNode, page: number, parent: LayoutNode) => {
        if (node.type === "IMAGE") images.push({ node, page, parent });
        if (node.type === "TEXT" && node.children?.some((child) => child.type === "TEXT_INSTANCE")) paragraphs.push({ node, page });
        for (const child of node.children ?? []) walk(child, page, node);
      };
      layout.children?.forEach((page, i) => walk(page, i + 1, page));
      expect(images).toHaveLength(1);
      const rendered = images[0];
      expect(rendered.page).toBe(2);
      expect(rendered.node.box?.height).toBeCloseTo(640, 1);
      const imageBox = rendered.node.box;
      const parentBox = rendered.parent.box;
      if (!imageBox || !parentBox) throw new Error("Missing image layout boxes");
      // The image and caption live inside one unbreakable view within the body.
      expect(parentBox.top + parentBox.height).toBeLessThanOrEqual(842 - 60);
      expect(parentBox.height).toBeGreaterThan(imageBox.height);
      const bodyParagraphs = paragraphs.filter(({ node }) => node.box && Math.abs(node.box.height - 15.75) < 0.1);
      expect(bodyParagraphs.map(({ page }) => page)).toEqual([1, 2]);
      assertNoFlowOverlap(layout);
      expect(warn.mock.calls.filter((args) => args.some((arg) => String(arg).includes("can't wrap")))).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  }, 20000);
});

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

  it("escalates a roughly 500pt image + 15-row table to an internal table break", async () => {
    // 475×500 at the renderer's 98% body width gives approximately 511pt height.
    const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAdsAAAH0AQAAAABd+7p6AAAAeUlEQVR42u3LMQ0AMAgAMMC/ySkZHuAiaf/mj7FXsSDLsizLsizLsizLsizLsizLsizLsizLsizLsizLsizLsizLsizLsizLsizLsizLsizLsizLsizLsizLsizLsizLsizLsizLsizLsizLsizLsizLsizLsixfzw1x8QXIpFtcYwAAAABJRU5ErkJggg==";
    const combined: Block = { id: "combined", type: "image-table", template: "default", order: 1,
      content: { image: { url: image, alt: "Tall image caption" }, table: { headerRow: false, rows: Array.from({ length: 15 }, (_, i) => [`Part ${i + 1}`]) } } };
    const blocks: Block[] = [{ id: "before", type: "spacer", template: "default", order: 0, content: {} }, combined];
    const measured: MeasureContext[] = [];
    const result = await runPaginationLoop(blocks, async (current) => {
      const measure = measurement();
      await pdf(<DocumentPdf title="" blocks={toPreparedBlocks(current, blocks)} includeToc={false} measure={measure} />).toBuffer();
      measured.push(measure);
      return measure;
    });
    const initial = measured[0];
    expect(initial.tablePartStartPages.get(combined.id)).toBe(1);
    expect(initial.tableEndPages.get(combined.id)).toBe(2);
    const final = measured.at(-1);
    expect(final?.tableStartPages.get(combined.id)).toBe(1);
    expect(final?.tablePartStartPages.get(combined.id)).toBe(2);
    expect(final?.tableEndPages.get(combined.id)).toBe(2);
    expect(result.blocks.find((b) => b.id === combined.id)?.content.autoTableBreak).toBe(true);
    expect(result.blocks.some((b) => b.type === "pagebreak")).toBe(false);
    expect(result.tooLongTables).toBe(0);
    expect(result.remaining).toEqual([]);
  }, 20000);
});
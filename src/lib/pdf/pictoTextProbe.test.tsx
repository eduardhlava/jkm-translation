import { describe, expect, it } from "vitest";
import { Font, pdf } from "@react-pdf/renderer";
import { resolve } from "node:path";
import { DocumentPdf, type MeasureContext } from "./DocumentPdf";
import type { Block } from "@/components/BlockEditor/types";
import { collectRemaining, findViolations, runPaginationLoop, type MeasureResult } from "./paginate";

Font.clear();
Font.register({ family: "Helvetica", src: resolve("src/assets/fonts/NotoSans-Regular.ttf") });
Font.register({ family: "NotoSans", fonts: [
  { src: resolve("src/assets/fonts/NotoSans-Regular.ttf"), fontWeight: "normal" },
  { src: resolve("src/assets/fonts/NotoSans-Bold.ttf"), fontWeight: "bold" },
] });

const measurement = (): MeasureContext => ({
  keepWithNextPt: 47.25, headingPages: new Map(), prevEndPages: new Map(), nextStartPages: new Map(),
  tableStartPages: new Map(), tablePartStartPages: new Map(), tableEndPages: new Map(), pictoTextPages: new Map(),
});

const LONG = `<p>${Array.from({ length: 20 }, (_, i) => `Sentence ${i + 1}: follow all safety precautions before operating.`).join(" ")}</p>`;

function doc(fill: string, text: Block["content"]): Block[] {
  return [
    { id: "fill", type: "text", content: { html: fill } },
    { id: "target", type: "text", content: text },
  ].map((b, order) => ({ ...b, order, template: "default" })) as Block[];
}

async function measureOf(blocks: Block[]) {
  const m = measurement();
  await pdf(<DocumentPdf title="" blocks={blocks} includeToc={false} measure={m} />).toBuffer();
  return m;
}

/** Filler paragraph lines such that `lines` body lines remain at the page bottom. */
async function fillerLeaving(linesLeft: number): Promise<string> {
  // Find the largest filler line count whose following one-liner stays on page 1, then back off.
  let n = 10;
  for (; n < 60; n++) {
    const html = Array.from({ length: n }, (_, i) => `L${i}`).join("<br>");
    const c = new Map<string, number>();
    const blocks = doc(`<p>${html}</p>`, { html: "<p>x</p>" });
    blocks.push({ id: "probe", type: "heading1", order: 2, template: "default", content: { text: "" } } as Block);
    const m = await measureOf(doc(`<p>${html}</p>`, { html: `<p>${Array.from({ length: linesLeft + 1 }, () => "y").join("<br>")}</p>` }));
    void c; void blocks; void m;
    const end = new Map<string, number>();
    await pdf(<DocumentPdf title="" includeToc={false} collector={end} blocks={[...doc(`<p>${html}</p>`, { html: "<p>x</p>" }), { id: "h", type: "heading2", order: 2, template: "default", content: { text: "H" } } as Block]} />).toBuffer();
    if ((end.get("h") ?? 1) > 1) break;
  }
  // n lines push the following heading over; leave room for linesLeft lines.
  return `<p>${Array.from({ length: Math.max(1, n - linesLeft - 1) }, (_, i) => `L${i}`).join("<br>")}</p>`;
}

describe("pictogram text keep-with-next", () => {
  it("findViolations reports pictogram text whose probe jumped pages", () => {
    const blocks = doc("<p>a</p>", { html: "<p>b</p>", pictogram: "warning" });
    const m: MeasureResult = { ...measurement(), prevEndPages: new Map([["target", 1]]), pictoTextPages: new Map([["target", 2]]) };
    expect(findViolations(blocks, m, new Set())).toEqual(["target"]);
    expect(collectRemaining(blocks, m)[0].text).toBe("Text s piktogramem");
    const plain = doc("<p>a</p>", { html: "<p>b</p>" });
    expect(findViolations(plain, m, new Set())).toEqual([]);
  });

  it("moves a pictogram block with ~2 free lines to the next page, not a plain one", async () => {
    const fill = await fillerLeaving(2);
    const run = (content: Block["content"]) => runPaginationLoop(doc(fill, content), async (cur) => measureOf(cur));
    const withPic = await run({ html: LONG, pictogram: "warning" });
    expect(withPic.blocks.map((b) => b.type)).toEqual(["text", "pagebreak", "text"]);
    expect(withPic.remaining).toEqual([]);
    const plain = await run({ html: LONG });
    expect(plain.inserted).toBe(0);
  }, 60000);

  it("never splits a one-line pictogram block", async () => {
    const fill = await fillerLeaving(0);
    const blocks = doc(fill, { html: "<p>Short warning.</p>", pictogram: "warning" });
    const m = await measureOf(blocks);
    const res = await runPaginationLoop(blocks, async (cur) => measureOf(cur));
    expect(m.pictoTextPages?.get("target")).toBeDefined();
    // Either it fit on page 1 untouched or it was moved whole.
    if (res.inserted > 0) expect(res.blocks[1].type).toBe("pagebreak");
    expect(res.remaining).toEqual([]);
  }, 60000);
});

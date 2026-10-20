import { describe, it, expect } from "vitest";
import { splitTextForWrap, wrapsNextText } from "./imageWrap";
import { blocksToHtml } from "@/components/BlockEditor/serialize";
import { parseDocumentHtml, parseDocumentJson } from "@/components/BlockEditor/importJson";
import type { Block } from "@/components/BlockEditor/types";

const plain = (html: string) => {
  const d = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  return (d.body.textContent ?? "").replace(/\s+/g, " ").trim();
};
const words = Array.from({ length: 400 }, (_, i) => `slovo${i}`).join(" ");

describe("splitTextForWrap", () => {
  it("long paragraph: nothing lost or duplicated, formatting kept", () => {
    const html = `<p><strong>Tučně</strong> ${words} <em>konec</em></p><ul><li>a</li><li>b</li></ul>`;
    const { side, rest } = splitTextForWrap(html, 200);
    expect(side).not.toBe("");
    expect(rest).not.toBe("");
    expect(`${plain(side)} ${plain(rest)}`).toBe(plain(html));
    expect(side).toContain("<strong>Tučně</strong>");
    expect(rest).toContain("<em>konec</em>");
  });

  it("short text fits entirely beside the image", () => {
    const { side, rest } = splitTextForWrap("<p>Krátký text.</p>", 300);
    expect(plain(side)).toBe("Krátký text.");
    expect(rest).toBe("");
  });

  it("ordered list continues numbering in the rest", () => {
    const items = Array.from({ length: 30 }, (_, i) => `<li>položka ${i}</li>`).join("");
    const { side, rest } = splitTextForWrap(`<ol>${items}</ol>`, 150);
    const sideCount = (side.match(/<li>/g) ?? []).length;
    expect(sideCount + (rest.match(/<li>/g) ?? []).length).toBe(30);
    expect(rest).toContain(`start="${sideCount + 1}"`);
  });
});

describe("wrapsNextText", () => {
  const img = (content: any): Block => ({ id: "i", type: "image", template: "default", order: 0, content: { url: "x", alt: "", ...content } });
  const text: Block = { id: "t", type: "text", template: "default", order: 1, content: { html: "<p>a</p>" } };
  it("only half left/right before a text block", () => {
    expect(wrapsNextText(img({ size: "half", position: "left" }), text)).toBe(true);
    expect(wrapsNextText(img({ size: "half", position: "right" }), text)).toBe(true);
    expect(wrapsNextText(img({ size: "half", position: "center" }), text)).toBe(false);
    expect(wrapsNextText(img({}), text)).toBe(false);
    expect(wrapsNextText(img({ size: "half" }), { ...text, type: "table" })).toBe(false);
  });
});

describe("image size/position persistence", () => {
  it("round-trips through Notion HTML markers", () => {
    const blocks: Block[] = [
      { id: "a", type: "image", template: "default", order: 0, content: { url: "https://x/a.png", alt: "A", size: "half", position: "right" } },
      { id: "b", type: "image", template: "default", order: 1, content: { url: "https://x/b.png", alt: "B" } },
      { id: "c", type: "image-table", template: "default", order: 2, content: { image: { url: "https://x/c.png", alt: "", size: "half" }, table: { headerRow: true, rows: [["#", "x"]] } } },
    ];
    const out = parseDocumentHtml(blocksToHtml(blocks)).blocks;
    const byId = Object.fromEntries(out.map((b) => [b.id, b]));
    expect(byId.a.content.size).toBe("half");
    expect(byId.a.content.position).toBe("right");
    expect(byId.b.content.size).toBeUndefined();
    expect(byId.c.content.image.size).toBe("half");
  });

  it("JSON import accepts valid values and ignores invalid ones", () => {
    const { blocks } = parseDocumentJson(JSON.stringify([
      { type: "image", content: { url: "u", size: "half", position: "center" } },
      { type: "image", content: { url: "u", size: "huge", position: "right" } },
      { type: "image", content: { url: "u", size: "half", position: "top" } },
      { type: "image-table", content: { image: { url: "u", size: "half" } } },
    ]));
    expect(blocks[0].content).toMatchObject({ size: "half", position: "center" });
    expect(blocks[1].content.size).toBeUndefined();
    expect(blocks[2].content.position).toBe("left");
    expect(blocks[3].content.image.size).toBe("half");
  });
});

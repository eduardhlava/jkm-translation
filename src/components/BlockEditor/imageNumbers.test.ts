import { describe, it, expect } from "vitest";
import { computeImageNumbers, imageNumberedLabel, isImageNumbered } from "./imageNumbers";
import { mergeMetadata } from "@/components/DocumentMetadata/types";
import { splitImageTableBlock } from "./splitImageTable";
import { blocksToHtml } from "./serialize";
import { parseDocumentHtml, parseDocumentJson } from "./importJson";
import type { Block } from "./types";

const img = (id: string, order: number, numbered?: boolean): Block => ({
  id,
  type: "image",
  template: "default",
  order,
  content: { url: "https://img/x.png", alt: `Obr ${id}`, ...(numbered === undefined ? {} : { numbered }) },
});

const imgTable = (id: string, order: number, numbered?: boolean): Block => ({
  id,
  type: "image-table",
  template: "default",
  order,
  content: {
    image: { url: "https://img/t.png", alt: `Tab ${id}`, ...(numbered === undefined ? {} : { numbered }) },
    table: { headerRow: true, rows: [["#", "Název"]] },
  },
});

describe("computeImageNumbers", () => {
  it("přeskočí nečíslovaný obrázek uprostřed bez mezery v číslování", () => {
    const blocks = [img("a", 0), img("b", 1, false), imgTable("c", 2), img("d", 3)];
    const map = computeImageNumbers(blocks);
    expect(map.get("a")).toBe(1);
    expect(map.has("b")).toBe(false);
    expect(map.get("c")).toBe(2);
    expect(map.get("d")).toBe(3);
  });

  it("chybějící numbered znamená číslovat (zpětná kompatibilita)", () => {
    expect(isImageNumbered(img("a", 0))).toBe(true);
    expect(isImageNumbered(imgTable("t", 0))).toBe(true);
    expect(isImageNumbered(img("b", 0, false))).toBe(false);
    expect(isImageNumbered(imgTable("u", 0, false))).toBe(false);
  });
});

describe("imageNumberedLabel", () => {
  it("mezera mezi označením a číslem se doplňuje automaticky", () => {
    expect(imageNumberedLabel("Obrázek č.", 3)).toBe("Obrázek č. 3");
    expect(imageNumberedLabel("Obrázek č. ", 3)).toBe("Obrázek č. 3");
    expect(imageNumberedLabel("Figure No. ", 12)).toBe("Figure No. 12");
  });

  it("prázdný prefix → výchozí označení", () => {
    expect(imageNumberedLabel("", 1)).toBe("Obrázek č. 1");
    expect(imageNumberedLabel(undefined, 1)).toBe("Obrázek č. 1");
  });
});

describe("metadata výchozí hodnoty popisků", () => {
  it("starší metadata bez imageLabelUnnumbered dostanou výchozí 'Obrázek'", () => {
    const merged = mergeMetadata({ imageLabelPrefix: "Figure No. " });
    expect(merged.imageLabelUnnumbered).toBe("Obrázek");
    expect(merged.imageLabelPrefix).toBe("Figure No. ");
  });
});

describe("numbered – persistence", () => {
  it("JSON import přijme content.numbered i content.image.numbered", () => {
    const { blocks } = parseDocumentJson(JSON.stringify([
      { type: "image", content: { url: "u", alt: "a", numbered: false } },
      { type: "image-table", content: { image: { url: "u", alt: "b", numbered: false }, table: { headerRow: true, rows: [["x"]] } } },
      { type: "image", content: { url: "u", alt: "c" } },
    ]));
    expect(blocks[0].content.numbered).toBe(false);
    expect(blocks[1].content.image.numbered).toBe(false);
    expect(blocks[2].content.numbered).toBeUndefined();
  });

  it("round-trip přes Notion HTML zachová numbered=false (nn / inn)", () => {
    const blocks = [img("i1", 0, false), imgTable("it1", 1, false), img("i2", 2)];
    const html = blocksToHtml(blocks);
    const { blocks: back } = parseDocumentHtml(html);
    const byId = new Map(back.map((b) => [b.id, b]));
    expect(byId.get("i1")?.content.numbered).toBe(false);
    expect(byId.get("it1")?.content.image.numbered).toBe(false);
    expect(byId.get("i2")?.content.numbered).toBeUndefined();
  });

  it("číslovaný obrázek do metadat nn nezapisuje", () => {
    const html = blocksToHtml([img("i1", 0)]);
    expect(html).not.toContain("nn");
  });
});

describe("splitImageTableBlock", () => {
  it("zachová numbered=false při rozdělení bloku", () => {
    const [image] = splitImageTableBlock(imgTable("it-9", 3, false));
    expect(image.content.numbered).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { splitImageTableBlock } from "./splitImageTable";
import type { Block } from "./types";

const makeBlock = (): Block => ({
  id: "it-1",
  type: "image-table",
  template: "default",
  order: 3,
  content: {
    pictogram: "alert",
    autoTableBreak: true,
    image: { url: "https://img/1.png", alt: "popisek", width: 320, size: "half" },
    table: {
      headerRow: true,
      rows: [
        ["#", "Název"],
        ["1", "[[pic:recycling]] materiál"],
      ],
      merges: [{ r: 1, c: 0, span: 2 }],
      colWidths: [30, 70],
      rowColors: { 1: "green" },
    },
  },
});

describe("splitImageTableBlock", () => {
  it("zachová id, url, alt, size i piktogram obrázku", () => {
    const [image] = splitImageTableBlock(makeBlock());
    expect(image.id).toBe("it-1");
    expect(image.type).toBe("image");
    expect(image.content.url).toBe("https://img/1.png");
    expect(image.content.alt).toBe("popisek");
    expect(image.content.size).toBe("half");
    expect(image.content.width).toBe(320);
    expect(image.content.position).toBe("center");
    expect(image.content.pictogram).toBe("alert");
  });

  it("přenese tabulku beze změny včetně merges, colWidths a rowColors", () => {
    const src = makeBlock();
    const [, table] = splitImageTableBlock(src);
    expect(table.type).toBe("table");
    expect(table.id).not.toBe("it-1");
    expect(table.id).toBeTruthy();
    expect(table.content).toEqual(src.content.table);
    expect(table.content.merges).toEqual([{ r: 1, c: 0, span: 2 }]);
    expect(table.content.colWidths).toEqual([30, 70]);
    expect(table.content.rowColors).toEqual({ 1: "green" });
    expect(table.content.rows[1][1]).toBe("[[pic:recycling]] materiál");
    expect(table.content.pictogram).toBeUndefined();
  });

  it("zahodí autoTableBreak a zachová template a pořadí", () => {
    const [image, table] = splitImageTableBlock(makeBlock());
    expect(image.content.autoTableBreak).toBeUndefined();
    expect(table.content.autoTableBreak).toBeUndefined();
    expect(image.template).toBe("default");
    expect(table.template).toBe("default");
    expect(image.order).toBe(3);
    expect(table.order).toBe(3);
  });

  it("bez blokového piktogramu obrázek piktogram nedostane", () => {
    const b = makeBlock();
    delete b.content.pictogram;
    const [image] = splitImageTableBlock(b);
    expect(image.content.pictogram).toBeUndefined();
  });

  it("odmítne jiný typ bloku", () => {
    expect(() => splitImageTableBlock({ ...makeBlock(), type: "table" })).toThrow();
  });
});

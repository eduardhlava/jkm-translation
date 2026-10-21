import { describe, expect, it } from "vitest";
import { mergeImageAndTable, splitImageTableBlock } from "./splitImageTable";
import type { Block } from "./types";

const table: Block = { id: "t", type: "table", template: "T2", order: 4, content: {
  headerRow: true, rows: [["[[pic:alert]] A", "[[html]]<b>B</b>"], ["", ""]], colWidths: [30, 70], rowColors: ["#eee"],
  merges: [{ r: 1, c: 0, span: 2, rowSpan: 1 }], pictogram: "info" } };
const image: Block = { id: "i", type: "image", template: "T1", order: 3, content: {
  url: "u", alt: "Pohled", width: 300, size: "half", position: "left", numbered: false } };

describe("mergeImageAndTable", () => {
  it("transfers all fields and keeps image id/template/order", () => {
    const m = mergeImageAndTable(image, table);
    expect(m).toMatchObject({ id: "i", type: "image-table", template: "T1", order: 3 });
    expect(m.content.image).toEqual({ url: "u", alt: "Pohled", width: 300, size: "half", numbered: false });
    const { pictogram, ...rest } = table.content;
    expect(m.content.table).toEqual(rest);
  });
  it("drops position", () => expect(mergeImageAndTable(image, table).content.image.position).toBeUndefined());
  it("uses table pictogram when image has none", () => expect(mergeImageAndTable(image, table).content.pictogram).toBe("info"));
  it("prefers image pictogram", () => expect(mergeImageAndTable({ ...image, content: { ...image.content, pictogram: "alert" } }, table).content.pictogram).toBe("alert"));
  it("no pictogram when neither has one", () => {
    const m = mergeImageAndTable(image, { ...table, content: { ...table.content, pictogram: "none" } });
    expect(m.content.pictogram).toBeUndefined();
  });
  it("round-trips split → merge", () => {
    const orig: Block = { id: "x", type: "image-table", template: "T", order: 0, content: { image: { url: "u", alt: "a", size: "full" }, table: { headerRow: false, rows: [["1"]], merges: [] }, pictogram: "recycling" } };
    const [img, tbl] = splitImageTableBlock(orig);
    expect(mergeImageAndTable(img, tbl)).toEqual(orig);
  });
});

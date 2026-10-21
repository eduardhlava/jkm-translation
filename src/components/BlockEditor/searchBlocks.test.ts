import { describe, expect, it } from "vitest";
import { searchBlocks } from "./searchBlocks";
import type { Block } from "./types";

const b = (id: string, type: Block["type"], content: any, order: number): Block => ({ id, type, content, order, template: "" });
const blocks: Block[] = [
  b("h", "heading3", { text: "Záruka a servis" }, 0),
  b("t", "text", { html: "<p>Obsluha <strong>stroje</strong></p>" }, 1),
  b("w", "warning", { text: "Nebezpečí úrazu" }, 2),
  b("i", "image", { url: "x", alt: "Pohled zepředu" }, 3),
  b("tb", "table", { headerRow: false, rows: [["[[pic:alert]] Napětí 230 V", "[[html]]<b>Tlak</b> oleje"]] }, 4),
  b("it", "image-table", { image: { url: "", alt: "Schéma" }, table: { headerRow: false, rows: [["Ventil"]] } }, 5),
];

describe("searchBlocks", () => {
  it("ignores case", () => expect(searchBlocks(blocks, "ZÁRUKA")).toEqual(["h"]));
  it("ignores diacritics", () => expect(searchBlocks(blocks, "zaruka")).toEqual(["h"]));
  it("matches substrings", () => expect(searchBlocks(blocks, "ruk")).toEqual(["h"]));
  it("searches text blocks without HTML", () => {
    expect(searchBlocks(blocks, "obsluha stroje")).toEqual(["t"]);
    expect(searchBlocks(blocks, "strong")).toEqual([]);
  });
  it("searches callouts", () => expect(searchBlocks(blocks, "urazu")).toEqual(["w"]));
  it("searches image alt", () => expect(searchBlocks(blocks, "zepredu")).toEqual(["i"]));
  it("searches table cells without tokens", () => {
    expect(searchBlocks(blocks, "napeti")).toEqual(["tb"]);
    expect(searchBlocks(blocks, "tlak oleje")).toEqual(["tb"]);
    expect(searchBlocks(blocks, "pic:alert")).toEqual([]);
    expect(searchBlocks(blocks, "html")).toEqual([]);
  });
  it("searches image-table alt and cells", () => {
    expect(searchBlocks(blocks, "schema")).toEqual(["it"]);
    expect(searchBlocks(blocks, "ventil")).toEqual(["it"]);
  });
  it("returns nothing for empty query", () => expect(searchBlocks(blocks, "  ")).toEqual([]));
  it("returns each block once in document order", () => expect(searchBlocks(blocks, "e")).toEqual(["h", "t", "w", "i", "tb", "it"]));
});

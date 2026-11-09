import { describe, expect, it } from "vitest";
import {
  buildCellSymbolText, collectSymbolCodes, extractSymbolsFromHtml, extractSymbolTokens, formatSymbolToken,
  injectSymbolTokens, slugifySymbolName, splitCellSymbols, uniqueSymbolCode,
} from "./symbolTokens";

describe("symbol tokens", () => {
  it("formats and parses a token", () => {
    const t = formatSymbolToken({ code: "screw-cz", w: 20, pos: "right" });
    expect(t).toBe("[[sym:screw-cz|w=20|pos=right]]");
    expect(extractSymbolTokens(`${t} Text`).symbols).toEqual([{ code: "screw-cz", w: 20, pos: "right" }]);
  });

  it("tolerates spaces, uppercase, comma decimals and full-width bar", () => {
    const r = extractSymbolTokens("[[ SYM : Screw-CZ ｜ w = 12,5 | pos = LEFT ]] x");
    expect(r.symbols).toEqual([{ code: "screw-cz", w: 12.5, pos: "left" }]);
    expect(r.text).toBe("x");
  });

  it("falls back to defaults for missing or unknown params", () => {
    expect(extractSymbolTokens("[[sym:a]]").symbols).toEqual([{ code: "a", w: 20, pos: "left" }]);
    expect(extractSymbolTokens("[[sym:a|w=abc|pos=nowhere]]").symbols).toEqual([{ code: "a", w: 20, pos: "left" }]);
  });

  it("keeps a broken token as visible text", () => {
    const r = extractSymbolTokens("[[sym:a|w=20 text");
    expect(r.symbols).toEqual([]);
    expect(r.text).toBe("[[sym:a|w=20 text");
  });

  it("does not touch built-in pictogram tokens", () => {
    expect(extractSymbolTokens("[[pic:alert]] x").text).toBe("[[pic:alert]] x");
  });

  it("round-trips cell content with rich HTML", () => {
    const value = buildCellSymbolText([{ code: "a", w: 10, pos: "top" }], "[[html]]<strong>x</strong>");
    expect(splitCellSymbols(value)).toEqual({ symbols: [{ code: "a", w: 10, pos: "top" }], rest: "[[html]]<strong>x</strong>" });
  });

  it("cells reject text-only positions", () => {
    expect(splitCellSymbols("[[sym:a|pos=right]]x").symbols[0].pos).toBe("left");
  });

  it("round-trips text block symbols through HTML", () => {
    const syms = [{ code: "a", w: 20, pos: "left" as const }, { code: "b", w: 15, pos: "center" as const }];
    const html = injectSymbolTokens("<p>Ahoj <strong>světe</strong></p>", syms);
    expect(extractSymbolsFromHtml(html)).toEqual({ symbols: syms, html: "<p>Ahoj <strong>světe</strong></p>" });
  });

  it("symbol-only text block keeps symbols with empty text", () => {
    const html = injectSymbolTokens("", [{ code: "a", w: 20, pos: "left" }]);
    expect(extractSymbolsFromHtml(html)).toEqual({ symbols: [{ code: "a", w: 20, pos: "left" }], html: "" });
  });

  it("slugifies names and resolves collisions", () => {
    expect(slugifySymbolName("Výstraha – dotažení šroubů CZ.png")).toBe("vystraha-dotazeni-sroubu-cz");
    expect(uniqueSymbolCode("a", new Set(["a", "a-2"]))).toBe("a-3");
  });

  it("collects codes from text blocks and both table kinds", () => {
    const codes = collectSymbolCodes([
      { type: "text", content: { html: "", symbols: [{ code: "t", w: 20, pos: "left" }] } },
      { type: "table", content: { rows: [["[[sym:c1]]x"]] } },
      { type: "image-table", content: { table: { rows: [["[[pic:info]]", "[[sym:c2|pos=top]]"]] } } },
    ]);
    expect([...codes].sort()).toEqual(["c1", "c2", "t"]);
  });
});

import { describe, expect, it } from "vitest";
import { symbolThumbDimensions } from "./SymbolThumb";

describe("symbol thumbnail dimensions", () => {
  const portraitRatio = 2129 / 4020;

  it("limits a library portrait to 128 px without changing its ratio", () => {
    const size = symbolThumbDimensions(180, portraitRatio, 128);
    expect(size.height).toBeCloseTo(128);
    expect(size.width).toBeCloseTo(128 * portraitRatio);
  });

  it("limits a picker portrait to 72 px", () => {
    expect(symbolThumbDimensions(112, portraitRatio, 72).height).toBe(72);
  });

  it("keeps a landscape library label at 180 by 90 px", () => {
    expect(symbolThumbDimensions(180, 2, 128)).toEqual({ width: 180, height: 90 });
  });

  it("fits square and unknown thumbnails in the same bounded box", () => {
    expect(symbolThumbDimensions(180, 1, 128)).toEqual({ width: 128, height: 128 });
  });

  it("bounds portrait thumbnails beside editor controls to 24 px", () => {
    expect(symbolThumbDimensions(24, portraitRatio, 24).height).toBe(24);
  });

  it("preserves unbounded editor dimensions", () => {
    expect(symbolThumbDimensions(96, portraitRatio)).toEqual({ width: 96, height: 96 / portraitRatio });
  });
});
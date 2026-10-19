import { describe, it, expect } from "vitest";
import { layoutFingerprint } from "./fingerprint";
import type { Block } from "@/components/BlockEditor/types";

const img = (url: string): Block => ({
  id: "img1",
  type: "image",
  template: "default",
  order: 0,
  content: { url, alt: "popisek" },
});

const imgTable = (url: string): Block => ({
  id: "it1",
  type: "image-table",
  template: "default",
  order: 0,
  content: { image: { url, alt: "" }, table: { headerRow: true, rows: [["a"]] } },
});

const text = (): Block => ({
  id: "t1",
  type: "text",
  template: "default",
  order: 1,
  content: { html: "text" },
});

describe("layoutFingerprint", () => {
  it("ignoruje změnu URL obrázku (rehydratace nezamkne náhled)", () => {
    const a = layoutFingerprint([img("https://docasna-url/1"), text()], true, undefined);
    const b = layoutFingerprint([img("https://permanentni-url/1"), text()], true, undefined);
    expect(a).toBe(b);
  });

  it("ignoruje změnu URL obrázku v image-table", () => {
    const a = layoutFingerprint([imgTable("https://docasna-url/1")], false, undefined);
    const b = layoutFingerprint([imgTable("https://permanentni-url/1")], false, undefined);
    expect(a).toBe(b);
  });

  it("reaguje na změnu textu bloku", () => {
    const a = layoutFingerprint([text()], true, undefined);
    const b = layoutFingerprint([{ ...text(), content: { html: "jiný text" } }], true, undefined);
    expect(a).not.toBe(b);
  });

  it("reaguje na změnu numberHeadings", () => {
    const a = layoutFingerprint([text()], true, undefined);
    const b = layoutFingerprint([text()], false, undefined);
    expect(a).not.toBe(b);
  });
});

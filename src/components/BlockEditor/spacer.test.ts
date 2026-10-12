import { describe, expect, it } from "vitest";
import { createBlock } from "./types";
import { blocksToHtml } from "./serialize";
import { parseDocumentHtml, parseDocumentJson } from "./importJson";

describe("structural spacer round trips", () => {
  it("accepts a spacer from JSON", () => {
    const { blocks } = parseDocumentJson('[{"type":"spacer"}]');
    expect(blocks[0].type).toBe("spacer");
    expect(blocks[0].content).toEqual({});
  });

  it("preserves spacing between paragraphs in HTML", () => {
    const blocks = [createBlock("text", 0), createBlock("spacer", 1), createBlock("text", 2)];
    blocks[0].content = { html: "<p>Před mezerou</p>" };
    blocks[2].content = { html: "<p>Za mezerou</p>" };
    const imported = parseDocumentHtml(blocksToHtml(blocks)).blocks;
    expect(imported.map((b) => b.type)).toEqual(["text", "spacer", "text"]);
    expect(imported[1].id).toBe(blocks[1].id);
  });

  it("restores the marker even when Notion drops the empty spacer element", () => {
    const html = blocksToHtml([createBlock("spacer", 0), createBlock("heading2", 1)]);
    const notionHtml = html.replace(/<div data-lov-spacer[^>]*><\/div>/, "");
    expect(parseDocumentHtml(notionHtml).blocks.map((b) => b.type)).toEqual(["spacer", "heading2"]);
  });
});
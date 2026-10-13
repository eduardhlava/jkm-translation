import { describe, expect, it } from "vitest";
import { createBlock, parseCellPictogram } from "./types";
import { cellHtmlToValue, cellTextToHtml, cellPlainText } from "./cellFormatting";
import { blocksToHtml } from "./serialize";
import { parseDocumentHtml } from "./importJson";

describe("table cell formatting", () => {
  it("keeps legacy literal markup and line breaks as plain text", () => {
    expect(cellTextToHtml("A < B & C\nnext")).toBe("A &lt; B &amp; C<br>next");
    expect(cellHtmlToValue("A &lt; B<br>next")).toBe("A < B\nnext");
  });
  it("sanitizes pasted markup, preserving combined inline styles", () => {
    const value = cellHtmlToValue('<span style="font-weight:bold;font-style:italic;text-decoration:underline;font-family:Arial">Test</span><script>bad()</script>');
    expect(cellTextToHtml(value)).toBe("<u><em><strong>Test</strong></em></u>");
    expect(cellPlainText(value)).toBe("Test");
  });
  for (const type of ["table", "image-table"] as const) {
    it(`round trips ${type} B/I/U, indices, pictograms and breaks`, () => {
      const block = createBlock(type, 0);
      const rows = [["[[pic:alert-electric]] " + cellHtmlToValue("<b><i><u>Combined</u></i></b><br>H<sub>2</sub>O x<sup>2</sup>")]];
      block.content = type === "table" ? { headerRow: false, rows } : { image: { url: "test.png" }, table: { headerRow: false, rows } };
      const html = blocksToHtml([block]);
      expect(html).not.toContain("[[html]]</td>");
      // Simulate native Notion dropping unsupported index tags, but keeping annotations.
      const imported = parseDocumentHtml(html.replace(/<\/?(?:sup|sub)>/g, "")).blocks[0];
      const table = type === "table" ? imported.content : imported.content.table;
      expect(table.rows).toEqual(rows);
      expect(parseCellPictogram(table.rows[0][0]).pictogram).toBe("alert-electric");
    });
  }
  it("reads native Notion annotations without needing app metadata", () => {
    const block = parseDocumentHtml('<table><tr><td>⚡ <strong><em><u>Text</u></em></strong>\nNext</td></tr></table>').blocks[0];
    expect(cellTextToHtml(parseCellPictogram(block.content.rows[0][0]).text)).toBe("<strong><em><u>Text</u></em></strong><br>Next");
  });
});
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("./SymbolThumb", () => ({ default: ({ code }: { code: string }) => <img data-testid={`sym-${code}`} alt="" /> }));
import { TextSymbolsLayout } from "./SymbolEditors";

const Editor = () => <div data-testid="ed" contentEditable suppressContentEditableWarning />;

describe("TextSymbolsLayout", () => {
  it("keeps the same editor DOM node when the first symbol is added (no remount)", () => {
    const { getByTestId, rerender } = render(<TextSymbolsLayout symbols={[]}><Editor /></TextSymbolsLayout>);
    const before = getByTestId("ed");
    before.innerHTML = "text";
    rerender(<TextSymbolsLayout symbols={[{ code: "a", w: 20, pos: "left" }]}><Editor /></TextSymbolsLayout>);
    expect(getByTestId("ed")).toBe(before);
    expect(getByTestId("ed").innerHTML).toBe("text");
  });

  it("left puts the symbol before the editor, right after it", () => {
    const order = (pos: "left" | "right") => {
      const { container, unmount } = render(<TextSymbolsLayout symbols={[{ code: "a", w: 20, pos }]}><Editor /></TextSymbolsLayout>);
      const nodes = Array.from(container.querySelectorAll("[data-testid]")).map((n) => n.getAttribute("data-testid"));
      unmount();
      return nodes;
    };
    expect(order("left")).toEqual(["sym-a", "ed"]);
    expect(order("right")).toEqual(["ed", "sym-a"]);
  });
});

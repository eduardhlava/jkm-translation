import { useEffect, useRef } from "react";
import { cellHtmlToValue, cellTextToHtml } from "./cellFormatting";

interface Props {
  value: string;
  onChange: (value: string) => void;
  className: string;
  label: string;
}

export default function TableCellEditor({ value, onChange, className, label }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const lastValue = useRef(value);
  useEffect(() => {
    if (ref.current && (value !== lastValue.current || !ref.current.hasAttribute("data-initialized"))) {
      ref.current.innerHTML = cellTextToHtml(value);
      ref.current.setAttribute("data-initialized", "true");
      lastValue.current = value;
    }
  }, [value]);

  const sync = () => {
    if (!ref.current) return;
    const next = cellHtmlToValue(ref.current.innerHTML);
    lastValue.current = next;
    onChange(next);
  };

  return <div
    ref={ref}
    role="textbox"
    aria-label={label}
    aria-multiline="true"
    contentEditable
    suppressContentEditableWarning
    className={`min-h-8 px-3 py-1 text-sm outline-none whitespace-pre-wrap break-words [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_u]:underline [&_sup]:align-super [&_sup]:static [&_sub]:align-sub [&_sub]:static ${className}`}
    onInput={sync}
    onKeyDown={(e) => {
      e.stopPropagation();
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const cmd = ({ b: "bold", i: "italic", u: "underline" } as Record<string, string>)[e.key.toLowerCase()];
      if (!cmd) return;
      e.preventDefault();
      document.execCommand("styleWithCSS", false, "false");
      document.execCommand(cmd, false);
      sync();
    }}
    onPaste={(e) => {
      e.preventDefault();
      const html = e.clipboardData.getData("text/html");
      const text = e.clipboardData.getData("text/plain");
      // Sanitize pasted markup through the same cell representation as exports.
      document.execCommand("insertHTML", false, html ? cellTextToHtml(cellHtmlToValue(html)) : cellTextToHtml(text));
      sync();
    }}
  />;
}
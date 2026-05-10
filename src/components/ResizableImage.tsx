import { useRef, useState, useCallback, useEffect } from "react";
import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { AlignLeft, AlignCenter, AlignRight, Square } from "lucide-react";

const FloatToolbar = ({ current, onSet }: { current: string; onSet: (v: string) => void }) => {
  const Btn = ({ value, title, children }: any) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onSet(value)}
      className={`p-1 rounded hover:bg-accent ${current === value ? "bg-accent text-accent-foreground" : "text-foreground"}`}
    >
      {children}
    </button>
  );
  return (
    <div className="absolute -top-9 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-md border bg-popover px-1.5 py-1 shadow-md">
      <Btn value="none" title="Bez obtékání"><Square className="w-3.5 h-3.5" /></Btn>
      <Btn value="left" title="Obtékání vpravo (obrázek vlevo)"><AlignLeft className="w-3.5 h-3.5" /></Btn>
      <Btn value="center" title="Na střed"><AlignCenter className="w-3.5 h-3.5" /></Btn>
      <Btn value="right" title="Obtékání vlevo (obrázek vpravo)"><AlignRight className="w-3.5 h-3.5" /></Btn>
    </div>
  );
};

const ResizableImageView = ({ node, updateAttributes, selected }: NodeViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [resizing, setResizing] = useState(false);

  const width: string | null = node.attrs.width;
  const float: string = node.attrs.float || "none";

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = imgRef.current?.getBoundingClientRect().width ?? 200;
      setResizing(true);
      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        const newW = Math.max(50, Math.round(startW + delta));
        updateAttributes({ width: `${newW}px` });
      };
      const onUp = () => {
        setResizing(false);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [updateAttributes],
  );

  const wrapperStyle: React.CSSProperties = {
    position: "relative",
    display: float === "none" || float === "center" ? "block" : "inline-block",
    float: float === "left" ? "left" : float === "right" ? "right" : "none",
    margin:
      float === "left"
        ? "0.25rem 1rem 0.5rem 0"
        : float === "right"
        ? "0.25rem 0 0.5rem 1rem"
        : float === "center"
        ? "0.5rem auto"
        : "0.5rem 0",
    width: width || "auto",
    maxWidth: "100%",
    textAlign: float === "center" ? "center" : undefined,
  };

  return (
    <NodeViewWrapper
      as="div"
      className="resizable-image-wrapper"
      style={wrapperStyle}
      data-float={float}
    >
      <div ref={containerRef} className="relative inline-block max-w-full">
        {selected && <FloatToolbar current={float} onSet={(v) => updateAttributes({ float: v })} />}
        <img
          ref={imgRef}
          src={node.attrs.src}
          alt={node.attrs.alt || ""}
          title={node.attrs.title || ""}
          style={{
            width: width || "auto",
            maxWidth: "100%",
            height: "auto",
            display: "block",
            outline: selected ? "2px solid hsl(var(--primary))" : undefined,
            borderRadius: 4,
            userSelect: "none",
          }}
          draggable={false}
        />
        {selected && (
          <div
            onMouseDown={startResize}
            className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize bg-primary border-2 border-background rounded-sm"
            style={{ transform: "translate(50%, 50%)" }}
            title="Táhnutím změňte velikost"
          />
        )}
        {resizing && imgRef.current && (
          <div className="absolute -top-6 right-0 text-xs bg-popover border rounded px-1.5 py-0.5 shadow">
            {Math.round(imgRef.current.getBoundingClientRect().width)}px
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
};

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) =>
          el.getAttribute("width") ||
          (el as HTMLElement).style.width ||
          null,
        renderHTML: (attrs: any) => {
          if (!attrs.width) return {};
          return { width: attrs.width, style: `width: ${attrs.width}; height: auto;` };
        },
      },
      float: {
        default: "none",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-float") || (el as HTMLElement).style.float || "none",
        renderHTML: (attrs: any) => {
          if (!attrs.float || attrs.float === "none") return {};
          const style =
            attrs.float === "left"
              ? "float: left; margin: 0.25rem 1rem 0.5rem 0;"
              : attrs.float === "right"
              ? "float: right; margin: 0.25rem 0 0.5rem 1rem;"
              : attrs.float === "center"
              ? "display: block; margin: 0.5rem auto;"
              : "";
          return { "data-float": attrs.float, style };
        },
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});

export default ResizableImage;

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ListTree, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { buildDocumentContents } from "./documentContents";
import type { Block } from "./types";

const STORAGE_KEY = "document-editor-contents-open";
const SCROLL_OFFSET = 48;

interface Props {
  blocks: Block[];
  numberHeadings: boolean;
  children: (highlightedId: string | null) => ReactNode;
}

/** UI-only navigation: never writes document data or changes collapsed state. */
export default function DocumentEditorContents({ blocks, numberHeadings, children }: Props) {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "true"; } catch { return false; }
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout>>();
  const items = useMemo(() => buildDocumentContents(blocks, numberHeadings), [blocks, numberHeadings]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(open)); } catch { /* Storage may be unavailable. */ }
  }, [open]);

  useEffect(() => () => { clearTimeout(highlightTimer.current); }, []);

  useEffect(() => {
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const top = scroller.getBoundingClientRect().top + SCROLL_OFFSET + 1;
      const headings = new Map(Array.from(content.querySelectorAll<HTMLElement>("[data-editor-block-id]")).map((el) => [el.dataset.editorBlockId, el]));
      let current: string | null = null;
      for (const item of items) {
        const el = headings.get(item.id);
        if (el && el.getBoundingClientRect().top <= top) current = item.id;
      }
      setActiveId(current);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    scroller.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(content);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      scroller.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [items]);

  useEffect(() => {
    const list = listRef.current;
    if (!open || !list || !activeId) return;
    const el = Array.from(list.querySelectorAll<HTMLElement>("[data-contents-id]")).find((node) => node.dataset.contentsId === activeId);
    if (!el) return;
    const bounds = list.getBoundingClientRect();
    const itemBounds = el.getBoundingClientRect();
    if (itemBounds.top < bounds.top) list.scrollTop += itemBounds.top - bounds.top;
    else if (itemBounds.bottom > bounds.bottom) list.scrollTop += itemBounds.bottom - bounds.bottom;
  }, [activeId, open]);

  const navigate = (id: string) => {
    const target = Array.from(contentRef.current?.querySelectorAll<HTMLElement>("[data-editor-block-id]") ?? []).find((el) => el.dataset.editorBlockId === id);
    if (!target) return;
    target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start", inline: "nearest" });
    setActiveId(id);
    clearTimeout(highlightTimer.current);
    setHighlightedId(id);
    highlightTimer.current = setTimeout(() => setHighlightedId(null), 1500);
    if (window.matchMedia("(max-width: 1023px)").matches) setOpen(false);
  };

  return (
    <div className="relative flex flex-1 min-h-0 overflow-hidden bg-muted">
      <div className="w-8 shrink-0 border-r bg-background/70">
        <Button variant="ghost" className="sticky top-0 h-auto w-8 flex-col gap-2 rounded-none px-1 py-3 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label={open ? "Zavřít obsah" : "Otevřít obsah"} aria-expanded={open} aria-controls="document-editor-contents" onClick={() => setOpen((value) => !value)} title="Obsah">
          <ListTree className="h-4 w-4" />
          <span className="text-xs [writing-mode:vertical-rl]">Obsah</span>
        </Button>
      </div>
      {open && (
        <aside id="document-editor-contents" aria-label="Obsah dokumentu" className="absolute inset-y-0 left-8 z-30 flex w-[280px] max-w-[calc(100%-2rem)] shrink-0 flex-col border-r bg-background shadow-md lg:static lg:z-auto lg:shadow-none">
          <div className="flex h-12 shrink-0 items-center justify-between border-b px-3">
            <h2 className="text-sm font-semibold">Obsah</h2>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Zavřít panel obsahu" title="Zavřít obsah" onClick={() => setOpen(false)}><X /></Button>
          </div>
          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-2">
            <nav aria-label="Kapitoly dokumentu" className="space-y-1">
              {items.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">Dokument zatím nemá žádné nadpisy.</p>}
              {items.map((item) => {
                const label = `${item.number ? `${item.number} ` : ""}${item.text}`;
                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" data-contents-id={item.id} aria-current={activeId === item.id ? "location" : undefined} onClick={() => navigate(item.id)} className={cn("h-auto min-h-8 w-full justify-start whitespace-normal rounded-sm px-2 py-1.5 text-left hover:bg-secondary hover:text-foreground", item.level === 1 && "font-bold", item.level === 2 && "pl-5 font-normal", item.level === 3 && "pl-8 text-xs font-normal", item.unlisted && "text-muted-foreground italic", activeId === item.id && "bg-primary/10 ring-1 ring-inset ring-primary/30")}>
                        <span className="line-clamp-2 break-words">{label}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs break-words">{label}</TooltipContent>
                  </Tooltip>
                );
              })}
            </nav>
          </div>
        </aside>
      )}
      <div ref={scrollRef} data-document-editor-scroll className="min-w-0 flex-1 overflow-auto p-4">
        <div ref={contentRef} className="mx-auto max-w-4xl">{children(highlightedId)}</div>
      </div>
    </div>
  );
}
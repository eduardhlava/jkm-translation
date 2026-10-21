import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ChevronDown, ChevronUp, ChevronsDownUp, ChevronsUpDown, Search, X } from "lucide-react";
import { searchBlocks } from "./searchBlocks";
import { Button } from "@/components/ui/button";
import BlockItem from "./BlockItem";
import AddBlockMenu from "./AddBlockMenu";
import { createBlock, type Block, type BlockType } from "./types";
import { computeHeadingNumbers } from "./headingNumbers";
import { computeImageNumbers } from "./imageNumbers";
import { splitImageTableBlock } from "./splitImageTable";
import { pairedImageIds } from "@/lib/pdf/imageWrap";

interface Props {
  blocks: Block[];
  onChange: (next: Block[]) => void;
  numberHeadings?: boolean;
  imageLabelPrefix?: string;
  imageLabelUnnumbered?: string;
  collapsed?: Record<string, boolean>;
  onCollapsedChange?: (next: Record<string, boolean>) => void;
  leftSlot?: React.ReactNode;
  highlightedBlockId?: string | null;
}


export default function BlockEditor({ blocks, onChange, numberHeadings, imageLabelPrefix, imageLabelUnnumbered, collapsed: collapsedProp, onCollapsedChange, leftSlot, highlightedBlockId }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sorted = [...blocks].sort((a, b) => a.order - b.order);
  const numbersMap = numberHeadings ? computeHeadingNumbers(sorted, 4) : null;
  const imageNumbersMap = computeImageNumbers(sorted);


  const [collapsedLocal, setCollapsedLocal] = useState<Record<string, boolean>>({});
  const collapsed = collapsedProp ?? collapsedLocal;
  const setCollapsed = (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => {
    if (onCollapsedChange) onCollapsedChange(updater(collapsed));
    else setCollapsedLocal(updater);
  };

  const reorder = (next: Block[]) => {
    onChange(next.map((b, i) => ({ ...b, order: i })));
  };


  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = sorted.findIndex((b) => b.id === active.id);
    const newIndex = sorted.findIndex((b) => b.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    reorder(arrayMove(sorted, oldIndex, newIndex));
  };

  const addBlock = (type: BlockType) => {
    const next = [...sorted, createBlock(type, sorted.length)];
    onChange(next);
  };

  const insertBlockAt = (index: number, type: BlockType) => {
    const next = [...sorted];
    next.splice(index, 0, createBlock(type, index));
    reorder(next);
  };


  const updateBlock = (id: string, patch: Partial<Block>) => {
    onChange(sorted.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const deleteBlock = (id: string) => {
    reorder(sorted.filter((b) => b.id !== id));
  };

  const splitBlock = (id: string) => {
    const idx = sorted.findIndex((b) => b.id === id);
    if (idx < 0 || sorted[idx].type !== "image-table") return;
    const [image, table] = splitImageTableBlock(sorted[idx]);
    const next = [...sorted];
    next.splice(idx, 1, image, table);
    reorder(next);
  };

  const toggleCollapsed = (id: string) =>
    setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  const collapseAll = () =>
    setCollapsed(() => Object.fromEntries(sorted.map((b) => [b.id, true])));
  const expandAll = () => setCollapsed(() => ({}));

  // Sticky toolbar: detect "stuck" (scrolled away from the top) via the
  // nearest scrolling ancestor's scrollTop, so only icons show while stuck.
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const scroller = el.closest(".overflow-auto");
    if (!scroller) return;
    const onScroll = () => setStuck((scroller as HTMLElement).scrollTop > 4);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);

  // In-document search: UI only, never touches blocks or collapsed state.
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[] | null>(null);
  const [resultIndex, setResultIndex] = useState(0);
  const [searchHighlight, setSearchHighlight] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastQuery = useRef("");
  const lastBlocks = useRef<Block[] | null>(null);
  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const goTo = (id: string) => {
    const scroller = toolbarRef.current?.closest(".overflow-auto") as HTMLElement | null;
    const target = Array.from(document.querySelectorAll<HTMLElement>("[data-editor-block-id]")).find((el) => el.dataset.editorBlockId === id);
    if (scroller && target) {
      scroller.scrollTo({ top: scroller.scrollTop + target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 48, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
    clearTimeout(searchTimer.current);
    setSearchHighlight(id);
    searchTimer.current = setTimeout(() => { console.log("DBG timer"); setSearchHighlight(null); }, 1500); console.log("DBG goTo", id);
  };

  const step = (dir: 1 | -1) => {
    let list = results;
    let idx = resultIndex;
    if (!list || lastQuery.current !== query || lastBlocks.current !== blocks) {
      list = searchBlocks(blocks, query);
      lastQuery.current = query;
      lastBlocks.current = blocks;
      idx = dir === 1 ? 0 : list.length - 1;
    } else if (list.length) {
      idx = (idx + dir + list.length) % list.length;
    }
    setResults(list);
    setResultIndex(Math.max(0, idx));
    if (list.length) goTo(list[Math.max(0, idx)]);
  };

  const clearSearch = () => { console.log("DBG clear", new Error().stack);
    setQuery("");
    setResults(null);
    setResultIndex(0);
    setSearchHighlight(null);
    lastQuery.current = "";
  };
  const matched = new Set(results ?? []);
  const activeHighlight = searchHighlight ?? highlightedBlockId;

  return (
    <div className="space-y-3">
      {leftSlot && <div className="flex items-center gap-2">{leftSlot}</div>}
      {sorted.length > 0 && (
        // Only the button group sticks: a compact pill pinned to the top-right.
        // The wrapper ignores pointer events so blocks under it stay clickable.
        <div
          ref={toolbarRef}
          className={cn(
            "sticky top-0 z-20 ml-auto w-fit pointer-events-none",
            stuck &&
              "rounded-md bg-muted-foreground/15 px-1.5 py-1 shadow-sm backdrop-blur-sm"
          )}
        >
          <div className="flex items-center gap-1 pointer-events-auto">
            <div className="relative w-[220px]">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); if (query.trim()) step(e.shiftKey ? -1 : 1); }
                  else if (e.key === "Escape") { e.preventDefault(); clearSearch(); }
                }}
                placeholder="Hledat v dokumentu…"
                aria-label="Hledat v dokumentu"
                className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {query && (
                <button type="button" onClick={clearSearch} aria-label="Zrušit hledání" title="Zrušit hledání" className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {results && (
              results.length === 0 ? (
                <span className="whitespace-nowrap px-1 text-xs text-muted-foreground">Nic nenalezeno</span>
              ) : (
                <>
                  <span className="whitespace-nowrap px-1 text-xs tabular-nums text-muted-foreground" aria-live="polite">{resultIndex + 1} / {results.length}</span>
                  <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => step(-1)} aria-label="Předchozí výsledek" title="Předchozí výsledek"><ChevronUp className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => step(1)} aria-label="Další výsledek" title="Další výsledek"><ChevronDown className="h-4 w-4" /></Button>
                </>
              )
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2"
              onClick={collapseAll}
              aria-label="Sbalit vše"
              title="Sbalit vše"
            >
              <ChevronsDownUp className="w-4 h-4" />
              {!stuck && <span className="ml-1">Sbalit vše</span>}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2"
              onClick={expandAll}
              aria-label="Rozbalit vše"
              title="Rozbalit vše"
            >
              <ChevronsUpDown className="w-4 h-4" />
              {!stuck && <span className="ml-1">Rozbalit vše</span>}
            </Button>
          </div>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={sorted.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {sorted.length === 0 && (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                Zatím žádné bloky. Začněte tlačítkem „Přidat blok".
              </div>
            )}
            {(() => { const paired = pairedImageIds(sorted); return sorted.map((b, i) => (
              <div key={b.id} data-editor-block-id={b.id} className={cn(
                "relative scroll-mt-12 rounded-lg",
                "after:pointer-events-none after:absolute after:inset-x-0 after:top-0 after:bottom-2 after:z-10 after:rounded-lg after:bg-primary/10 after:ring-1 after:ring-primary/40 after:opacity-0 after:transition-opacity after:duration-500 motion-reduce:after:transition-none",
                activeHighlight === b.id && "after:opacity-100",
                matched.has(b.id) && "before:pointer-events-none before:absolute before:-left-2 before:top-0 before:bottom-2 before:w-1 before:rounded-full before:bg-primary/40",
              )}>
                <BlockItem
                  block={b}
                  collapsed={!!collapsed[b.id]}
                  onToggleCollapsed={() => toggleCollapsed(b.id)}
                  onChange={updateBlock}
                  onDelete={deleteBlock}
                  onSplit={splitBlock}
                  headingNumber={numbersMap?.get(b.id)}
                  imageNumber={imageNumbersMap.get(b.id)}
                  imageLabelPrefix={imageLabelPrefix}
                  imageLabelUnnumbered={imageLabelUnnumbered}
                  pairedInPdf={paired.has(b.id)}
                  nextTextHtml={paired.has(b.id) ? undefined : (() => {
                    const htmls: string[] = [];
                    for (let j = i + 1; j < sorted.length && sorted[j].type === "text"; j++) htmls.push(sorted[j].content?.html ?? "");
                    return htmls.length ? htmls.map((h) => `<p>${h}</p>`).join("") : undefined;
                  })()}
                />
                <div className="group relative flex h-2 items-center justify-center">
                  <div className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <AddBlockMenu
                      compact
                      label="Vložit blok"
                      onAdd={(t) => insertBlockAt(i + 1, t)}
                    />
                  </div>
                </div>
              </div>
            )); })()}
          </div>
        </SortableContext>
      </DndContext>
      <div className="flex justify-center pt-2">
        <AddBlockMenu onAdd={addBlock} />
      </div>

    </div>
  );
}

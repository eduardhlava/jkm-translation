import { useState } from "react";
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
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import BlockItem from "./BlockItem";
import AddBlockMenu from "./AddBlockMenu";
import { createBlock, type Block, type BlockType } from "./types";
import { computeHeadingNumbers } from "./headingNumbers";
import { computeImageNumbers } from "./imageNumbers";

interface Props {
  blocks: Block[];
  onChange: (next: Block[]) => void;
  numberHeadings?: boolean;
  imageLabelPrefix?: string;
  collapsed?: Record<string, boolean>;
  onCollapsedChange?: (next: Record<string, boolean>) => void;
  leftSlot?: React.ReactNode;
}


export default function BlockEditor({ blocks, onChange, numberHeadings, imageLabelPrefix, collapsed: collapsedProp, onCollapsedChange, leftSlot }: Props) {
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

  const toggleCollapsed = (id: string) =>
    setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  const collapseAll = () =>
    setCollapsed(() => Object.fromEntries(sorted.map((b) => [b.id, true])));
  const expandAll = () => setCollapsed(() => ({}));

  return (
    <div className="space-y-3">
      {(sorted.length > 0 || leftSlot) && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">{leftSlot}</div>
          {sorted.length > 0 && (
            <div className="flex gap-1">
              <Button type="button" variant="outline" size="sm" onClick={collapseAll}>
                <ChevronsDownUp className="w-4 h-4 mr-1" /> Sbalit vše
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={expandAll}>
                <ChevronsUpDown className="w-4 h-4 mr-1" /> Rozbalit vše
              </Button>
            </div>
          )}
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
            {sorted.map((b, i) => (
              <div key={b.id}>
                <BlockItem
                  block={b}
                  collapsed={!!collapsed[b.id]}
                  onToggleCollapsed={() => toggleCollapsed(b.id)}
                  onChange={updateBlock}
                  onDelete={deleteBlock}
                  headingNumber={numbersMap?.get(b.id)}
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
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <div className="flex justify-center pt-2">
        <AddBlockMenu onAdd={addBlock} />
      </div>

    </div>
  );
}

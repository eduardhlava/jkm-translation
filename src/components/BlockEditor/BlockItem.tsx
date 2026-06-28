import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, AlertTriangle, Info, AlertCircle, Loader2, Upload, Plus, Minus, ChevronDown, ChevronRight, List, ListMinus, ListOrdered, Link, ImageIcon, AlignLeft, AlignCenter, AlignRight, SeparatorHorizontal, Pencil, MoreVertical } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BLOCK_TYPE_LABELS, type Block, type Pictogram } from "./types";
import { supabase } from "@/integrations/supabase/client";
import NotionImagePicker from "@/components/NotionImagePicker";
import NotionImageUploadDialog from "@/components/NotionImageUploadDialog";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

// Shared highlight palette — used for text background and table row background.
export const HIGHLIGHT_COLORS: Array<{ key: string; label: string; color: string }> = [
  { key: "orange", label: "Oranžová", color: "#f5a25d" },
  { key: "red",    label: "Červená",  color: "#e07856" },
  { key: "green",  label: "Zelená",   color: "#9ec99a" },
  { key: "blue",   label: "Modrá",    color: "#a9c8e6" },
];

interface Props {
  block: Block;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onChange: (id: string, patch: Partial<Block>) => void;
  onDelete: (id: string) => void;
  headingNumber?: string;
  imageNumber?: number;
  imageLabelPrefix?: string;
}


function blockPreview(block: Block): string {
  switch (block.type) {
    case "heading1":
    case "heading2":
    case "heading3":
    case "heading4":
      return block.content?.text || "";
    case "text": {
      const tmp = document.createElement("div");
      tmp.innerHTML = block.content?.html || "";
      return tmp.textContent || "";
    }
    case "alert":
    case "info":
    case "warning":
      return block.content?.text || "";
    case "image":
      return block.content?.alt || block.content?.url || "";
    case "image-table": {
      const alt = block.content?.image?.alt || block.content?.image?.url || "";
      const rows: string[][] = block.content?.table?.rows ?? [];
      const tablePreview = rows[0]?.filter(Boolean).join(" • ") || `${rows.length} řádků`;
      return [alt, tablePreview].filter(Boolean).join(" — ");
    }
    case "table": {
      const rows: string[][] = block.content?.rows ?? [];
      return rows[0]?.filter(Boolean).join(" • ") || `${rows.length} řádků`;
    }
    case "pagebreak":
      return "— konec stránky —";
    default:
      return "";
  }
}

export default function BlockItem({ block, collapsed, onToggleCollapsed, onChange, onDelete, headingNumber, imageNumber, imageLabelPrefix }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const preview = blockPreview(block);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative rounded-lg border border-muted-foreground/30 bg-card shadow-sm"
    >
      <BlockHeader
        block={block}
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
        onChange={onChange}
        onDelete={onDelete}
        preview={preview}
        attributes={attributes}
        listeners={listeners}
      />
      {!collapsed && (
        <div className="p-3">
          <BlockBody block={block} onChange={onChange} headingNumber={headingNumber} imageNumber={imageNumber} imageLabelPrefix={imageLabelPrefix} />
        </div>
      )}
    </div>
  );
}


function BlockHeader({
  block,
  collapsed,
  onToggleCollapsed,
  onChange,
  onDelete,
  preview,
  attributes,
  listeners,
}: {
  block: Block;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onChange: Props["onChange"];
  onDelete: Props["onDelete"];
  preview: string;
  attributes: any;
  listeners: any;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <div className={`flex items-center justify-between border-b border-muted-foreground/30 px-2 py-1 ${block.type === "image" || block.type === "image-table" ? "bg-success/10" : "bg-muted/30"}`}>
      <div className="flex items-center gap-1 min-w-0 flex-1">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Přesunout"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={collapsed ? "Rozbalit" : "Sbalit"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {block.type.startsWith("heading") ? (
          <Select
            value={block.type}
            onValueChange={(v) => onChange(block.id, { type: v as Block["type"] })}
          >
            <SelectTrigger className="h-6 w-auto text-xs border-0 bg-transparent px-0 shadow-none focus:ring-0 [&>svg:last-child]:hidden group-hover:bg-accent/30 rounded px-1 -ml-1">
              <Pencil className="w-3 h-3 mr-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              <SelectValue>{BLOCK_TYPE_LABELS[block.type]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="heading1">Nadpis 1</SelectItem>
              <SelectItem value="heading2">Nadpis 2</SelectItem>
              <SelectItem value="heading3">Nadpis 3</SelectItem>
              <SelectItem value="heading4">Nadpis 4</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs font-medium text-muted-foreground shrink-0">
            {BLOCK_TYPE_LABELS[block.type]}
          </span>
        )}
        {collapsed && preview && (
          <span className="ml-2 truncate text-xs text-muted-foreground/80">— {preview}</span>
        )}
      </div>
      <div className="flex items-center gap-10">
        {block.type.startsWith("heading") && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-default">
                {block.content.unlisted ? (
                  <span className="relative inline-flex items-center justify-center">
                    <ListMinus className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="w-[120%] h-[1.5px] bg-destructive rotate-45 rounded-full" />
                    </span>
                  </span>
                ) : (
                  <ListOrdered className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <Switch
                  checked={!!block.content.unlisted}
                  onCheckedChange={(v) => setContent(block, { unlisted: v }, onChange)}
                  className="data-[state=unchecked]:bg-muted-foreground/30 data-[state=checked]:bg-foreground scale-75 origin-center"
                  aria-label={
                    block.content.unlisted
                      ? "Nadpis je vyřazen z číslování a obsahu"
                      : "Nadpis je číslován a zahrnut do obsahu"
                  }
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              {block.content.unlisted
                ? "Nadpis je vyřazen z číslování a obsahu"
                : "Nadpis je číslován a zahrnut do obsahu"}
            </TooltipContent>
          </Tooltip>
        )}
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Smazat blok?</AlertDialogTitle>
              <AlertDialogDescription>
                Tento blok bude odstraněn. Tuto akci nelze vrátit zpět.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušit</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(block.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Smazat
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}




function setContent(block: Block, patch: any, onChange: Props["onChange"]) {
  onChange(block.id, { content: { ...block.content, ...patch } });
}

function BlockBody({ block, onChange, headingNumber, imageNumber, imageLabelPrefix }: { block: Block; onChange: Props["onChange"]; headingNumber?: string; imageNumber?: number; imageLabelPrefix?: string }) {
  switch (block.type) {
    case "heading1":
    case "heading2":
    case "heading3":
    case "heading4": {
      const sizeCls = {
        heading1: "text-2xl font-bold",
        heading2: "text-xl font-bold",
        heading3: "text-lg font-semibold",
        heading4: "text-base font-semibold",
      }[block.type];
      return (
        <div className={`flex items-baseline gap-2 ${sizeCls}`}>
          {headingNumber && <span className="text-muted-foreground shrink-0">{headingNumber}</span>}
          <Input
            value={block.content.text ?? ""}
            onChange={(e) => setContent(block, { text: e.target.value }, onChange)}
            placeholder={BLOCK_TYPE_LABELS[block.type]}
            className={`border-0 shadow-none focus-visible:ring-0 px-0 h-auto py-1 flex-1 ${sizeCls}`}
          />
        </div>
      );
    }


    case "text":
      return <TextBlockEditor block={block} onChange={onChange} />;
    case "image":
      return <ImageBlockEditor block={block} onChange={onChange} imageNumber={imageNumber} imageLabelPrefix={imageLabelPrefix} />;
    case "table":
      return <TableBlockEditor block={block} onChange={onChange} />;
    case "image-table":
      return <ImageTableBlockEditor block={block} onChange={onChange} imageNumber={imageNumber} imageLabelPrefix={imageLabelPrefix} />;
    case "alert":
    case "info":
    case "warning":
      return <CalloutBlockEditor block={block} onChange={onChange} />;
    case "pagebreak":
      return <PageBreakBlock />;
  }
}

function PageBreakBlock() {
  return (
    <div className="flex items-center gap-2 py-2 text-xs uppercase tracking-wider text-muted-foreground">
      <div className="h-px flex-1 border-t border-dashed" />
      <SeparatorHorizontal className="h-4 w-4" />
      <span>Konec stránky</span>
      <div className="h-px flex-1 border-t border-dashed" />
    </div>
  );
}

function TextBlockEditor({ block, onChange }: { block: Block; onChange: Props["onChange"] }) {
  const ref = useRef<HTMLDivElement>(null);
  const lastHtmlRef = useRef<string>(block.content.html ?? "");
  const selectionRef = useRef<Range | null>(null);

  const saveSelection = () => {
    const editor = ref.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      selectionRef.current = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    const editor = ref.current;
    const selection = window.getSelection();
    if (!editor || !selection) return;

    editor.focus();
    selection.removeAllRanges();
    if (selectionRef.current) {
      selection.addRange(selectionRef.current);
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.addRange(range);
  };

  const getEditorSelection = () => {
    const editor = ref.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    return editor.contains(range.commonAncestorContainer) ? range : null;
  };

  const escapeHtml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  // Initialize innerHTML once per block id; avoid re-setting on every keystroke
  // (which would reset the caret to the beginning).
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (block.content.html ?? "")) {
      ref.current.innerHTML = block.content.html ?? "";
      lastHtmlRef.current = block.content.html ?? "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.id]);

  // If parent updates html externally (not from our own input), sync DOM.
  useEffect(() => {
    const incoming = block.content.html ?? "";
    if (incoming !== lastHtmlRef.current && ref.current && ref.current.innerHTML !== incoming) {
      ref.current.innerHTML = incoming;
      lastHtmlRef.current = incoming;
    }
  }, [block.content.html]);

  const syncHtml = () => {
    if (ref.current) {
      const html = ref.current.innerHTML;
      lastHtmlRef.current = html;
      onChange(block.id, { content: { ...block.content, html } });
      saveSelection();
    }
  };

  const exec = (cmd: string, value?: string) => {
    restoreSelection();
    try { document.execCommand("styleWithCSS", false, "true"); } catch {}
    document.execCommand(cmd, false, value);
    syncHtml();
  };

  const applyHighlight = (color: string | null) => {
    restoreSelection();
    try { document.execCommand("styleWithCSS", false, "true"); } catch {}
    document.execCommand("hiliteColor", false, color ?? "transparent");
    syncHtml();
  };

  const onLink = () => {
    saveSelection();
    const url = window.prompt("URL odkazu:", "https://");
    if (!url) return;
    const cleanUrl = url.trim();
    restoreSelection();
    const range = getEditorSelection();
    if (!range || range.collapsed) {
      document.execCommand("insertHTML", false, `<a href="${escapeHtml(cleanUrl)}">${escapeHtml(cleanUrl)}</a>`);
      syncHtml();
      return;
    }
    document.execCommand("createLink", false, cleanUrl);
    syncHtml();
  };

  const findBlockEl = (node: Node | null): HTMLElement | null => {
    const editor = ref.current;
    if (!editor) return null;
    let el: Node | null = node;
    while (el && el !== editor) {
      if (el.nodeType === Node.ELEMENT_NODE) {
        const tag = (el as HTMLElement).tagName;
        if (/^(P|DIV|LI|H[1-6]|BLOCKQUOTE)$/.test(tag)) return el as HTMLElement;
      }
      el = el.parentNode;
    }
    return null;
  };

  const ensureBlockForSelection = (): HTMLElement | null => {
    const editor = ref.current;
    if (!editor) return null;
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    let blockEl = findBlockEl(range.startContainer);
    if (!blockEl) {
      // Wrap loose content into a <p>
      document.execCommand("formatBlock", false, "p");
      const sel2 = window.getSelection();
      if (sel2 && sel2.rangeCount > 0) blockEl = findBlockEl(sel2.getRangeAt(0).startContainer);
    }
    return blockEl;
  };

  const applySize = (size: "small" | "normal" | "large") => {
    const blockEl = ensureBlockForSelection();
    if (!blockEl) return;
    const sizeMap: Record<string, string> = { small: "0.875em", normal: "", large: "1.25em" };
    const val = sizeMap[size] ?? "";
    if (val) blockEl.style.fontSize = val;
    else blockEl.style.removeProperty("font-size");
    if (!blockEl.getAttribute("style")) blockEl.removeAttribute("style");
    saveSelection();
    syncHtml();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 flex-wrap">
        <Button type="button" variant="ghost" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")} className="h-7 px-2 font-bold">B</Button>
        <Button type="button" variant="ghost" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")} className="h-7 px-2 italic">I</Button>
        <Button type="button" variant="ghost" size="icon" title="Nečíslovaný seznam" aria-label="Nečíslovaný seznam" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")} className="h-7 w-7"><List className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="icon" title="Číslovaný seznam" aria-label="Číslovaný seznam" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertOrderedList")} className="h-7 w-7"><ListOrdered className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="icon" title="Vložit odkaz" aria-label="Vložit odkaz" onMouseDown={(e) => e.preventDefault()} onClick={onLink} className="h-7 w-7"><Link className="h-4 w-4" /></Button>
        <div className="mx-1 h-5 w-px bg-border" />
        <Button type="button" variant="ghost" size="icon" title="Zarovnat vlevo (odstavec)" aria-label="Zarovnat vlevo" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("justifyLeft")} className="h-7 w-7"><AlignLeft className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="icon" title="Na střed (odstavec)" aria-label="Na střed" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("justifyCenter")} className="h-7 w-7"><AlignCenter className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="icon" title="Zarovnat vpravo (odstavec)" aria-label="Zarovnat vpravo" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("justifyRight")} className="h-7 w-7"><AlignRight className="h-4 w-4" /></Button>
        <div className="mx-1 h-5 w-px bg-border" />
        <Select value="" onValueChange={(v) => applySize(v as "small" | "normal" | "large")}>
          <SelectTrigger className="h-7 w-[120px] text-xs" onMouseDown={() => saveSelection()}>
            <SelectValue placeholder="Velikost" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="small">Malé</SelectItem>
            <SelectItem value="normal">Normální</SelectItem>
            <SelectItem value="large">Velké</SelectItem>
          </SelectContent>
        </Select>
        <div className="mx-1 h-5 w-px bg-border" />
        {HIGHLIGHT_COLORS.map((c) => (
          <Button
            key={c.key}
            type="button"
            variant="ghost"
            size="icon"
            title={`Podbarvit – ${c.label}`}
            aria-label={`Podbarvit ${c.label}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyHighlight(c.color)}
            className="h-7 w-7"
          >
            <span className="block h-4 w-4 rounded-sm border border-foreground/30" style={{ backgroundColor: c.color }} />
          </Button>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Odebrat podbarvení"
          aria-label="Odebrat podbarvení"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyHighlight(null)}
          className="h-7 w-7 text-xs"
        >
          ×
        </Button>
        <Select
          value={block.content.pictogram ?? "none"}
          onValueChange={(v) => onChange(block.id, { content: { ...block.content, pictogram: v } })}
        >
          <SelectTrigger className="h-7 w-[200px] text-xs">
            <SelectValue placeholder="Piktogram" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Bez piktogramu</SelectItem>
            <SelectItem value="alert">Výstraha</SelectItem>
            <SelectItem value="alert-electric">Výstraha – elektrické nebezpečí</SelectItem>
            <SelectItem value="info">Informace</SelectItem>

          </SelectContent>
        </Select>
      </div>
      <div className="flex items-start gap-2">
        {block.content.pictogram && block.content.pictogram !== "none" && (
          <div className="shrink-0 pt-2">
            <PictogramIcon kind={block.content.pictogram} size={28} />
          </div>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onKeyUp={saveSelection}
          onMouseUp={saveSelection}
          onInput={(e) => {
            const html = (e.target as HTMLDivElement).innerHTML;
            lastHtmlRef.current = html;
            onChange(block.id, { content: { ...block.content, html } });
            saveSelection();
          }}
          className="ProseMirror min-h-[60px] flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring prose prose-sm max-w-none"
        />
      </div>
    </div>
  );
}

function PictogramIcon({ kind, size = 28 }: { kind: Pictogram; size?: number }) {
  const color = "currentColor";
  const fill = "white";
  const strokeWidth = 2;

  const symbol = (() => {
    switch (kind) {
      case "alert":
        return (
          <>
            <line x1="12" y1="9" x2="12" y2="15" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
            <circle cx="12" cy="18" r="1.2" fill={color} />
          </>
        );
      case "alert-electric":
        return (
          <path
            d="M14 8 L9 15 L12 15 L10 20 L16 13 L13 13 L15 8 Z"
            fill={color}
          />
        );
      case "info":
        return (
          <>
            <circle cx="12" cy="8" r="1.2" fill={color} />
            <line x1="12" y1="11" x2="12" y2="17" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          </>
        );
      case "recycling":
        return (
          <>
            <path d="M12 4 Q15 8 17 12" stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
            <polygon points="17,12 15.45,10.84 16.64,10.10" fill={color} />
            <path d="M17 12 Q12 14 7 12" stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
            <polygon points="7,12 8.80,11.30 8.80,12.70" fill={color} />
            <path d="M7 12 Q9 8 12 4" stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
            <polygon points="12,4 11.64,5.90 10.45,5.16" fill={color} />
          </>
        );
      default:
        return null;
    }
  })();


  const shape = (() => {
    switch (kind) {
      case "alert":
      case "alert-electric":
        return (
          <polygon
            points="12,2 22,21 2,21"
            fill={fill}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
        );
      case "info":
        return (
          <circle
            cx="12"
            cy="12"
            r="10"
            fill={fill}
            stroke={color}
            strokeWidth={strokeWidth}
          />
        );
      case "recycling":
        return (
          <circle
            cx="12"
            cy="12"
            r="10"
            fill={fill}
            stroke={color}
            strokeWidth={strokeWidth}
          />
        );
      default:
        return null;
    }
  })();

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="text-foreground" fill="none">
      {shape}
      {symbol}
    </svg>
  );
}


function PictogramSelect({ value, onChange }: { value?: Pictogram; onChange: (v: Pictogram) => void }) {
  return (
    <Select value={value ?? "none"} onValueChange={(v) => onChange(v as Pictogram)}>
      <SelectTrigger className="h-7 w-[200px] text-xs">
        <SelectValue placeholder="Piktogram" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Bez piktogramu</SelectItem>
        <SelectItem value="alert">Výstraha</SelectItem>
        <SelectItem value="alert-electric">Výstraha – elektrické nebezpečí</SelectItem>
        <SelectItem value="info">Informace</SelectItem>
        <SelectItem value="recycling">Recyklace</SelectItem>
      </SelectContent>
    </Select>
  );
}

function PictogramRow({ value, onChange, children }: { value?: Pictogram; onChange: (v: Pictogram) => void; children: ReactNode }) {
  if (!value || value === "none") return <>{children}</>;
  return (
    <div className="flex items-start gap-2">
      <div className="shrink-0 pt-2">
        <PictogramIcon kind={value} size={28} />
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function ImageBlockEditor({ block, onChange, hidePictogram, imageNumber, imageLabelPrefix }: { block: Block; onChange: Props["onChange"]; hidePictogram?: boolean; imageNumber?: number; imageLabelPrefix?: string }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const handleInsertFromNotion = (item: { image: string; title: string }) => {
    setContent(block, { url: item.image, alt: block.content.alt || item.title }, onChange);
    setPickerOpen(false);
  };

  const handleInsertUploaded = (item: { image: string; title: string }) => {
    setContent(block, { url: item.image, alt: block.content.alt || item.title }, onChange);
    setUploadOpen(false);
  };

  const captionLabel =
    imageNumber !== undefined ? `${imageLabelPrefix ?? "Obrázek č. "}${imageNumber}` : undefined;

  return (
    <div className="space-y-2">
      {!hidePictogram && (
        <div className="flex flex-wrap items-center gap-2">
          <PictogramSelect
            value={block.content.pictogram}
            onChange={(v) => setContent(block, { pictogram: v }, onChange)}
          />
        </div>
      )}
      <PictogramRow value={hidePictogram ? "none" : block.content.pictogram} onChange={() => {}}>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="w-4 h-4 mr-1" />
              Nahrát obrázek
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              <ImageIcon className="w-4 h-4 mr-1" />
              Vybrat v Notion
            </Button>
          </div>
          {block.content.url && (
            <img src={block.content.url} alt={block.content.alt} className="max-h-64 rounded border" />
          )}
          <div className="space-y-1">
            <Input
              value={block.content.alt ?? ""}
              onChange={(e) => setContent(block, { alt: e.target.value }, onChange)}
              placeholder="Popis obrázku"
            />
            {captionLabel && (
              <Label className="text-xs text-muted-foreground/70 font-normal">
                Popis obrázku — v PDF: <span className="font-medium text-muted-foreground">{captionLabel}: {block.content.alt || "…"}</span>
              </Label>
            )}
          </div>

        </div>
      </PictogramRow>
      <NotionImagePicker open={pickerOpen} onOpenChange={setPickerOpen} onInsert={handleInsertFromNotion} />
      <NotionImageUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} onInsert={handleInsertUploaded} />
    </div>
  );
}





function defaultColWidths(cols: number, narrowFirstCol?: boolean): number[] {
  if (cols <= 0) return [];
  if (narrowFirstCol && cols > 1) {
    const rest = (100 - 6) / (cols - 1);
    return [6, ...Array(cols - 1).fill(rest)];
  }
  return Array(cols).fill(100 / cols);
}

function TableBlockEditor({ block, onChange, narrowFirstCol, hidePictogram }: { block: Block; onChange: Props["onChange"]; narrowFirstCol?: boolean; hidePictogram?: boolean }) {
  const rows: string[][] = block.content.rows ?? [];
  const cols = rows[0]?.length ?? 0;
  const storedWidths: number[] | undefined = block.content.colWidths;
  const widths: number[] =
    storedWidths && storedWidths.length === cols
      ? storedWidths
      : defaultColWidths(cols, narrowFirstCol);

  const tableRef = useRef<HTMLTableElement>(null);

  const rowColors: Array<string | null> = block.content.rowColors ?? [];
  const getRowColor = (ri: number): string | null => rowColors[ri] ?? null;

  const updateCell = (r: number, c: number, v: string) => {
    const next = rows.map((row, ri) => row.map((cell, ci) => (ri === r && ci === c ? v : cell)));
    setContent(block, { rows: next }, onChange);
  };

  const addRow = () => {
    const nextRows = [...rows, Array(cols).fill("")];
    setContent(block, { rows: nextRows }, onChange);
  };
  const removeRow = () => rows.length > 1 && setContent(block, {
    rows: rows.slice(0, -1),
    rowColors: rowColors.slice(0, -1),
  }, onChange);
  const deleteRowAt = (idx: number) => {
    if (rows.length <= 1) return;
    setContent(block, {
      rows: rows.filter((_, i) => i !== idx),
      rowColors: rowColors.length ? rowColors.filter((_, i) => i !== idx) : rowColors,
    }, onChange);
  };
  const setRowColor = (idx: number, color: string | null) => {
    const next = rows.map((_, i) => rowColors[i] ?? null);
    next[idx] = color;
    setContent(block, { rowColors: next }, onChange);
  };
  const addCol = () =>
    setContent(
      block,
      { rows: rows.map((r) => [...r, ""]), colWidths: defaultColWidths(cols + 1, narrowFirstCol) },
      onChange,
    );
  const removeCol = () => {
    if (cols <= 1) return;
    setContent(
      block,
      { rows: rows.map((r) => r.slice(0, -1)), colWidths: defaultColWidths(cols - 1, narrowFirstCol) },
      onChange,
    );
  };
  const deleteColAt = (idx: number) => {
    if (cols <= 1) return;
    setContent(
      block,
      { rows: rows.map((r) => r.filter((_, i) => i !== idx)), colWidths: defaultColWidths(cols - 1, narrowFirstCol) },
      onChange,
    );
  };

  const startResize = (idx: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const tableWidth = tableRef.current?.getBoundingClientRect().width ?? 1;
    const startW = widths[idx];
    const startNext = widths[idx + 1];
    const minPct = 4;
    const onMove = (ev: MouseEvent) => {
      const deltaPct = ((ev.clientX - startX) / tableWidth) * 100;
      let w = startW + deltaPct;
      w = Math.max(minPct, Math.min(startW + startNext - minPct, w));
      const next = startW + startNext - w;
      const newWidths = [...widths];
      newWidths[idx] = w;
      newWidths[idx + 1] = next;
      setContent(block, { colWidths: newWidths }, onChange);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return (
    <div className="space-y-2">
      {!hidePictogram && (
        <div className="flex flex-wrap items-center gap-2">
          <PictogramSelect
            value={block.content.pictogram}
            onChange={(v) => setContent(block, { pictogram: v }, onChange)}
          />
        </div>
      )}
      <PictogramRow value={hidePictogram ? "none" : block.content.pictogram} onChange={() => {}}>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={!!block.content.headerRow}
                onCheckedChange={(v) => setContent(block, { headerRow: !!v }, onChange)}
              />
              První řádek je záhlaví
            </label>
            <div className="flex items-center gap-1 ml-auto">
              <Button type="button" variant="outline" size="sm" onClick={addRow}><Plus className="w-3 h-3 mr-1" />Řádek</Button>
              <Button type="button" variant="outline" size="sm" onClick={removeRow}><Minus className="w-3 h-3 mr-1" />Řádek</Button>
              <Button type="button" variant="outline" size="sm" onClick={addCol}><Plus className="w-3 h-3 mr-1" />Sloupec</Button>
              <Button type="button" variant="outline" size="sm" onClick={removeCol}><Minus className="w-3 h-3 mr-1" />Sloupec</Button>
              {cols > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setContent(block, { colWidths: defaultColWidths(cols, narrowFirstCol) }, onChange)}
                  title="Rozdělit šířku sloupců rovnoměrně"
                >
                  Vyrovnat sloupce
                </Button>
              )}
            </div>
          </div>
          <div className="overflow-auto rounded-md bg-[hsl(220,14%,90%)] p-3 dark:bg-[hsl(217,33%,12%)]">
            <table ref={tableRef} className="w-full border-collapse table-fixed">
              {cols > 0 && (
                <colgroup>
                  <col style={{ width: "28px" }} />
                  {widths.map((w, i) => (
                    <col key={i} style={{ width: `${w}%` }} />
                  ))}
                </colgroup>
              )}
              <thead>
                <tr>
                  <th className="p-0" />
                  {widths.map((_, i) => (
                    <th key={i} className="p-0 h-5 text-center align-middle relative">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="p-0.5 rounded text-muted-foreground/60 hover:text-foreground hover:bg-accent opacity-60 hover:opacity-100 transition"
                            title="Možnosti sloupce"
                            aria-label="Možnosti sloupce"
                          >
                            <MoreVertical className="w-3.5 h-3.5 inline" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent side="top" align="center" className="w-auto p-1">
                          {cols > 1 ? (
                            <button
                              type="button"
                              onClick={() => deleteColAt(i)}
                              className="flex items-center gap-2 px-2 py-1 rounded text-sm text-destructive hover:bg-destructive/10 w-full"
                            >
                              <Trash2 className="w-4 h-4" /> Smazat sloupec
                            </button>
                          ) : (
                            <div className="px-2 py-1 text-xs text-muted-foreground">Žádné akce</div>
                          )}
                        </PopoverContent>
                      </Popover>
                      {i < widths.length - 1 && (
                        <div
                          onMouseDown={startResize(i)}
                          className="absolute top-0 right-0 h-full w-1.5 -mr-[3px] cursor-col-resize hover:bg-primary/60 z-10"
                          title="Táhnutím změňte šířku sloupce"
                        />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => {
                  const rowBg = getRowColor(ri);
                  return (
                    <tr key={ri} style={rowBg ? { backgroundColor: rowBg } : undefined}>
                      <td className="p-0 align-middle border-0 text-center">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
                              title="Možnosti řádku"
                              aria-label="Možnosti řádku"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent side="left" align="center" className="w-auto p-2">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                {HIGHLIGHT_COLORS.map((c) => (
                                  <button
                                    key={c.key}
                                    type="button"
                                    onClick={() => setRowColor(ri, c.color)}
                                    title={`Podbarvit řádek – ${c.label}`}
                                    aria-label={`Podbarvit řádek ${c.label}`}
                                    className="w-5 h-5 rounded border border-foreground/30 hover:scale-110 transition-transform"
                                    style={{ backgroundColor: c.color }}
                                  />
                                ))}
                                <button
                                  type="button"
                                  onClick={() => setRowColor(ri, null)}
                                  title="Bez podbarvení"
                                  aria-label="Bez podbarvení"
                                  className="w-5 h-5 rounded border border-foreground/30 bg-background text-xs leading-none"
                                >
                                  ×
                                </button>
                              </div>
                              {rows.length > 1 && (
                                <>
                                  <div className="w-px h-5 bg-border" />
                                  <button
                                    type="button"
                                    onClick={() => deleteRowAt(ri)}
                                    title="Smazat řádek"
                                    aria-label="Smazat řádek"
                                    className="p-1 rounded text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </td>
                      {row.map((cell, ci) => {
                        const isHeaderCell = !!block.content.headerRow && ri === 0;
                        const bgCls = rowBg
                          ? "bg-transparent"
                          : isHeaderCell
                            ? "bg-muted/40"
                            : "bg-background";
                        return (
                          <td key={ci} className="border p-0 relative">
                            <Input
                              value={cell}
                              onChange={(e) => updateCell(ri, ci, e.target.value)}
                              className={`h-8 rounded-none border-0 shadow-none focus-visible:ring-1 ${bgCls} ${
                                isHeaderCell ? "font-semibold" : ""
                              } ${narrowFirstCol && ci === 0 ? "text-center" : ""}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </PictogramRow>
    </div>
  );
}

function CalloutBlockEditor({ block, onChange }: { block: Block; onChange: Props["onChange"] }) {
  const config = {
    alert: { Icon: AlertTriangle, cls: "border-destructive/40 bg-destructive/5 text-destructive" },
    info: { Icon: Info, cls: "border-primary/40 bg-primary/5 text-primary" },
    warning: { Icon: AlertCircle, cls: "border-yellow-500/40 bg-yellow-500/5 text-yellow-700 dark:text-yellow-500" },
  }[block.type as "alert" | "info" | "warning"];
  const Icon = config.Icon;
  return (
    <div className={`flex items-start gap-2 rounded-md border p-2 ${config.cls}`}>
      <Icon className="w-5 h-5 mt-0.5 shrink-0" />
      <Textarea
        value={block.content.text ?? ""}
        onChange={(e) => setContent(block, { text: e.target.value }, onChange)}
        placeholder={`Text – ${BLOCK_TYPE_LABELS[block.type]}`}
        rows={2}
        className="border-0 bg-transparent shadow-none focus-visible:ring-0 resize-none text-foreground"
      />
    </div>
  );
}

function ImageTableBlockEditor({ block, onChange, imageNumber, imageLabelPrefix }: { block: Block; onChange: Props["onChange"]; imageNumber?: number; imageLabelPrefix?: string }) {
  const imageContent = block.content?.image ?? { url: "", alt: "" };
  const tableContent = block.content?.table ?? { headerRow: true, rows: [["#", "Název části"]] };

  const handleSub = (key: "image" | "table") => (_id: string, patch: Partial<Block>) => {
    if (patch.content !== undefined) {
      onChange(block.id, { content: { ...block.content, [key]: patch.content } });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <PictogramSelect
          value={block.content?.pictogram}
          onChange={(v) => onChange(block.id, { content: { ...block.content, pictogram: v } })}
        />
      </div>
      <PictogramRow value={block.content?.pictogram} onChange={() => {}}>
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Obrázek</div>
            <ImageBlockEditor
              block={{ ...block, type: "image", content: imageContent } as Block}
              onChange={handleSub("image")}
              hidePictogram
              imageNumber={imageNumber}
              imageLabelPrefix={imageLabelPrefix}
            />
          </div>
          <div className="border-t border-muted-foreground/20" />
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Tabulka</div>
            <TableBlockEditor
              block={{ ...block, type: "table", content: tableContent } as Block}
              onChange={handleSub("table")}
              narrowFirstCol
              hidePictogram
            />
          </div>
        </div>
      </PictogramRow>
    </div>
  );
}

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, AlertTriangle, Info, AlertCircle, Loader2, Upload, Plus, Minus, ChevronDown, ChevronRight, List, ListMinus, ListOrdered, Link, ImageIcon, AlignLeft, AlignCenter, AlignRight, SeparatorHorizontal, Pencil, MoreVertical, Superscript, Subscript, RemoveFormatting, ClipboardType, Highlighter, Combine, Split, MoreHorizontal } from "lucide-react";
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
import { BLOCK_TYPE_LABELS, buildCellValue, parseCellPictogram, type Block, type Pictogram } from "./types";
import TableCellEditor from "./TableCellEditor";
import PictogramIcon from "./PictogramIcon";
import { canMergeDown, canMergeRight as checkMergeRight, coveredBy, deleteRowWithMerges, mergeAt, mergeCellsDown, mergeCellsRight, normalizeMerges, remapDeleteColumn, remapDeleteRow, remapInsertColumn, rowSpanOf, unmergeCell } from "./cellMerges";
import { imageNumberedLabel } from "./imageNumbers";

const PICTOGRAM_LABELS: Record<string, string> = {
  alert: "Výstraha",
  "alert-electric": "Výstraha – elektrické nebezpečí",
  info: "Informace",
  recycling: "Recyklace",
};

/** Položky výběru piktogramu – společné pro selecty bloků i menu buňky tabulky. */
const PICTOGRAM_OPTIONS: { value: Pictogram; label: string }[] = [
  { value: "none", label: "Bez piktogramu" },
  { value: "alert", label: PICTOGRAM_LABELS.alert },
  { value: "alert-electric", label: PICTOGRAM_LABELS["alert-electric"] },
  { value: "info", label: PICTOGRAM_LABELS.info },
  { value: "recycling", label: PICTOGRAM_LABELS.recycling },
];

/**
 * Náhled položky: ikona + název, svisle na střed, gap-2.
 * U „Bez piktogramu" je prázdné místo stejné šířky, aby texty položek lícovaly.
 */
function PictogramOptionRow({ kind, label, className = "" }: { kind: Pictogram; label: string; className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      {kind === "none" ? (
        <span className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <PictogramIcon kind={kind} size={16} className="shrink-0" />
      )}
      <span className="truncate">{label}</span>
    </span>
  );
}

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
  /** Rozdělí blok "Obrázek + Tabulka" na samostatný obrázek a tabulku. */
  onSplit?: (id: string) => void;
  /** Table block directly below an image block (enables merge). */
  mergeTable?: Block;
  onMerge?: (id: string) => void;
  headingNumber?: string;
  imageNumber?: number;
  /** HTML of the directly following text block (for the wrap preview). */
  nextTextHtml?: string;
  pairedInPdf?: boolean;
  imageLabelPrefix?: string;
  imageLabelUnnumbered?: string;
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
    case "spacer":
      return "";
    default:
      return "";
  }
}

export default function BlockItem({ block, collapsed, onToggleCollapsed, onChange, onDelete, onSplit, mergeTable, onMerge, headingNumber, imageNumber, imageLabelPrefix, imageLabelUnnumbered, nextTextHtml, pairedInPdf }: Props) {
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
        onSplit={onSplit}
        mergeTable={mergeTable}
        onMerge={onMerge}
        preview={preview}
        headingNumber={headingNumber}
        attributes={attributes}
        listeners={listeners}
      />
      {!collapsed && (
        <div className="p-3">
          <BlockBody block={block} onChange={onChange} headingNumber={headingNumber} imageNumber={imageNumber} imageLabelPrefix={imageLabelPrefix} imageLabelUnnumbered={imageLabelUnnumbered} nextTextHtml={nextTextHtml} pairedInPdf={pairedInPdf} />
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
  onSplit,
  mergeTable,
  onMerge,
  preview,
  headingNumber,
  attributes,
  listeners,
}: {
  block: Block;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onChange: Props["onChange"];
  onDelete: Props["onDelete"];
  onSplit?: Props["onSplit"];
  mergeTable?: Block;
  onMerge?: Props["onMerge"];
  preview: string;
  headingNumber?: string;
  attributes: any;
  listeners: any;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const imgPic = block.content?.pictogram, tblPic = mergeTable?.content?.pictogram;
  const losesPosition = block.content?.size === "half" && (block.content?.position === "left" || block.content?.position === "right");
  const losesTablePic = !!imgPic && imgPic !== "none" && !!tblPic && tblPic !== "none" && imgPic !== tblPic;
  return (
    <div className={`flex items-center justify-between rounded-t-[inherit] px-2 py-1 ${collapsed ? "rounded-b-[inherit]" : "border-b border-muted-foreground/30"} ${block.type === "image" || block.type === "image-table" ? "bg-success/10" : "bg-muted/30"}`}>
      <div className="flex items-center gap-1 min-w-0 flex-1 flex-wrap">
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
        {block.type === "image-table" && block.content?.autoTableBreak === true && (
          <span className="rounded-full border border-muted-foreground/30 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            auto: tabulka na nové stránce
          </span>
        )}
        {(collapsed || block.type.startsWith("heading")) && preview && (
          <span className={`ml-2 min-w-0 truncate text-xs ${block.type.startsWith("heading") ? "font-semibold text-foreground" : "text-muted-foreground/80"}`}>
            {`— ${block.type.startsWith("heading") && headingNumber ? `${headingNumber} ` : ""}${preview}`}
          </span>
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
        {block.type === "image" && mergeTable && onMerge && (
          <AlertDialog open={mergeOpen} onOpenChange={setMergeOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" aria-label="Spojit s tabulkou pod">
                    <Combine className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent side="top">Spojit s tabulkou pod</TooltipContent>
            </Tooltip>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Spojit bloky?</AlertDialogTitle>
                <AlertDialogDescription>
                  Obrázek a tabulka pod ním se spojí do jednoho bloku Obrázek + Tabulka. Obsah i nastavení zůstanou zachovány.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {(losesPosition || losesTablePic) && (
                <div className="space-y-1 text-sm text-warning">
                  {losesPosition && <p>Umístění obrázku Vlevo/Vpravo se nezachová – blok Obrázek + Tabulka je vždy na střed.</p>}
                  {losesTablePic && <p>Piktogram tabulky se nahradí piktogramem obrázku.</p>}
                </div>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel>Zrušit</AlertDialogCancel>
                <AlertDialogAction onClick={() => onMerge(block.id)}>Spojit</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        {block.type === "image-table" && onSplit && (
          <AlertDialog open={splitOpen} onOpenChange={setSplitOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    aria-label="Rozdělit na dva bloky"
                  >
                    <Split className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
              </TooltipTrigger>
              <TooltipContent side="top">Rozdělit na dva bloky</TooltipContent>
            </Tooltip>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Rozdělit blok?</AlertDialogTitle>
                <AlertDialogDescription>
                  Blok Obrázek + Tabulka se rozdělí na samostatný blok Obrázek a pod ním samostatný blok Tabulka. Obsah i nastavení zůstanou zachovány.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Zrušit</AlertDialogCancel>
                <AlertDialogAction onClick={() => onSplit(block.id)}>
                  Rozdělit
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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

function BlockBody({ block, onChange, headingNumber, imageNumber, imageLabelPrefix, imageLabelUnnumbered, nextTextHtml, pairedInPdf }: { block: Block; onChange: Props["onChange"]; headingNumber?: string; imageNumber?: number; imageLabelPrefix?: string; imageLabelUnnumbered?: string; nextTextHtml?: string; pairedInPdf?: boolean }) {
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
      return <ImageBlockEditor block={block} onChange={onChange} imageNumber={imageNumber} imageLabelPrefix={imageLabelPrefix} imageLabelUnnumbered={imageLabelUnnumbered} nextTextHtml={nextTextHtml} pairedInPdf={pairedInPdf} />;
    case "table":
      return <TableBlockEditor block={block} onChange={onChange} />;
    case "image-table":
      return <ImageTableBlockEditor block={block} onChange={onChange} imageNumber={imageNumber} imageLabelPrefix={imageLabelPrefix} imageLabelUnnumbered={imageLabelUnnumbered} />;
    case "alert":
    case "info":
    case "warning":
      return <CalloutBlockEditor block={block} onChange={onChange} />;
    case "pagebreak":
      return <PageBreakBlock auto={block.content?.auto === true} />;
    case "spacer":
      return <div className="h-8" aria-label="Horizontální mezera" />;
  }
}

function PageBreakBlock({ auto }: { auto?: boolean }) {
  return (
    <div className="flex items-center gap-2 py-2 text-xs uppercase tracking-wider text-muted-foreground">
      <div className="h-px flex-1 border-t border-dashed" />
      <SeparatorHorizontal className="h-4 w-4" />
      <span>Konec stránky</span>
      {auto && (
        <span className="rounded-full border border-muted-foreground/30 px-1.5 py-0.5 text-[10px] normal-case tracking-normal">
          auto
        </span>
      )}
      <div className="h-px flex-1 border-t border-dashed" />
    </div>
  );
}

function TextBlockEditor({ block, onChange }: { block: Block; onChange: Props["onChange"] }) {
  const ref = useRef<HTMLDivElement>(null);
  const lastHtmlRef = useRef<string>(block.content.html ?? "");
  const selectionRef = useRef<Range | null>(null);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);
  const [activeIndices, setActiveIndices] = useState({ superscript: false, subscript: false });

  useEffect(() => {
    const updateFormatting = () => {
      const selection = window.getSelection();
      const editor = ref.current;
      if (!editor || !selection?.anchorNode || !editor.contains(selection.anchorNode)) return;
      setActiveIndices({
        superscript: document.queryCommandState("superscript"),
        subscript: document.queryCommandState("subscript"),
      });
      let element = selection.anchorNode instanceof HTMLElement
        ? selection.anchorNode : selection.anchorNode.parentElement;
      let color: string | null = null;
      while (element && element !== editor) {
        const background = element.style.backgroundColor;
        if (background && background !== "transparent" && background !== "rgba(0, 0, 0, 0)") {
          color = background;
          break;
        }
        element = element.parentElement;
      }
      setActiveHighlight(color);
    };
    document.addEventListener("selectionchange", updateFormatting);
    return () => document.removeEventListener("selectionchange", updateFormatting);
  }, []);

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

  // Inline formatting must produce real tags (<b>, <i>, <sup>, <sub>) so the
  // PDF export and Notion sync recognise them — never CSS spans.
  const TAG_CMDS = new Set(["bold", "italic", "underline", "superscript", "subscript"]);
  const exec = (cmd: string, value?: string) => {
    restoreSelection();
    try { document.execCommand("styleWithCSS", false, TAG_CMDS.has(cmd) ? "false" : "true"); } catch {}
    document.execCommand(cmd, false, value);
    syncHtml();
  };

  const clearFormatting = () => {
    restoreSelection();
    // Native removal splits inline wrappers at the selection boundaries, preserving
    // surrounding formatting, paragraphs, line breaks and browser undo history.
    document.execCommand("removeFormat", false);
    document.execCommand("unlink", false);
    syncHtml();
    setActiveHighlight(null);
    setActiveIndices({ superscript: false, subscript: false });
  };

  const [plainOpen, setPlainOpen] = useState(false);
  const [plainText, setPlainText] = useState("");
  const insertPlain = () => {
    const text = plainText;
    setPlainOpen(false);
    setPlainText("");
    if (!text) return;
    ref.current?.focus();
    restoreSelection();
    if (!getEditorSelection() && ref.current) {
      const r = document.createRange();
      r.selectNodeContents(ref.current);
      r.collapse(false);
      const s = window.getSelection();
      s?.removeAllRanges();
      s?.addRange(r);
    }
    const html = escapeHtml(text).replace(/\r?\n/g, "<br>");
    document.execCommand("insertHTML", false, html);
    syncHtml();
  };

  const onEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation(); // keep drag&drop keyboard sensor away
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    let cmd: string | null = null;
    if (k === "b") cmd = "bold";
    else if (k === "i") cmd = "italic";
    else if (k === "u") cmd = "underline";
    else if (k === "." || (e.shiftKey && (k === "+" || k === "="))) cmd = "superscript";
    else if (k === "," || (!e.shiftKey && k === "=")) cmd = "subscript";
    if (!cmd) return;
    e.preventDefault();
    saveSelection();
    exec(cmd);
  };

  const applyHighlight = (color: string | null) => {
    restoreSelection();
    try { document.execCommand("styleWithCSS", false, "true"); } catch {}
    document.execCommand("hiliteColor", false, color ?? "transparent");
    syncHtml();
    setActiveHighlight(color);
    setHighlightOpen(false);
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
        <Button type="button" variant="ghost" size="sm" title="Tučně (Ctrl/⌘+B)" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")} className="h-7 px-2 font-bold">B</Button>
        <Button type="button" variant="ghost" size="sm" title="Kurzíva (Ctrl/⌘+I)" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")} className="h-7 px-2 italic">I</Button>
        <Button type="button" variant="ghost" size="icon" title="Horní index (Ctrl/⌘+.)" aria-label="Horní index" aria-pressed={activeIndices.superscript} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("superscript")} className="h-7 w-7"><Superscript className="h-4 w-4" /></Button>
        <Button type="button" variant="ghost" size="icon" title="Dolní index (Ctrl/⌘+,)" aria-label="Dolní index" aria-pressed={activeIndices.subscript} onMouseDown={(e) => e.preventDefault()} onClick={() => exec("subscript")} className="h-7 w-7"><Subscript className="h-4 w-4" /></Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="icon" title="Zrušit formátování" aria-label="Zrušit formátování" onMouseDown={(e) => e.preventDefault()} onClick={clearFormatting} className="h-7 w-7"><RemoveFormatting className="h-4 w-4" /></Button>
          </TooltipTrigger>
          <TooltipContent>Zrušit formátování</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="icon" title="Vložit bez formátování" aria-label="Vložit bez formátování" onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => setPlainOpen(true)} className="h-7 w-7"><ClipboardType className="h-4 w-4" /></Button>
          </TooltipTrigger>
          <TooltipContent>Vložit bez formátování</TooltipContent>
        </Tooltip>
        <Dialog open={plainOpen} onOpenChange={setPlainOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Vložit bez formátování</DialogTitle></DialogHeader>
            <Textarea autoFocus rows={10} value={plainText} onChange={(e) => setPlainText(e.target.value)} placeholder="Sem vložte text…" />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPlainOpen(false)}>Zrušit</Button>
              <Button type="button" onClick={insertPlain} disabled={!plainText}>Vložit</Button>
            </div>
          </DialogContent>
        </Dialog>
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
        <Popover open={highlightOpen} onOpenChange={setHighlightOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="sm" title="Barva pozadí" aria-label="Barva pozadí" onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} className="h-7 gap-1 px-1.5">
                  <span className="relative flex h-4 w-4 items-center justify-center">
                    <Highlighter className="h-4 w-4" />
                    <span
                      aria-hidden
                      className="absolute bottom-[-2px] left-1/2 h-[3px] w-[14px] -translate-x-1/2 rounded-[1px] border border-foreground/25"
                      style={{ backgroundColor: activeHighlight ?? "transparent" }}
                    />
                  </span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>Barva pozadí</TooltipContent>
          </Tooltip>
          <PopoverContent className="w-40 p-1" align="start" onOpenAutoFocus={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()}>
            {HIGHLIGHT_COLORS.map((c) => (
              <Button key={c.key} type="button" variant="ghost" size="sm" aria-label={`Podbarvit ${c.label}`} onMouseDown={(e) => e.preventDefault()} onClick={() => applyHighlight(c.color)} className="w-full justify-start gap-2 text-xs">
                <span className="block h-4 w-4 shrink-0 rounded-sm border border-foreground/30" style={{ backgroundColor: c.color }} />
                {c.label}
              </Button>
            ))}
            <Button type="button" variant="ghost" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => applyHighlight(null)} className="w-full justify-start gap-2 text-xs">
              <span className="flex h-4 w-4 items-center justify-center rounded-sm border border-foreground/30">×</span>
              Bez barvy
            </Button>
          </PopoverContent>
        </Popover>
        <PictogramSelect
          value={block.content.pictogram}
          onChange={(v) => onChange(block.id, { content: { ...block.content, pictogram: v } })}
        />
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
          onKeyDown={onEditorKeyDown}
          onKeyUp={saveSelection}
          onMouseUp={saveSelection}
          onInput={(e) => {
            const html = (e.target as HTMLDivElement).innerHTML;
            lastHtmlRef.current = html;
            onChange(block.id, { content: { ...block.content, html } });
            saveSelection();
          }}
          className="ProseMirror min-h-[60px] flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring prose prose-sm max-w-none [&_sup]:align-super [&_sup]:static [&_sub]:align-sub [&_sub]:static"
        />
      </div>
    </div>
  );
}

function PictogramSelect({ value, onChange, className }: { value?: Pictogram; onChange: (v: Pictogram) => void; className?: string }) {
  return (
    <Select value={value ?? "none"} onValueChange={(v) => onChange(v as Pictogram)}>
      <SelectTrigger className={className ?? "h-7 w-[200px] text-xs"}>
        <SelectValue placeholder="Piktogram" />
      </SelectTrigger>
      <SelectContent>
        {PICTOGRAM_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            <PictogramOptionRow kind={o.value} label={o.label} />
          </SelectItem>
        ))}
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

function htmlToPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

function ImageBlockEditor({ block, onChange, hidePictogram, imageNumber, imageLabelPrefix, imageLabelUnnumbered, sizeOnly, nextTextHtml, pictogramOverride, pairedInPdf }: { pairedInPdf?: boolean; block: Block; onChange: Props["onChange"]; hidePictogram?: boolean; imageNumber?: number; imageLabelPrefix?: string; imageLabelUnnumbered?: string; sizeOnly?: boolean; nextTextHtml?: string; pictogramOverride?: { value?: Pictogram; onChange: (v: Pictogram) => void } }) {
  const size: "full" | "half" = block.content.size === "half" ? "half" : "full";
  const position: "left" | "right" | "center" = sizeOnly ? "center" : (block.content.position === "right" || block.content.position === "center" ? block.content.position : "left");
  const wraps = size === "half" && position !== "center" && nextTextHtml !== undefined;
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

  const numbered = block.content.numbered !== false;
  const captionLabel =
    numbered && imageNumber !== undefined ? imageNumberedLabel(imageLabelPrefix, imageNumber) : undefined;
  // Nečíslovaný obrázek: popisek bez čísla ("Obrázek: název"); bez názvu žádný popisek.
  const unnumberedCaption = !numbered && (block.content.alt ?? "").trim()
    ? `${imageLabelUnnumbered ?? "Obrázek"}: ${(block.content.alt ?? "").trim()}`
    : undefined;

  const picto = pictogramOverride ?? (hidePictogram ? undefined : { value: block.content.pictogram as Pictogram | undefined, onChange: (v: Pictogram) => setContent(block, { pictogram: v }, onChange) });
  const fieldCls = "h-8 text-sm";
  const labelCls = "text-[11px] leading-none text-muted-foreground";

  return (
    <div className="space-y-2">
      {/* 1. Zdroj obrázku + nastavení v jednom řádku */}
      <div className="flex flex-wrap items-end gap-2">
        <Button type="button" variant="outline" size="sm" className="h-8 shrink-0" onClick={() => setUploadOpen(true)}>
          <Upload className="w-4 h-4 mr-1" />
          Nahrát obrázek
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8 shrink-0" onClick={() => setPickerOpen(true)}>
          <ImageIcon className="w-4 h-4 mr-1" />
          Vybrat v Notion
        </Button>
        <div className="h-8 w-px shrink-0 bg-border" aria-hidden />
        {picto && (
          <div className="space-y-1">
            <Label className={labelCls}>Piktogram</Label>
            <PictogramSelect value={picto.value} onChange={picto.onChange} className={`${fieldCls} w-[160px]`} />
          </div>
        )}
        <div className="space-y-1">
          <Label className={labelCls}>Velikost</Label>
          <Select value={size} onValueChange={(v) => setContent(block, sizeOnly ? { size: v } : { size: v, position: block.content.position ?? "left" }, onChange)}>
            <SelectTrigger className={`${fieldCls} w-[150px]`}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="full">Plná šířka</SelectItem>
              <SelectItem value="half">Půl stránky</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {!sizeOnly && size === "half" && (
          <div className="space-y-1">
            <Label className={labelCls}>Umístění</Label>
            <Select value={position} onValueChange={(v) => setContent(block, { position: v }, onChange)}>
              <SelectTrigger className={`${fieldCls} w-[150px]`}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Vlevo</SelectItem>
                <SelectItem value="right">Vpravo</SelectItem>
                <SelectItem value="center">Střed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* 3. Náhled */}
      <PictogramRow value={picto?.value ?? "none"} onChange={() => {}}>
        {block.content.url ? (
          <div className="overflow-hidden">
            <img
              src={block.content.url}
              alt={block.content.alt}
              className={`rounded border ${size === "half" ? "w-1/2 object-contain" : "max-h-64"} ${size === "half" && !wraps ? (position === "left" ? "mr-auto block" : position === "right" ? "ml-auto block" : "mx-auto block") : ""} ${wraps ? (position === "left" ? "float-left mr-3 mb-1" : "float-right ml-3 mb-1") : ""}`}
            />
            {pairedInPdf && (
              <p className="clear-both text-xs text-muted-foreground">V PDF se zobrazí vedle sousedního obrázku.</p>
            )}
            {wraps && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium">Obtékající text (náhled): </span>
                {htmlToPlainText(nextTextHtml ?? "") || "…"}
              </p>
            )}
          </div>
        ) : <div />}
      </PictogramRow>

      {/* 4. Popisek + přepínač číslování */}
      <div className="space-y-1">
        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-1">
            <Label className="text-xs text-muted-foreground">Název obrázku</Label>
            <Input
              value={block.content.alt ?? ""}
              onChange={(e) => setContent(block, { alt: e.target.value }, onChange)}
              placeholder="Popis obrázku"
            />
          </div>
          <div className="flex items-center gap-2 pb-1.5 shrink-0">
            <Label htmlFor={`numbered-${block.id}`} className="text-xs text-muted-foreground cursor-pointer">Číslovat obrázek</Label>
            <Switch
              id={`numbered-${block.id}`}
              checked={numbered}
              onCheckedChange={(v) => setContent(block, { numbered: v }, onChange)}
              aria-label="Číslovat obrázek"
            />
          </div>
        </div>
        {captionLabel && (
          <Label className="text-xs text-muted-foreground/70 font-normal">
            Popis obrázku — v PDF: <span className="font-medium text-muted-foreground">{captionLabel}: {block.content.alt || "…"}</span>
          </Label>
        )}
        {unnumberedCaption && (
          <Label className="text-xs text-muted-foreground/70 font-normal">
            Popis obrázku — v PDF: <span className="font-medium text-muted-foreground">{unnumberedCaption}</span>
          </Label>
        )}
      </div>
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
  const merges = normalizeMerges(block.content.merges, rows);
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
    merges: remapDeleteRow(merges, rows.length - 1),
  }, onChange);
  const deleteRowAt = (idx: number) => {
    if (rows.length <= 1) return;
    const next = deleteRowWithMerges(rows, merges, idx);
    setContent(block, {
      rows: next.rows,
      rowColors: rowColors.length ? rowColors.filter((_, i) => i !== idx) : rowColors,
      merges: next.merges,
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
      { rows: rows.map((r) => [...r, ""]), colWidths: defaultColWidths(cols + 1, narrowFirstCol), merges: remapInsertColumn(merges, cols) },
      onChange,
    );
  const removeCol = () => {
    if (cols <= 1) return;
    setContent(
      block,
      { rows: rows.map((r) => r.slice(0, -1)), colWidths: defaultColWidths(cols - 1, narrowFirstCol), merges: remapDeleteColumn(merges, cols - 1) },
      onChange,
    );
  };
  const deleteColAt = (idx: number) => {
    if (cols <= 1) return;
    setContent(
      block,
      { rows: rows.map((r) => r.filter((_, i) => i !== idx)), colWidths: defaultColWidths(cols - 1, narrowFirstCol), merges: remapDeleteColumn(merges, idx) },
      onChange,
    );
  };

  const mergeRight = (r: number, c: number) => {
    const next = mergeCellsRight(rows, merges, r, c);
    setContent(block, { rows: next.rows, merges: next.merges }, onChange);
  };
  const mergeDown = (r: number, c: number) => {
    const next = mergeCellsDown(rows, merges, r, c, !!block.content.headerRow);
    setContent(block, { rows: next.rows, merges: next.merges }, onChange);
  };
  const unmerge = (r: number, c: number) => {
    const next = unmergeCell(rows, merges, r, c);
    setContent(block, { rows: next.rows, merges: next.merges }, onChange);
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
                          className="absolute top-0 right-0 h-full w-1 -mr-[2px] cursor-col-resize bg-muted-foreground/50 hover:bg-primary z-10"
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
                        if (coveredBy(merges, ri, ci)) return null;
                        const anchor = mergeAt(merges, ri, ci);
                        const span = anchor?.span ?? 1;
                        const rSpan = anchor ? rowSpanOf(anchor) : 1;
                        const rightCheck = checkMergeRight(rows, merges, ri, ci);
                        const downCheck = canMergeDown(rows, merges, ri, ci, !!block.content.headerRow);
                        const showRight = rightCheck.ok || !!rightCheck.reason;
                        const showDown = downCheck.ok || !!downCheck.reason;
                        const canMergeRight = showRight || showDown;
                        const isHeaderCell = !!block.content.headerRow && ri === 0;
                        const bgCls = rowBg
                          ? "bg-transparent"
                          : isHeaderCell
                            ? "bg-muted/40"
                            : "bg-background";
                        const parsed = parseCellPictogram(cell);
                        return (
                          <td key={ci} colSpan={span} rowSpan={rSpan} className="border border-muted-foreground/50 p-0 relative group/cell">
                            <div className="flex min-w-0 items-center">
                              {parsed.pictogram !== "none" && (
                                <span className="pl-1 shrink-0">
                                  <PictogramIcon kind={parsed.pictogram} size={20} />
                                </span>
                              )}
                              <TableCellEditor
                                label={`Buňka ${ri + 1}, ${ci + 1}`}
                                value={parsed.text}
                                onChange={(value) => updateCell(ri, ci, buildCellValue(parsed.pictogram, value))}
                                className={`min-w-0 flex-1 rounded-none border-0 shadow-none focus-visible:ring-1 ${bgCls} ${
                                  isHeaderCell ? "font-semibold" : ""
                                } ${narrowFirstCol && ci === 0 ? "text-center" : ""}`}
                              />
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    title="Možnosti buňky"
                                    aria-label="Možnosti buňky"
                                    className="shrink-0 mr-1 rounded p-0.5 text-muted-foreground opacity-0 group-hover/cell:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 hover:bg-muted"
                                  >
                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-2" align="end">
                                  <div className="flex flex-col gap-0.5">
                                    {PICTOGRAM_OPTIONS.map((o) => (
                                      <button
                                        key={o.value}
                                        type="button"
                                        onClick={() =>
                                          updateCell(ri, ci, o.value === "none" ? parsed.text : buildCellValue(o.value, parsed.text))
                                        }
                                        title={o.label}
                                        aria-label={o.label}
                                        className={`rounded px-2 py-1 text-left text-xs hover:bg-muted ${
                                          parsed.pictogram === o.value ? "bg-muted ring-1 ring-ring" : ""
                                        }`}
                                      >
                                        <PictogramOptionRow kind={o.value} label={o.label} />
                                      </button>
                                    ))}
                                  </div>
                                  {(canMergeRight || anchor) && (
                                    <div className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
                                      {showRight && (
                                        <button
                                          type="button"
                                          aria-disabled={!rightCheck.ok}
                                          onClick={() => rightCheck.ok && mergeRight(ri, ci)}
                                          title={rightCheck.ok ? "Sloučit s buňkou vpravo" : rightCheck.reason}
                                          aria-label="Sloučit s buňkou vpravo"
                                          className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent"
                                        >
                                          <Combine className="w-3.5 h-3.5" /> Sloučit s buňkou vpravo
                                        </button>
                                      )}
                                      {showDown && (
                                        <button
                                          type="button"
                                          aria-disabled={!downCheck.ok}
                                          onClick={() => downCheck.ok && mergeDown(ri, ci)}
                                          title={downCheck.ok ? "Sloučit s buňkou dolů" : downCheck.reason}
                                          aria-label="Sloučit s buňkou dolů"
                                          className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent"
                                        >
                                          <Combine className="w-3.5 h-3.5 rotate-90" /> Sloučit s buňkou dolů
                                        </button>
                                      )}
                                      {anchor && (
                                        <button
                                          type="button"
                                          onClick={() => unmerge(ri, ci)}
                                          title="Zrušit sloučení"
                                          aria-label="Zrušit sloučení"
                                          className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted"
                                        >
                                          <Split className="w-3.5 h-3.5" /> Zrušit sloučení
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </PopoverContent>
                              </Popover>
                            </div>
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

function ImageTableBlockEditor({ block, onChange, imageNumber, imageLabelPrefix, imageLabelUnnumbered }: { block: Block; onChange: Props["onChange"]; imageNumber?: number; imageLabelPrefix?: string; imageLabelUnnumbered?: string }) {
  const imageContent = block.content?.image ?? { url: "", alt: "" };
  const tableContent = block.content?.table ?? { headerRow: true, rows: [["#", "Název části"]] };

  const handleSub = (key: "image" | "table") => (_id: string, patch: Partial<Block>) => {
    if (patch.content !== undefined) {
      onChange(block.id, { content: { ...block.content, [key]: patch.content } });
    }
  };

  return (
    <div className="space-y-4">
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Obrázek</div>
            <ImageBlockEditor
              block={{ ...block, type: "image", content: imageContent } as Block}
              onChange={handleSub("image")}
              hidePictogram
              sizeOnly
              pictogramOverride={{ value: block.content?.pictogram, onChange: (v) => onChange(block.id, { content: { ...block.content, pictogram: v } }) }}
              imageNumber={imageNumber}
              imageLabelPrefix={imageLabelPrefix}
              imageLabelUnnumbered={imageLabelUnnumbered}
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
    </div>
  );
}

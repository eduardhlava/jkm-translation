import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, AlertTriangle, Info, AlertCircle, Loader2, Upload, Plus, Minus, ChevronDown, ChevronRight, List, ListMinus, ListOrdered, Link, ImageIcon, AlignLeft, AlignCenter, AlignRight, SeparatorHorizontal, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BLOCK_TYPE_LABELS, type Block } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface Props {
  block: Block;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onChange: (id: string, patch: Partial<Block>) => void;
  onDelete: (id: string) => void;
  headingNumber?: string;
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

export default function BlockItem({ block, collapsed, onToggleCollapsed, onChange, onDelete, headingNumber }: Props) {
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
      className="group relative rounded-lg border bg-card shadow-sm"
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
          <BlockBody block={block} onChange={onChange} headingNumber={headingNumber} />
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
  return (
    <div className="flex items-center justify-between border-b bg-muted/30 px-2 py-1">
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
        {block.type.startsWith("heading") && (
          <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer select-none ml-1">
            <Checkbox
              checked={!!block.content.unlisted}
              onCheckedChange={(v) => setContent(block, { unlisted: v === true }, onChange)}
            />
            Nečíslovat a nezahrnovat do obsahu
          </label>
        )}
        {collapsed && preview && (
          <span className="ml-2 truncate text-xs text-muted-foreground/80">— {preview}</span>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(block.id)}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}




function setContent(block: Block, patch: any, onChange: Props["onChange"]) {
  onChange(block.id, { content: { ...block.content, ...patch } });
}

function BlockBody({ block, onChange, headingNumber }: { block: Block; onChange: Props["onChange"]; headingNumber?: string }) {
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
      return <ImageBlockEditor block={block} onChange={onChange} />;
    case "table":
      return <TableBlockEditor block={block} onChange={onChange} />;
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
    document.execCommand(cmd, false, value);
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
      </div>
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
        className="ProseMirror min-h-[60px] rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring prose prose-sm max-w-none"
      />
    </div>
  );
}

function ImageBlockEditor({ block, onChange }: { block: Block; onChange: Props["onChange"] }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const onPick = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `block-editor/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("notion-images").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("notion-images").getPublicUrl(path);
      setContent(block, { url: data.publicUrl, alt: block.content.alt || file.name }, onChange);
      toast.success("Obrázek nahrán");
    } catch (e) {
      toast.error("Nahrání selhalo", { description: e instanceof Error ? e.message : "" });
    } finally {
      setUploading(false);
    }
  };

  const handleInsertFromNotion = (item: { image: string; title: string }) => {
    setContent(block, { url: item.image, alt: block.content.alt || item.title }, onChange);
    setPickerOpen(false);
    toast.success("Obrázek vložen");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
          Nahrát obrázek
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
          <ImageIcon className="w-4 h-4 mr-1" />
          Vybrat v Notion
        </Button>
        <Input
          value={block.content.url ?? ""}
          onChange={(e) => setContent(block, { url: e.target.value }, onChange)}
          placeholder="…nebo URL"
          className="flex-1 min-w-[200px]"
        />
      </div>
      {block.content.url && (
        <img src={block.content.url} alt={block.content.alt} className="max-h-64 rounded border" />
      )}
      <Input
        value={block.content.alt ?? ""}
        onChange={(e) => setContent(block, { alt: e.target.value }, onChange)}
        placeholder="Popis obrázku"
      />

      <NotionImagePicker open={pickerOpen} onOpenChange={setPickerOpen} onInsert={handleInsertFromNotion} />
    </div>
  );
}

type NotionImageItem = { id: string; title: string; image: string; url: string; typ?: string; stroj?: string; createdTime?: string };

const TYP_OPTIONS = ["schéma", "3D model", "fotografie"];
const STROJ_OPTIONS = ["JCM", "JCC", "JAB"];
const ALL = "__all__";

function NotionImagePicker({
  open,
  onOpenChange,
  onInsert,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onInsert: (item: NotionImageItem) => void;
}) {
  const [items, setItems] = useState<NotionImageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typ, setTyp] = useState<string>(ALL);
  const [stroj, setStroj] = useState<string>(ALL);
  const [name, setName] = useState<string>("");
  const [debouncedName, setDebouncedName] = useState<string>("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedName(name.trim()), 300);
    return () => clearTimeout(t);
  }, [name]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase.functions
      .invoke("notion-images", {
        body: {
          limit: 5,
          typ: typ === ALL ? undefined : typ,
          stroj: stroj === ALL ? undefined : stroj,
          name: debouncedName || undefined,
        },
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) throw error;
        setItems((data?.items ?? []) as NotionImageItem[]);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Načtení selhalo");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, typ, stroj, debouncedName]);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Obrázky z Notion</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Název</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Hledat podle názvu…" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Typ</Label>
              <Select value={typ} onValueChange={setTyp}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Vše</SelectItem>
                  {TYP_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Stroj</Label>
              <Select value={stroj} onValueChange={setStroj}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Vše</SelectItem>
                  {STROJ_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="max-h-[60vh] overflow-auto rounded border">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Načítám…
              </div>
            ) : error ? (
              <div className="p-4 text-sm text-destructive">{error}</div>
            ) : items.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">Nic nenalezeno.</div>
            ) : (
              <ul className="divide-y">
                {items.map((it) => (
                  <li key={it.id} className="flex items-center gap-3 p-2 min-w-0">
                    <img
                      src={it.image}
                      alt={it.title}
                      className="h-14 w-14 shrink-0 rounded border object-cover bg-muted"
                      loading="lazy"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{it.title || "Bez názvu"}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {[it.typ, it.stroj].filter(Boolean).join(" • ")}
                      </div>
                    </div>
                    <Button type="button" size="sm" className="shrink-0" onClick={() => onInsert(it)}>
                      Vložit
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


function TableBlockEditor({ block, onChange }: { block: Block; onChange: Props["onChange"] }) {
  const rows: string[][] = block.content.rows ?? [];
  const cols = rows[0]?.length ?? 0;

  const updateCell = (r: number, c: number, v: string) => {
    const next = rows.map((row, ri) => row.map((cell, ci) => (ri === r && ci === c ? v : cell)));
    setContent(block, { rows: next }, onChange);
  };

  const addRow = () => setContent(block, { rows: [...rows, Array(cols).fill("")] }, onChange);
  const removeRow = () => rows.length > 1 && setContent(block, { rows: rows.slice(0, -1) }, onChange);
  const addCol = () => setContent(block, { rows: rows.map((r) => [...r, ""]) }, onChange);
  const removeCol = () => cols > 1 && setContent(block, { rows: rows.map((r) => r.slice(0, -1)) }, onChange);

  return (
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
        </div>
      </div>
      <div className="overflow-auto rounded-md bg-[hsl(220,14%,90%)] p-3 dark:bg-[hsl(217,33%,12%)]">
        <table className="w-full border-collapse">
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="border p-0">
                    <Input
                      value={cell}
                      onChange={(e) => updateCell(ri, ci, e.target.value)}
                      className={`h-8 rounded-none border-0 shadow-none focus-visible:ring-1 ${
                        block.content.headerRow && ri === 0 ? "font-semibold bg-muted/40" : ""
                      }`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

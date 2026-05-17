import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, AlertTriangle, Info, AlertCircle, Loader2, Upload, Plus, Minus, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { BLOCK_TYPE_LABELS, type Block } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { useRef, useState } from "react";
import { toast } from "sonner";

interface Props {
  block: Block;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onChange: (id: string, patch: Partial<Block>) => void;
  onDelete: (id: string) => void;
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
    default:
      return "";
  }
}

export default function BlockItem({ block, collapsed, onToggleCollapsed, onChange, onDelete }: Props) {
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
          <span className="text-xs font-medium text-muted-foreground shrink-0">
            {BLOCK_TYPE_LABELS[block.type]}
          </span>
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
      {!collapsed && (
        <div className="p-3">
          <BlockBody block={block} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

function setContent(block: Block, patch: any, onChange: Props["onChange"]) {
  onChange(block.id, { content: { ...block.content, ...patch } });
}

function BlockBody({ block, onChange }: { block: Block; onChange: Props["onChange"] }) {
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
        <Input
          value={block.content.text ?? ""}
          onChange={(e) => setContent(block, { text: e.target.value }, onChange)}
          placeholder={BLOCK_TYPE_LABELS[block.type]}
          className={`border-0 shadow-none focus-visible:ring-0 px-0 h-auto py-1 ${sizeCls}`}
        />
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
  }
}

function TextBlockEditor({ block, onChange }: { block: Block; onChange: Props["onChange"] }) {
  const ref = useRef<HTMLDivElement>(null);

  const exec = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    if (ref.current) {
      onChange(block.id, { content: { html: ref.current.innerHTML } });
    }
  };

  const onLink = () => {
    const url = window.prompt("URL odkazu:", "https://");
    if (!url) return;
    exec("createLink", url);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={() => exec("bold")} className="h-7 px-2 font-bold">B</Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => exec("italic")} className="h-7 px-2 italic">I</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onLink} className="h-7 px-2 underline">Odkaz</Button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange(block.id, { content: { html: (e.target as HTMLDivElement).innerHTML } })}
        className="min-h-[60px] rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: block.content.html || "" }}
      />
    </div>
  );
}

function ImageBlockEditor({ block, onChange }: { block: Block; onChange: Props["onChange"] }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
        <Input
          value={block.content.url ?? ""}
          onChange={(e) => setContent(block, { url: e.target.value }, onChange)}
          placeholder="…nebo URL"
          className="flex-1 min-w-[200px]"
        />
      </div>
      <Input
        value={block.content.alt ?? ""}
        onChange={(e) => setContent(block, { alt: e.target.value }, onChange)}
        placeholder="Alternativní text"
      />
      {block.content.url && (
        <img src={block.content.url} alt={block.content.alt} className="max-h-64 rounded border" />
      )}
    </div>
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
      <div className="overflow-auto">
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

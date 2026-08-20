import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, X, Check, Folder, ChevronRight, ChevronDown, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const LAST_FOLDER_KEY = "notion-upload-last-folder";


const TYP_OPTIONS = ["schéma", "3D model", "fotografie", "elektrické schéma", "ostatní"];
const STROJ_OPTIONS = [
  "JCM", "JGS", "JGP", "JHA", "JHV", "JHP", "JHS", "JHI", "JHD", "JHC",
  "JCT", "JGT", "JGD", "JGC", "JCR", "JCC", "JAB", "JVR",
  "JCP", "JTE", "JMS", "JTU", "JCS", "JVE", "JVL", "JVC", "JTR",
];

export type UploadedNotionImage = {
  id: string;
  image: string;
  title: string;
  url?: string;
};

interface NotionFolder {
  id: string;
  name: string;
  parentId: string | null;
}

interface PendingFile {
  localId: string;
  file: File;
  preview: string;
  title: string;
  typ: string;
  stroj: string;
  folderId: string;
  uploading?: boolean;
  done?: boolean;
  result?: UploadedNotionImage;
  error?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onInsert: (item: UploadedNotionImage) => void;
}

function stripExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function NotionImageUploadDialog({ open, onOpenChange, onInsert }: Props) {
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [folders, setFolders] = useState<NotionFolder[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || folders.length > 0 || foldersLoading) return;
    setFoldersLoading(true);
    supabase.functions
      .invoke("notion-library", { body: { allFolders: true } })
      .then(({ data, error }) => {
        if (error) throw error;
        setFolders(((data as any)?.allFolders ?? []) as NotionFolder[]);
      })
      .catch(() => toast.error("Složky se nepodařilo načíst"))
      .finally(() => setFoldersLoading(false));
  }, [open, folders.length, foldersLoading]);

  const norm = (id: string | null | undefined) => (id ? id.replace(/-/g, "") : null);

  const byNormId = useMemo(
    () => new Map(folders.map((f) => [norm(f.id) as string, f])),
    [folders],
  );

  const childrenOf = useCallback(
    (parentId: string | null) =>
      folders
        .filter((f) => norm(f.parentId) === norm(parentId))
        .sort((a, b) => (a.name || "").localeCompare(b.name || "", "cs")),
    [folders],
  );

  const pathOf = useCallback(
    (id: string | null): string => {
      if (!id) return "";
      const parts: string[] = [];
      let cur = byNormId.get(norm(id) as string);
      let guard = 20;
      while (cur && guard-- > 0) {
        parts.unshift(cur.name || "—");
        cur = cur.parentId ? byNormId.get(norm(cur.parentId) as string) : undefined;
      }
      return parts.join(" / ");
    },
    [byNormId],
  );

  const reset = () => setFiles([]);

  const addFiles = useCallback((list: FileList | File[]) => {
    const first = Array.from(list).find((f) => f.type.startsWith("image/"));
    if (!first) return;
    let last = "";
    try {
      last = localStorage.getItem(LAST_FOLDER_KEY) ?? "";
    } catch {
      last = "";
    }
    setFiles([
      {
        localId: crypto.randomUUID(),
        file: first,
        preview: URL.createObjectURL(first),
        title: stripExt(first.name),
        typ: "",
        stroj: "",
        folderId: last,
      },
    ]);
  }, []);


  const updateOne = (id: string, patch: Partial<PendingFile>) =>
    setFiles((prev) => prev.map((f) => (f.localId === id ? { ...f, ...patch } : f)));

  const removeOne = (id: string) =>
    setFiles((prev) => prev.filter((f) => f.localId !== id));

  const handleInsert = async (item: PendingFile) => {
    if (!item.title.trim()) {
      toast.error("Zadejte název obrázku");
      return;
    }
    updateOne(item.localId, { uploading: true, error: undefined });
    try {
      const fileBase64 = await fileToBase64(item.file);
      const { data, error } = await supabase.functions.invoke("notion-image-upload", {
        body: {
          fileBase64,
          fileName: item.file.name,
          contentType: item.file.type,
          title: item.title.trim(),
          typ: item.typ || undefined,
          stroj: item.stroj || undefined,
          folderId: item.folderId || undefined,
        },
      });
      if (error) throw error;
      const result = data as UploadedNotionImage;
      if (item.folderId) {
        try {
          localStorage.setItem(LAST_FOLDER_KEY, item.folderId);
        } catch { /* ignore */ }
      }
      updateOne(item.localId, { uploading: false, done: true, result });
      onInsert(result);
      toast.success("Obrázek nahrán do Notion a vložen");

    } catch (e) {
      const msg = e instanceof Error ? e.message : "Nahrání selhalo";
      updateOne(item.localId, { uploading: false, error: msg });
      toast.error("Nahrání selhalo", { description: msg });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent
        className="max-w-3xl w-[calc(100vw-2rem)] overflow-hidden"
        style={{ ["--border" as any]: "220 13% 70%", ["--input" as any]: "220 13% 70%" }}
      >
        <DialogHeader>
          <DialogTitle>Nahrát obrázek do Notion</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-sm text-muted-foreground cursor-pointer transition ${
              dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:bg-muted/30"
            }`}
          >
            <Upload className="h-6 w-6" />
            <div>Přetáhněte obrázek sem nebo kliknutím vyberte z disku</div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {files.length > 0 && (
            <div className="max-h-[55vh] overflow-auto rounded border divide-y">
              {files.map((f) => (
                <div key={f.localId} className="flex gap-3 p-3">
                  <img
                    src={f.preview}
                    alt={f.title}
                    className="h-24 w-24 shrink-0 rounded border object-cover bg-muted"
                  />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Název</Label>
                      <Input
                        value={f.title}
                        disabled={f.done}
                        onChange={(e) => updateOne(f.localId, { title: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Typ</Label>
                        <Select
                          value={f.typ}
                          onValueChange={(v) => updateOne(f.localId, { typ: v })}
                          disabled={f.done}
                        >
                          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {TYP_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Stroj</Label>
                        <Select
                          value={f.stroj}
                          onValueChange={(v) => updateOne(f.localId, { stroj: v })}
                          disabled={f.done}
                        >
                          <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {STROJ_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Složka</Label>
                      <FolderBrowser
                        value={f.folderId}
                        disabled={f.done || foldersLoading}
                        loading={foldersLoading}
                        pathOf={pathOf}
                        childrenOf={childrenOf}
                        parentOf={(id) => byNormId.get((id || "").replace(/-/g, ""))?.parentId ?? null}
                        onChange={(v) => updateOne(f.localId, { folderId: v })}
                      />
                    </div>

                    {f.error && <div className="text-xs text-destructive">{f.error}</div>}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0 justify-center">
                    {f.done ? (
                      <Button size="sm" variant="outline" disabled>
                        <Check className="h-4 w-4 mr-1" /> Vloženo
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleInsert(f)}
                        disabled={f.uploading}
                      >
                        {f.uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                        Vložit
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeOne(f.localId)}
                      disabled={f.uploading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FolderBrowser({
  value,
  disabled,
  loading,
  pathOf,
  childrenOf,
  parentOf,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  loading?: boolean;
  pathOf: (id: string | null) => string;
  childrenOf: (parentId: string | null) => NotionFolder[];
  parentOf: (id: string | null) => string | null;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const key = (id: string) => id.replace(/-/g, "");

  // expand ancestors of selected value when opening
  useEffect(() => {
    if (!open || !value) return;
    const next: Record<string, boolean> = {};
    let cur = parentOf(value);
    let guard = 20;
    while (cur && guard-- > 0) {
      next[key(cur)] = true;
      cur = parentOf(cur);
    }
    setExpanded((e) => ({ ...e, ...next }));
  }, [open, value]);

  const renderRow = (f: NotionFolder, depth: number) => {
    const k = key(f.id);
    const kids = childrenOf(f.id);
    const isOpen = !!expanded[k];
    const selected = k === key(value || "");
    return (
      <div key={f.id}>
        <div
          className={`flex cursor-pointer items-center gap-1 rounded-sm py-1 pr-2 text-sm ${
            selected ? "bg-primary text-primary-foreground" : "hover:bg-muted/60"
          }`}
          style={{ paddingLeft: 4 + depth * 16 }}
          onClick={() => onChange(f.id)}
          onDoubleClick={() => setExpanded((e) => ({ ...e, [k]: !isOpen }))}
        >
          {kids.length > 0 ? (
            <button
              type="button"
              className="flex h-4 w-4 shrink-0 items-center justify-center opacity-70"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((s) => ({ ...s, [k]: !isOpen }));
              }}
            >
              {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <span className="h-4 w-4 shrink-0" />
          )}
          <Folder
            className={`h-4 w-4 shrink-0 ${selected ? "" : "text-sky-500"}`}
            fill="currentColor"
            strokeWidth={1.5}
          />
          <span className="truncate">{f.name || "—"}</span>
        </div>
        {isOpen && kids.map((c) => renderRow(c, depth + 1))}
      </div>
    );
  };

  const roots = childrenOf(null);

  return (
    <Popover open={open} onOpenChange={(v) => !disabled && setOpen(v)}>
      <PopoverTrigger asChild>
        <Button variant="outline" disabled={disabled} className="w-full justify-start font-normal">
          <Folder className="h-4 w-4 mr-2 shrink-0" />
          <span className="truncate">
            {loading ? "Načítání složek…" : value ? pathOf(value) : "Vybrat složku"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="max-h-72 overflow-auto p-1">
          <div
            className={`flex cursor-pointer items-center gap-1 rounded-sm py-1 pl-1 pr-2 text-sm ${
              !value ? "bg-primary text-primary-foreground" : "hover:bg-muted/60"
            }`}
            onClick={() => onChange("")}
          >
            <span className="h-4 w-4 shrink-0" />
            <Home className="h-4 w-4 shrink-0" />
            <span className="truncate">Kořen (bez složky)</span>
          </div>
          {roots.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Žádné složky</div>
          )}
          {roots.map((f) => renderRow(f, 0))}
        </div>
        <div className="flex justify-end border-t p-2">
          <Button size="sm" onClick={() => setOpen(false)}>
            Hotovo
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}


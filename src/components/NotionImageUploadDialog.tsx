import { useCallback, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TYP_OPTIONS = ["schéma", "3D model", "fotografie"];
const STROJ_OPTIONS = ["JCM", "JCC", "JAB"];

export type UploadedNotionImage = {
  id: string;
  image: string;
  title: string;
  url?: string;
};

interface PendingFile {
  localId: string;
  file: File;
  preview: string;
  title: string;
  typ: string;
  stroj: string;
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
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => setFiles([]);

  const addFiles = useCallback((list: FileList | File[]) => {
    const first = Array.from(list).find((f) => f.type.startsWith("image/"));
    if (!first) return;
    setFiles([
      {
        localId: crypto.randomUUID(),
        file: first,
        preview: URL.createObjectURL(first),
        title: stripExt(first.name),
        typ: "",
        stroj: "",
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
        },
      });
      if (error) throw error;
      const result = data as UploadedNotionImage;
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
      <DialogContent className="max-w-3xl w-[calc(100vw-2rem)] overflow-hidden">
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
            <div>Přetáhněte obrázky sem nebo kliknutím vyberte z disku</div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
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

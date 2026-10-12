import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import MultiSelect from "@/components/MultiSelect";
import { FolderBrowser, type NotionFolder } from "@/components/NotionImageUploadDialog";
import { useFilterOptions } from "@/lib/filterOptions";

export type EditableFile = {
  id: string;
  title: string;
  typ: string[];
  stroj: string[];
  folderId: string | null;
};

interface Props {
  file: EditableFile | null;
  folders: NotionFolder[];
  onClose: () => void;
  onSaved: () => void;
}

const norm = (id: string | null | undefined) => (id ? id.replace(/-/g, "") : null);

export default function EditFileDialog({ file, folders, onClose, onSaved }: Props) {
  const opts = useFilterOptions(!!file);
  const [title, setTitle] = useState("");
  const [typ, setTyp] = useState<string[]>([]);
  const [stroj, setStroj] = useState<string[]>([]);
  const [folderId, setFolderId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!file) return;
    setTitle(file.title);
    setTyp(file.typ);
    setStroj(file.stroj);
    setFolderId(file.folderId ?? "");
  }, [file]);

  const byId = useMemo(() => new Map(folders.map((f) => [norm(f.id) as string, f])), [folders]);
  const childrenOf = useCallback(
    (parentId: string | null) =>
      folders
        .filter((f) => norm(f.parentId) === norm(parentId))
        .sort((a, b) => (a.name || "").localeCompare(b.name || "", "cs")),
    [folders],
  );
  const pathOf = useCallback(
    (id: string | null) => {
      const parts: string[] = [];
      let cur = id ? byId.get(norm(id) as string) : undefined;
      let guard = 20;
      while (cur && guard-- > 0) {
        parts.unshift(cur.name || "—");
        cur = cur.parentId ? byId.get(norm(cur.parentId) as string) : undefined;
      }
      return parts.join(" / ");
    },
    [byId],
  );

  const save = async () => {
    if (!file) return;
    if (!title.trim()) {
      toast.error("Zadejte název souboru");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("notion-file-update", {
        body: { id: file.id, title: title.trim(), typ, stroj, folderId: folderId || null },
      });
      if ((data as any)?.error) throw new Error((data as any).error);
      if (error) throw error;
      toast.success("Soubor uložen");
      onSaved();
      onClose();
    } catch (e) {
      toast.error("Uložení selhalo", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upravit soubor</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Název</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Typ</Label>
            <MultiSelect options={opts.typ} value={typ} onChange={setTyp} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Stroj</Label>
            <MultiSelect options={opts.stroj} value={stroj} onChange={setStroj} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Složka</Label>
            <FolderBrowser
              value={folderId}
              pathOf={pathOf}
              childrenOf={childrenOf}
              parentOf={(id) => byId.get(norm(id) as string)?.parentId ?? null}
              onChange={setFolderId}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Zrušit</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Uložit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type NotionImageItem = {
  id: string;
  title: string;
  image: string;
  url: string;
  typ?: string;
  stroj?: string;
  createdTime?: string;
};

const TYP_OPTIONS = ["schéma", "3D model", "fotografie"];
const STROJ_OPTIONS = ["JCM", "JCC", "JAB"];
const ALL = "__all__";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onInsert: (item: NotionImageItem) => void;
}

export default function NotionImagePicker({ open, onOpenChange, onInsert }: Props) {
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

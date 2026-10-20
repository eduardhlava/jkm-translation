import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ImageIcon, Upload, Loader2 } from "lucide-react";
import NotionImagePicker from "@/components/NotionImagePicker";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DEFAULT_DOCUMENT_METADATA, DOCUMENT_LANGUAGES, type DocumentMetadata, type DocumentDisclaimer } from "./types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRef } from "react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: DocumentMetadata;
  documentTitle: string;
  onChange: (next: DocumentMetadata, title: string) => Promise<void>;
  numberHeadings?: boolean;
  onNumberHeadingsChange?: (v: boolean) => void;
}

export default function DocumentMetadataDialog({ open, onOpenChange, value, documentTitle, onChange, numberHeadings, onNumberHeadingsChange }: Props) {
  const [draft, setDraft] = useState<DocumentMetadata>(value);
  const [title, setTitle] = useState(documentTitle);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setDraft(value);
      setTitle(documentTitle);
    }
  }, [open, value, documentTitle]);

  const update = (patch: Partial<DocumentMetadata>) => setDraft((d) => ({ ...d, ...patch }));
  const updateDisclaimer = (
    key: "disclaimerWarning" | "disclaimerNotice" | "disclaimerConfidential",
    patch: Partial<DocumentDisclaimer>,
  ) => setDraft((d) => ({ ...d, [key]: { ...d[key], ...patch } }));

  const save = async () => {
    if (!title.trim()) {
      toast.error("Název dokumentu nesmí být prázdný");
      return;
    }
    setSaving(true);
    try {
      await onChange(draft, title.trim());
      onOpenChange(false);
    } catch (e) {
      toast.error("Uložení metadat selhalo", { description: e instanceof Error ? e.message : "" });
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => setDraft(DEFAULT_DOCUMENT_METADATA);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `document-cover/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("notion-images").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("notion-images").getPublicUrl(path);
      update({ coverImageUrl: data.publicUrl, coverImageAlt: draft.coverImageAlt || file.name });
      toast.success("Obrázek nahrán");
    } catch (e) {
      toast.error("Nahrání selhalo", { description: e instanceof Error ? e.message : "" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <DialogContent
        className="max-w-2xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto"
        style={{ ["--border" as any]: "220 13% 70%", ["--input" as any]: "220 13% 70%" }}
      >
        <DialogHeader>
          <DialogTitle>Metadata dokumentu</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="metadata-document-title" className="text-xs text-muted-foreground">Název dokumentu</Label>
            <Input id="metadata-document-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={saving} required />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="metadata-document-code" className="text-xs text-muted-foreground">Označení dokumentu</Label>
              <Input id="metadata-document-code" value={draft.docCode} onChange={(e) => update({ docCode: e.target.value })} placeholder="např. JHI 05_CZ" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="metadata-document-heading" className="text-xs text-muted-foreground">Nadpis dokumentu</Label>
              <Input id="metadata-document-heading" value={draft.docName} onChange={(e) => update({ docName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Jazyk dokumentu</Label>
              <Select value={draft.language} onValueChange={(v) => update({ language: v })}>
                <SelectTrigger><SelectValue placeholder="Vyberte jazyk" /></SelectTrigger>
                <SelectContent>
                  {DOCUMENT_LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>{l.code} – {l.nativeName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Označení obrázků</Label>
              <Input
                value={draft.imageLabelPrefix}
                onChange={(e) => update({ imageLabelPrefix: e.target.value })}
                placeholder="Obrázek č. "
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Úvodní obrázek</Label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.target.value = "";
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                Nahrát
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                <ImageIcon className="w-4 h-4 mr-1" /> Vybrat v Notion
              </Button>
              <Input
                value={draft.coverImageUrl}
                onChange={(e) => update({ coverImageUrl: e.target.value })}
                placeholder="…nebo URL"
                className="flex-1 min-w-[200px]"
              />
            </div>
            {draft.coverImageUrl && (
              <img src={draft.coverImageUrl} alt={draft.coverImageAlt} className="max-h-48 rounded border" />
            )}
            <Input
              value={draft.coverImageAlt}
              onChange={(e) => update({ coverImageAlt: e.target.value })}
              placeholder="Popis obrázku"
            />
          </div>

          {([
            { key: "disclaimerWarning", label: "Výstraha" },
            { key: "disclaimerNotice", label: "Upozornění" },
            { key: "disclaimerConfidential", label: "Důvěrná informace" },
          ] as const).map(({ key, label }) => (
            <div key={key} className="space-y-2 rounded-md border p-3">
              <div className="text-xs font-medium text-muted-foreground">{label}</div>
              <Input
                value={draft[key].title}
                onChange={(e) => updateDisclaimer(key, { title: e.target.value })}
                placeholder="Nadpis"
              />
              <Textarea
                value={draft[key].text}
                onChange={(e) => updateDisclaimer(key, { text: e.target.value })}
                rows={4}
                placeholder="Text"
              />
            </div>
          ))}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Revize návodu</Label>
              <Input value={draft.revision} onChange={(e) => update({ revision: e.target.value })} placeholder="např. R3" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Verze návodu (patička)</Label>
              <Input
                value={draft.footerVersion}
                onChange={(e) => update({ footerVersion: e.target.value })}
                placeholder="např. JHI 05_CZ_2601_R3"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Údaje o výrobci</Label>
            <Textarea
              value={draft.manufacturerInfo}
              onChange={(e) => update({ manufacturerInfo: e.target.value })}
              rows={5}
              placeholder={"Údaje o výrobci:\nJK Machinery a.s."}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Copyright</Label>
            <Input value={draft.copyright} onChange={(e) => update({ copyright: e.target.value })} />
          </div>


          <label className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Obsah (Table of Contents)</div>
              <div className="text-xs text-muted-foreground">Zobrazit obsah v PDF dokumentu</div>
            </div>
            <Switch checked={draft.showToc} onCheckedChange={(v) => update({ showToc: v })} />
          </label>
          {onNumberHeadingsChange && (
            <label className="flex items-center justify-between gap-3 rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">Automaticky číslovat nadpisy (H1–H4)</div>
                <div className="text-xs text-muted-foreground">Čísla nadpisů v editoru i v PDF</div>
              </div>
              <Switch checked={!!numberHeadings} onCheckedChange={onNumberHeadingsChange} />
            </label>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="ghost" onClick={resetDefaults} disabled={saving}>Obnovit výchozí</Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Zrušit</Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Uložit změny
          </Button>
        </DialogFooter>

        <NotionImagePicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onInsert={(item) => {
            update({ coverImageUrl: item.image, coverImageAlt: draft.coverImageAlt || item.title });
            setPickerOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

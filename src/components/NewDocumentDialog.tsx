import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DOCUMENT_LANGUAGES } from "@/components/DocumentMetadata/types";

export interface CreatedDocument {
  id: string;
  url: string;
  properties: Record<string, string>;
}

interface PropMeta {
  type: string;
  options?: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schema: Record<string, PropMeta>;
  /** Called with the freshly created Notion page. */
  onCreated: (doc: CreatedDocument, meta: { docName: string; docCode: string; language: string }) => void;
}

const findProp = (schema: Record<string, PropMeta>, candidates: string[]) =>
  Object.keys(schema).find((name) => candidates.includes(name.trim().toLowerCase()));

export default function NewDocumentDialog({ open, onOpenChange, schema, onCreated }: Props) {
  const [docName, setDocName] = useState("");
  const [docCode, setDocCode] = useState("");
  const [language, setLanguage] = useState("cz");
  const [stroj, setStroj] = useState("");
  const [typ, setTyp] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDocName("");
      setDocCode("");
      setLanguage("cz");
      setStroj("");
      setTyp("");
    }
  }, [open]);

  const strojProp = findProp(schema, ["stroj"]);
  const typProp = findProp(schema, ["typ"]);
  const jazykProp = findProp(schema, ["jazyk"]);
  const codeProp = findProp(schema, ["označení", "oznaceni", "kód", "kod", "označení dokumentu"]);

  const strojOptions = strojProp ? schema[strojProp]?.options ?? [] : [];
  const typOptions = typProp ? schema[typProp]?.options ?? [] : [];

  const save = async () => {
    const title = docName.trim();
    if (!title) {
      toast.error("Vyplňte název dokumentu");
      return;
    }
    setSaving(true);
    try {
      const properties: Record<string, string> = {};
      if (strojProp && stroj) properties[strojProp] = stroj;
      if (typProp && typ) properties[typProp] = typ;
      if (jazykProp && language) properties[jazykProp] = language;
      if (codeProp && docCode.trim()) properties[codeProp] = docCode.trim();

      const { data, error } = await supabase.functions.invoke("notion-content", {
        body: { action: "createPage", title, properties },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const created: CreatedDocument = {
        id: (data as any).id,
        url: (data as any).url,
        properties: (data as any).properties ?? {},
      };
      toast.success("Dokument vytvořen v Notion");
      onOpenChange(false);
      onCreated(created, { docName: title, docCode: docCode.trim(), language });
    } catch (e) {
      toast.error("Vytvoření dokumentu selhalo", { description: e instanceof Error ? e.message : "" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nový dokument</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Název dokumentu</Label>
            <Input value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="např. Návod k obsluze" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Označení dokumentu</Label>
            <Input value={docCode} onChange={(e) => setDocCode(e.target.value)} placeholder="např. JHI 05_CZ" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Jazyk dokumentu</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger><SelectValue placeholder="Vyberte jazyk" /></SelectTrigger>
              <SelectContent>
                {DOCUMENT_LANGUAGES.map((l) => (
                  <SelectItem key={l.code} value={l.code}>{l.code} – {l.nativeName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Stroj</Label>
              <Select value={stroj || "__none__"} onValueChange={(v) => setStroj(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Vyberte stroj" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— nevyplněno —</SelectItem>
                  {strojOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Typ</Label>
              <Select value={typ || "__none__"} onValueChange={(v) => setTyp(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Vyberte typ" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— nevyplněno —</SelectItem>
                  {typOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Zrušit</Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Uložit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

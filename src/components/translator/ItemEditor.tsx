import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  LANGUAGES,
  NotionItem,
  TranslatorConfig,
} from "@/lib/translator";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  item: NotionItem;
  config: TranslatorConfig;
  index: number;
  total: number;
  onConfirmed: () => void;
}

const langLabel = (code: string) =>
  LANGUAGES.find((l) => l.code === code)?.label ?? code;

export function ItemEditor({ item, config, index, total, onConfirmed }: Props) {
  const sourceProp = config.languagePropertyMap[config.sourceLanguage];
  const sourceText = item.properties[sourceProp] ?? "";

  const [translations, setTranslations] = useState<Record<string, string>>(
    () => {
      const init: Record<string, string> = {};
      for (const lang of config.targetLanguages) {
        const prop = config.languagePropertyMap[lang];
        init[lang] = (prop && item.properties[prop]) || "";
      }
      return init;
    },
  );
  const [saving, setSaving] = useState(false);

  const updateTranslation = (lang: string, value: string) =>
    setTranslations((t) => ({ ...t, [lang]: value }));

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const textUpdates: Record<string, string> = {};
      for (const lang of config.targetLanguages) {
        const prop = config.languagePropertyMap[lang];
        if (!prop) continue;
        textUpdates[prop] = translations[lang] ?? "";
      }

      const { data, error } = await supabase.functions.invoke("notion-update", {
        body: {
          pageId: item.id,
          textUpdates,
          statusProperty: config.statusProperty,
          newStatusValue: config.doneStatusValue,
        },
      });

      if (error) throw error;
      if (data?.success === false) throw new Error(data.error);

      toast.success("Položka uložena do Notion");
      onConfirmed();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Neznámá chyba";
      toast.error("Uložení selhalo", { description: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6 space-y-6 shadow-[var(--shadow-md)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span>
              Položka {index + 1} z {total}
            </span>
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-primary transition-colors"
            >
              Otevřít v Notion <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <h2 className="text-xl font-semibold">
            {sourceText || <span className="text-muted-foreground">(prázdný název)</span>}
          </h2>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge className="bg-accent text-accent-foreground">
            Zdroj · {langLabel(config.sourceLanguage)}
          </Badge>
          <span className="text-xs text-muted-foreground">{sourceProp}</span>
        </div>
        <div className="p-4 rounded-lg bg-secondary text-secondary-foreground whitespace-pre-wrap text-sm leading-relaxed">
          {sourceText || (
            <span className="text-muted-foreground italic">prázdné</span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {config.targetLanguages.map((lang) => {
          const prop = config.languagePropertyMap[lang];
          return (
            <div key={lang} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Badge variant="outline" className="border-primary/30 text-primary">
                    {langLabel(lang)}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-normal">
                    {prop || "(žádná property)"}
                  </span>
                </Label>
              </div>
              <Textarea
                value={translations[lang] ?? ""}
                onChange={(e) => updateTranslation(lang, e.target.value)}
                placeholder={`Překlad do ${langLabel(lang)}…`}
                className="min-h-24 resize-y"
                disabled={!prop}
              />
            </div>
          );
        })}
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button
          size="lg"
          onClick={handleConfirm}
          disabled={saving}
          className="gap-2"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          Potvrdit a zapsat do Notion
        </Button>
      </div>
    </Card>
  );
}

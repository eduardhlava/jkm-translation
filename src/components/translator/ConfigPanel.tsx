import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LANGUAGES, TranslatorConfig } from "@/lib/translator";
import { X, Plus, Settings2 } from "lucide-react";

interface Props {
  initial: TranslatorConfig | null;
  onSave: (cfg: TranslatorConfig) => void;
  availableProperties?: { name: string; type: string }[];
}

const empty: TranslatorConfig = {
  statusProperty: "Status",
  statusValue: "K překladu",
  doneStatusValue: "Přeloženo",
  sourceLanguage: "cs",
  targetLanguages: ["en"],
  languagePropertyMap: { cs: "Name", en: "Name EN" },
};

export function ConfigPanel({ initial, onSave, availableProperties }: Props) {
  const [cfg, setCfg] = useState<TranslatorConfig>(initial ?? empty);

  useEffect(() => {
    if (initial) setCfg(initial);
  }, [initial]);

  const update = (patch: Partial<TranslatorConfig>) =>
    setCfg((c) => ({ ...c, ...patch }));

  const updateLangProp = (lang: string, prop: string) =>
    setCfg((c) => ({
      ...c,
      languagePropertyMap: { ...c.languagePropertyMap, [lang]: prop },
    }));

  const addTargetLang = (lang: string) => {
    if (cfg.targetLanguages.includes(lang) || lang === cfg.sourceLanguage)
      return;
    setCfg((c) => ({
      ...c,
      targetLanguages: [...c.targetLanguages, lang],
      languagePropertyMap: { ...c.languagePropertyMap, [lang]: "" },
    }));
  };

  const removeTargetLang = (lang: string) =>
    setCfg((c) => ({
      ...c,
      targetLanguages: c.targetLanguages.filter((l) => l !== lang),
    }));

  const langLabel = (code: string) =>
    LANGUAGES.find((l) => l.code === code)?.label ?? code;

  const textPropOptions =
    availableProperties?.filter((p) =>
      ["title", "rich_text"].includes(p.type),
    ) ?? [];

  return (
    <Card className="p-6 space-y-6 shadow-[var(--shadow-md)]">
      <div className="flex items-center gap-2">
        <Settings2 className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Nastavení překladu</h2>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Property statusu v Notion</Label>
          <Input
            value={cfg.statusProperty}
            onChange={(e) => update({ statusProperty: e.target.value })}
            placeholder="Status"
          />
        </div>
        <div className="space-y-2">
          <Label>Hodnota statusu k načtení</Label>
          <Input
            value={cfg.statusValue}
            onChange={(e) => update({ statusValue: e.target.value })}
            placeholder="K překladu"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Hodnota statusu po potvrzení</Label>
          <Input
            value={cfg.doneStatusValue}
            onChange={(e) => update({ doneStatusValue: e.target.value })}
            placeholder="Přeloženo"
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label>Výchozí jazyk</Label>
        <Select
          value={cfg.sourceLanguage}
          onValueChange={(v) => update({ sourceLanguage: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Notion property pro {langLabel(cfg.sourceLanguage)}
          </Label>
          {textPropOptions.length > 0 ? (
            <Select
              value={cfg.languagePropertyMap[cfg.sourceLanguage] ?? ""}
              onValueChange={(v) => updateLangProp(cfg.sourceLanguage, v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Vyber property" />
              </SelectTrigger>
              <SelectContent>
                {textPropOptions.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.name} ({p.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={cfg.languagePropertyMap[cfg.sourceLanguage] ?? ""}
              onChange={(e) =>
                updateLangProp(cfg.sourceLanguage, e.target.value)
              }
              placeholder="Název property"
            />
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Cílové jazyky</Label>
          <Select value="" onValueChange={addTargetLang}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder={
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Plus className="w-3 h-3" /> Přidat
                </span>
              } />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.filter(
                (l) =>
                  l.code !== cfg.sourceLanguage &&
                  !cfg.targetLanguages.includes(l.code),
              ).map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          {cfg.targetLanguages.map((lang) => (
            <div
              key={lang}
              className="flex items-center gap-2 p-3 rounded-lg bg-secondary"
            >
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 min-w-20 justify-center">
                {langLabel(lang)}
              </Badge>
              {textPropOptions.length > 0 ? (
                <Select
                  value={cfg.languagePropertyMap[lang] ?? ""}
                  onValueChange={(v) => updateLangProp(lang, v)}
                >
                  <SelectTrigger className="flex-1 bg-background">
                    <SelectValue placeholder="Notion property" />
                  </SelectTrigger>
                  <SelectContent>
                    {textPropOptions.map((p) => (
                      <SelectItem key={p.name} value={p.name}>
                        {p.name} ({p.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="flex-1 bg-background"
                  value={cfg.languagePropertyMap[lang] ?? ""}
                  onChange={(e) => updateLangProp(lang, e.target.value)}
                  placeholder="Název Notion property"
                />
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeTargetLang(lang)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <Button
        className="w-full"
        size="lg"
        onClick={() => onSave(cfg)}
        disabled={
          !cfg.statusProperty ||
          !cfg.statusValue ||
          cfg.targetLanguages.length === 0 ||
          !cfg.languagePropertyMap[cfg.sourceLanguage]
        }
      >
        Načíst položky z Notion
      </Button>
    </Card>
  );
}

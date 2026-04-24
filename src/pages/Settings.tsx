import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppSettings, defaultSettings, loadSettings, saveSettings } from "@/lib/translator";
import { UI_LANGUAGES, UiLang, t } from "@/lib/i18n";
import { ArrowLeft, Save, Settings2 } from "lucide-react";
import { toast } from "sonner";

const Settings = () => {
  const [s, setS] = useState<AppSettings>(defaultSettings);

  useEffect(() => {
    setS(loadSettings());
  }, []);

  useEffect(() => {
    document.title = `${t(s.uiLang, "settings")} – ${t(s.uiLang, "appName")}`;
  }, [s.uiLang]);

  const update = (patch: Partial<AppSettings>) => setS((c) => ({ ...c, ...patch }));

  const onSave = () => {
    saveSettings(s);
    toast.success(t(s.uiLang, "settingsSaved"));
  };

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-3xl py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings2 className="w-5 h-5 text-primary" />
            <h1 className="font-semibold">{t(s.uiLang, "settings")}</h1>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/"><ArrowLeft className="w-4 h-4 mr-1" />{t(s.uiLang, "back")}</Link>
          </Button>
        </div>
      </header>

      <main className="container max-w-3xl py-8 space-y-6">
        <Card className="p-6 space-y-6 shadow-[var(--shadow-md)]">
          <div className="space-y-2 max-w-xs">
            <Label>{t(s.uiLang, "uiLanguage")}</Label>
            <Select value={s.uiLang} onValueChange={(v) => update({ uiLang: v as UiLang })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UI_LANGUAGES.map((l) => (
                  <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t(s.uiLang, "uiLanguageHint")}</p>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-1">{t(s.uiLang, "statusMappingTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t(s.uiLang, "statusMappingHint")}</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t(s.uiLang, "statusNewLabel")}</Label>
              <Input value={s.statusNew} onChange={(e) => update({ statusNew: e.target.value })} placeholder="nový" />
              <p className="text-xs text-muted-foreground">{t(s.uiLang, "statusNewHint")}</p>
            </div>
            <div className="space-y-2">
              <Label>{t(s.uiLang, "statusReviewLabel")}</Label>
              <Input value={s.statusReview} onChange={(e) => update({ statusReview: e.target.value })} placeholder="ke_kontrole" />
              <p className="text-xs text-muted-foreground">{t(s.uiLang, "statusReviewHint")}</p>
            </div>
            <div className="space-y-2">
              <Label>{t(s.uiLang, "pageSizeLabel")}</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={s.pageSize}
                onChange={(e) => update({ pageSize: Number(e.target.value) || 20 })}
              />
            </div>
          </div>

          <Button onClick={onSave} size="lg" className="gap-2">
            <Save className="w-4 h-4" /> {t(s.uiLang, "saveSettings")}
          </Button>
        </Card>
      </main>
    </div>
  );
};

export default Settings;

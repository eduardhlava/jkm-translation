import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppSettings, defaultSettings, loadSettings, saveSettings } from "@/lib/translator";
import { ArrowLeft, Save, Settings2 } from "lucide-react";
import { toast } from "sonner";

const Settings = () => {
  const [s, setS] = useState<AppSettings>(defaultSettings);

  useEffect(() => {
    setS(loadSettings());
    document.title = "Nastavení – Notion Translator";
  }, []);

  const update = (patch: Partial<AppSettings>) => setS((c) => ({ ...c, ...patch }));

  const onSave = () => {
    saveSettings(s);
    toast.success("Nastavení uloženo");
  };

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-3xl py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings2 className="w-5 h-5 text-primary" />
            <h1 className="font-semibold">Nastavení</h1>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/"><ArrowLeft className="w-4 h-4 mr-1" />Zpět</Link>
          </Button>
        </div>
      </header>

      <main className="container max-w-3xl py-8 space-y-6">
        <Card className="p-6 space-y-6 shadow-[var(--shadow-md)]">
          <div>
            <h2 className="text-lg font-semibold mb-1">Mapování stavů v Notion</h2>
            <p className="text-sm text-muted-foreground">
              Property se jmenuje <code className="text-xs bg-muted px-1 py-0.5 rounded">stav_&#123;jazyk&#125;</code>
              {" "}(např. <code className="text-xs bg-muted px-1 py-0.5 rounded">stav_en</code>).
              Texty jsou ve sloupcích podle kódu jazyka (<code className="text-xs bg-muted px-1 py-0.5 rounded">cz</code>, <code className="text-xs bg-muted px-1 py-0.5 rounded">en</code>, …).
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hodnota „nový" v Notion</Label>
              <Input
                value={s.statusNew}
                onChange={(e) => update({ statusNew: e.target.value })}
                placeholder="nový"
              />
              <p className="text-xs text-muted-foreground">Filtr pro načítání položek.</p>
            </div>
            <div className="space-y-2">
              <Label>Hodnota „přeloženo" v Notion</Label>
              <Input
                value={s.statusReview}
                onChange={(e) => update({ statusReview: e.target.value })}
                placeholder="ke_kontrole"
              />
              <p className="text-xs text-muted-foreground">
                Tato hodnota se zapíše po kliknutí na „Aktualizovat".
              </p>
            </div>
            <div className="space-y-2">
              <Label>Počet položek na dávku</Label>
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
            <Save className="w-4 h-4" /> Uložit nastavení
          </Button>
        </Card>
      </main>
    </div>
  );
};

export default Settings;

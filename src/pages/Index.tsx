import { useEffect, useState } from "react";
import { ConfigPanel } from "@/components/translator/ConfigPanel";
import { ItemEditor } from "@/components/translator/ItemEditor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  loadConfig,
  saveConfig,
  TranslatorConfig,
  NotionItem,
} from "@/lib/translator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Languages, ArrowLeft, CheckCircle2, Loader2, RefreshCw } from "lucide-react";

const Index = () => {
  const [config, setConfig] = useState<TranslatorConfig | null>(null);
  const [items, setItems] = useState<NotionItem[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [availableProps, setAvailableProps] = useState<
    { name: string; type: string }[]
  >([]);

  useEffect(() => {
    setConfig(loadConfig());
    document.title = "Notion Translator – překlady přímo z databáze";
  }, []);

  const fetchItems = async (cfg: TranslatorConfig) => {
    setLoading(true);
    try {
      const wantedProps = [
        cfg.languagePropertyMap[cfg.sourceLanguage],
        ...cfg.targetLanguages
          .map((l) => cfg.languagePropertyMap[l])
          .filter(Boolean),
      ].filter(Boolean);

      const { data, error } = await supabase.functions.invoke("notion-fetch", {
        body: {
          statusProperty: cfg.statusProperty,
          statusValue: cfg.statusValue,
          textProperties: wantedProps,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const fetched = (data?.items ?? []) as NotionItem[];
      setItems(fetched);
      setCurrentIndex(0);
      if (fetched[0]?.allProperties)
        setAvailableProps(fetched[0].allProperties);
      if (fetched.length === 0) {
        toast.info("Žádné položky odpovídající filtru");
      } else {
        toast.success(`Načteno ${fetched.length} položek`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Neznámá chyba";
      toast.error("Načtení selhalo", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = (cfg: TranslatorConfig) => {
    setConfig(cfg);
    saveConfig(cfg);
    fetchItems(cfg);
  };

  const handleConfirmed = () => {
    if (!items) return;
    // remove confirmed item from queue
    const next = items.filter((_, i) => i !== currentIndex);
    setItems(next);
    if (next.length === 0) {
      toast.success("Hotovo! Všechny položky přeloženy.");
      setCurrentIndex(0);
    } else if (currentIndex >= next.length) {
      setCurrentIndex(next.length - 1);
    }
  };

  const backToConfig = () => {
    setItems(null);
    setCurrentIndex(0);
  };

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-5xl py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--gradient-hero)] flex items-center justify-center shadow-[var(--shadow-lg)]">
              <Languages className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold leading-tight">Notion Translator</h1>
              <p className="text-xs text-muted-foreground">
                Překládej položky databáze a zapisuj zpět do Notion
              </p>
            </div>
          </div>
          {items && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => config && fetchItems(config)}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                Obnovit
              </Button>
              <Button variant="outline" size="sm" onClick={backToConfig}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Nastavení
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="container max-w-3xl py-8 space-y-6">
        {!items && (
          <>
            <div className="text-center space-y-2 py-4">
              <h2 className="text-3xl font-bold tracking-tight">
                Překládej rychle, jistě, přímo do Notion
              </h2>
              <p className="text-muted-foreground">
                Nastav zdrojový a cílové jazyky, vyber stav položek a začni.
              </p>
            </div>
            {loading ? (
              <Card className="p-12 flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                Načítám položky z Notion…
              </Card>
            ) : (
              <ConfigPanel
                initial={config}
                onSave={handleSaveConfig}
                availableProperties={availableProps}
              />
            )}
          </>
        )}

        {items && items.length > 0 && config && (
          <>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-[var(--gradient-hero)] transition-all"
                  style={{
                    width: `${((currentIndex + 1) / items.length) * 100}%`,
                  }}
                />
              </div>
              <span className="tabular-nums">
                {currentIndex + 1} / {items.length}
              </span>
            </div>

            <ItemEditor
              key={items[currentIndex].id}
              item={items[currentIndex]}
              config={config}
              index={currentIndex}
              total={items.length}
              onConfirmed={handleConfirmed}
            />

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={currentIndex === 0}
              >
                Předchozí
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  setCurrentIndex((i) => Math.min(items.length - 1, i + 1))
                }
                disabled={currentIndex >= items.length - 1}
              >
                Přeskočit
              </Button>
            </div>
          </>
        )}

        {items && items.length === 0 && (
          <Card className="p-12 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="w-12 h-12 text-success" />
            <h3 className="text-xl font-semibold">Hotovo!</h3>
            <p className="text-muted-foreground">
              Žádné další položky k překladu.
            </p>
            <Button onClick={backToConfig} className="mt-2">
              Zpět na nastavení
            </Button>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Index;

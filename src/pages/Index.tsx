import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AppSettings,
  LANGUAGES,
  NotionItem,
  langLabel,
  loadSettings,
  propContext,
  propExample,
  propStatus,
  propText,
} from "@/lib/translator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CheckCircle2,
  ExternalLink,
  Languages,
  Loader2,
  RefreshCw,
  Save,
  Settings as SettingsIcon,
} from "lucide-react";

type LocalStatus = "new" | "translated";

const Index = () => {
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [sourceLang, setSourceLang] = useState<string>("cz");
  const [targetLang, setTargetLang] = useState<string>("en");
  const [contextLang, setContextLang] = useState<string>("cz");
  const [items, setItems] = useState<NotionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, LocalStatus>>({});
  const [translations, setTranslations] = useState<Record<string, string>>({});

  useEffect(() => {
    document.title = "Notion Translator – překlady přímo z databáze";
    setSettings(loadSettings());
  }, []);

  const sourceProp = propText(sourceLang);
  const targetProp = propText(targetLang);
  const ctxProp = propContext(contextLang);
  const exProp = propExample(contextLang);
  const stProp = propStatus(targetLang);

  const fetchItems = async () => {
    if (sourceLang === targetLang) {
      toast.error("Zdrojový a cílový jazyk musí být různé");
      return;
    }
    setLoading(true);
    setStatusOverrides({});
    setTranslations({});
    try {
      const { data, error } = await supabase.functions.invoke("notion-fetch", {
        body: {
          statusProperty: stProp,
          statusValue: settings.statusNew,
          textProperties: [sourceProp, targetProp, ctxProp, exProp, stProp],
          pageSize: settings.pageSize,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const fetched = (data?.items ?? []) as NotionItem[];
      setItems(fetched);
      // prefill translations with existing target text
      const initial: Record<string, string> = {};
      fetched.forEach((it) => {
        initial[it.id] = it.properties[targetProp] ?? "";
      });
      setTranslations(initial);
      if (fetched.length === 0) toast.info('Žádné položky se stavem „nový"');
      else toast.success(`Načteno ${fetched.length} položek`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Neznámá chyba";
      toast.error("Načtení selhalo", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  const localStatus = (id: string): LocalStatus => statusOverrides[id] ?? "new";

  const toggleStatus = (id: string) =>
    setStatusOverrides((m) => ({
      ...m,
      [id]: m[id] === "translated" ? "new" : "translated",
    }));

  const toUpdate = useMemo(
    () => items.filter((it) => localStatus(it.id) === "translated"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, statusOverrides],
  );

  const handleUpdate = async () => {
    if (toUpdate.length === 0) {
      toast.info("Žádné potvrzené položky");
      return;
    }
    setSaving(true);
    try {
      const updates = toUpdate.map((it) => ({
        pageId: it.id,
        updates: {
          [stProp]: settings.statusReview,
          [targetProp]: translations[it.id] ?? "",
        },
      }));
      const { data, error } = await supabase.functions.invoke("notion-bulk-update", {
        body: { updates },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error);

      const okCount = data?.okCount ?? toUpdate.length;
      toast.success(`Aktualizováno ${okCount}/${toUpdate.length} položek`);
      await fetchItems();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Neznámá chyba";
      toast.error("Aktualizace selhala", { description: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-7xl py-4 flex items-center justify-between">
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
          <Button variant="outline" size="sm" asChild>
            <Link to="/settings">
              <SettingsIcon className="w-4 h-4 mr-1" /> Nastavení
            </Link>
          </Button>
        </div>
      </header>

      <main className="container max-w-7xl py-6 space-y-4">
        <Card className="p-4 flex flex-wrap items-end gap-4 shadow-[var(--shadow-md)]">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Zdrojový jazyk</label>
            <Select value={sourceLang} onValueChange={setSourceLang}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Cílový jazyk</label>
            <Select value={targetLang} onValueChange={setTargetLang}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.filter((l) => l.code !== sourceLang).map((l) => (
                  <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Jazyk kontextu a příkladu</label>
            <Select value={contextLang} onValueChange={setContextLang}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1" />

          <Button onClick={fetchItems} disabled={loading} variant="outline" className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Načíst {settings.pageSize} položek
          </Button>
          <Button onClick={handleUpdate} disabled={saving || toUpdate.length === 0} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Aktualizovat ({toUpdate.length})
          </Button>
        </Card>

        {items.length === 0 && !loading && (
          <Card className="p-12 flex flex-col items-center gap-3 text-center text-muted-foreground">
            <CheckCircle2 className="w-10 h-10 text-success" />
            <p>Žádné položky. Vyber jazyky a klikni na „Načíst".</p>
          </Card>
        )}

        {items.length > 0 && (
          <Card className="overflow-hidden shadow-[var(--shadow-md)]">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[20%]">
                      <Badge className="bg-accent text-accent-foreground mr-2">{langLabel(sourceLang)}</Badge>
                      Zdroj
                    </TableHead>
                    <TableHead className="w-[22%]">
                      <Badge className="bg-primary/10 text-primary mr-2">{langLabel(targetLang)}</Badge>
                      Překlad
                    </TableHead>
                    <TableHead className="w-[18%]">Kontext ({langLabel(contextLang)})</TableHead>
                    <TableHead className="w-[22%]">Příklad věty ({langLabel(contextLang)})</TableHead>
                    <TableHead className="w-[12%]">Stav</TableHead>
                    <TableHead className="w-[6%]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => {
                    const st = localStatus(it.id);
                    return (
                      <TableRow key={it.id}>
                        <TableCell className="align-top whitespace-pre-wrap text-sm">
                          {it.properties[sourceProp] || (
                            <span className="text-muted-foreground italic">—</span>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          <Textarea
                            value={translations[it.id] ?? ""}
                            onChange={(e) =>
                              setTranslations((m) => ({ ...m, [it.id]: e.target.value }))
                            }
                            placeholder={`Překlad (${langLabel(targetLang)})…`}
                            className="min-h-[64px] text-sm"
                          />
                        </TableCell>
                        <TableCell className="align-top whitespace-pre-wrap text-sm text-muted-foreground">
                          {it.properties[ctxProp] || "—"}
                        </TableCell>
                        <TableCell className="align-top whitespace-pre-wrap text-sm text-muted-foreground">
                          {it.properties[exProp] || "—"}
                        </TableCell>
                        <TableCell className="align-top">
                          <Button
                            variant={st === "translated" ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleStatus(it.id)}
                            className="w-full"
                          >
                            {st === "translated" ? "Přeloženo" : "Potvrdit"}
                          </Button>
                        </TableCell>
                        <TableCell className="align-top">
                          <a
                            href={it.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-muted-foreground hover:text-primary inline-flex items-center"
                            title="Otevřít v Notion"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Index;

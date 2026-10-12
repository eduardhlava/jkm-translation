import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SectionSwitcher, { useSectionAccent } from "@/components/SectionSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, GitMerge, Loader2, LogOut, Pencil, Plus, Settings as SettingsIcon, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import jkLogo from "@/assets/jk-machinery-logo.png";
import { callFilterOptions, type FilterOption, type FilterOptionsData } from "@/lib/filterOptions";

type Prop = "stroj" | "typ";
const LABELS: Record<Prop, string> = { stroj: "Stroj", typ: "Typ" };

function validate(name: string, list: FilterOption[], exceptId?: string): string | null {
  if (!name) return "Název nesmí být prázdný.";
  if (name.includes(",")) return "Název nesmí obsahovat čárku.";
  if (list.some((o) => o.id !== exceptId && o.name.toLowerCase() === name.toLowerCase()))
    return "Položka s tímto názvem už existuje.";
  return null;
}

const FilterManager = () => {
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const sectionAccent = useSectionAccent();
  const [data, setData] = useState<FilterOptionsData>({ typ: [], stroj: [] });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState<{ prop: Prop; item?: FilterOption } | null>(null);
  const [name, setName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ prop: Prop; item: FilterOption } | null>(null);
  const [mergeSource, setMergeSource] = useState<{ prop: Prop; item: FilterOption } | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");

  const souboru = (n: number) => (n === 1 ? "1 soubor" : n >= 2 && n <= 4 ? `${n} soubory` : `${n} souborů`);

  const runAction = async (body: Record<string, unknown>, success: string) => {
    setSaving(true);
    try {
      setData(await callFilterOptions(body));
      toast({ title: success });
      return true;
    } catch (e) {
      toast({ title: "Chyba", description: (e as Error).message, variant: "destructive" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await callFilterOptions({ action: "list" }));
    } catch (e) {
      toast({ title: "Chyba načítání", description: (e as Error).message, variant: "destructive" });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const error = editor ? validate(name.trim(), data[editor.prop], editor.item?.id) : null;

  const save = async () => {
    if (!editor || error) return;
    setSaving(true);
    try {
      const res = await callFilterOptions(
        editor.item
          ? { action: "rename", property: editor.prop, id: editor.item.id, name: name.trim() }
          : { action: "add", property: editor.prop, name: name.trim() },
      );
      setData(res);
      toast({ title: editor.item ? "Položka přejmenována" : "Položka přidána" });
      setEditor(null);
    } catch (e) {
      toast({ title: "Chyba", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const section = (prop: Prop) => {
    const list = [...data[prop]].sort((a, b) => a.name.localeCompare(b.name, "cs"));
    return (
      <Card className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">{LABELS[prop]}</h2>
          <Button
            size="sm"
            className="ml-auto"
            onClick={() => {
              setEditor({ prop });
              setName("");
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Přidat položku
          </Button>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Načítám…
          </div>
        ) : list.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Zatím žádné položky.</p>
        ) : (
          <ul className="divide-y rounded border">
            {list.map((o) => (
              <li key={o.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                <span className="truncate">{o.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{souboru(o.count ?? 0)}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => {
                    setEditor({ prop, item: o });
                    setName(o.name);
                  }}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Upravit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={list.length < 2}
                  onClick={() => {
                    setMergeSource({ prop, item: o });
                    setMergeTargetId("");
                  }}
                >
                  <GitMerge className="mr-1 h-3.5 w-3.5" /> Sloučit do…
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Smazat položku"
                        disabled={(o.count ?? 0) > 0}
                        onClick={() => setDeleteTarget({ prop, item: o })}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {(o.count ?? 0) > 0
                      ? `Položku používá ${souboru(o.count ?? 0)} – nejdřív je přeřaďte nebo použijte Sloučit do…`
                      : "Smazat položku"}
                  </TooltipContent>
                </Tooltip>
              </li>
            ))}
          </ul>
        )}
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-[3px] bg-card" style={{ borderBottomColor: sectionAccent }}>
        <div className="container max-w-[105rem] flex flex-wrap items-center gap-4 py-4">
          <div className="flex items-center gap-3 flex-1">
            <Link to="/">
              <img src={jkLogo} alt="JK Machinery" className="h-9 w-auto" />
            </Link>
            <div className="h-8 w-px bg-border" />
            <div>
              <h1 className="font-semibold leading-tight">Content system</h1>
            </div>
          </div>
          <div className="hidden md:flex items-end justify-center self-stretch">
            <SectionSwitcher showCreator={isAdmin} />
          </div>
          <div className="flex items-center gap-3 justify-end flex-1">
            {(profile?.full_name?.trim() || profile?.email) && (
              <div className="text-sm text-right leading-tight hidden sm:block">
                {profile?.full_name?.trim() && <div className="font-medium">{profile.full_name}</div>}
                <div className="text-xs text-muted-foreground">{profile?.email}</div>
              </div>
            )}
            {isAdmin && (
              <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                <Link to="/settings" aria-label="Nastavení">
                  <SettingsIcon className="w-4 h-4" />
                  <span className="sr-only">Nastavení</span>
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate("/auth", { replace: true });
              }}
            >
              <LogOut className="w-4 h-4 mr-1" /> Odhlásit
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-[105rem] space-y-4 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/library">
              <ArrowLeft className="mr-1 h-4 w-4" /> Zpět
            </Link>
          </Button>
          <h1 className="text-xl font-semibold">Správa filtrů</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {section("stroj")}
          {section("typ")}
        </div>
        <p className="text-xs text-muted-foreground">Změny se ukládají přímo do Notion.</p>
      </main>

      <Dialog open={!!editor} onOpenChange={(o) => !o && setEditor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editor?.item ? "Upravit položku" : "Přidat položku"} – {editor ? LABELS[editor.prop] : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            {name.trim() && error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor(null)}>
              Zrušit
            </Button>
            <Button disabled={saving || !!error || (editor?.item?.name === name.trim())} onClick={save}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Uložit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Smazat položku „{deleteTarget?.item.name}“?</AlertDialogTitle>
            <AlertDialogDescription>
              Položka bude odstraněna ze seznamu {deleteTarget ? LABELS[deleteTarget.prop] : ""} v Notion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                const ok = await runAction(
                  { action: "delete", property: deleteTarget!.prop, id: deleteTarget!.item.id },
                  "Položka smazána",
                );
                if (ok) setDeleteTarget(null);
              }}
            >
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!mergeSource} onOpenChange={(o) => !o && setMergeSource(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sloučit „{mergeSource?.item.name}“ do…</AlertDialogTitle>
          </AlertDialogHeader>
          {mergeSource && (
            <div className="space-y-3">
              <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte cílovou položku" />
                </SelectTrigger>
                <SelectContent>
                  {[...data[mergeSource.prop]]
                    .filter((x) => x.id !== mergeSource.item.id)
                    .sort((a, b) => a.name.localeCompare(b.name, "cs"))
                    .map((x) => (
                      <SelectItem key={x.id} value={x.id}>
                        {x.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {mergeTargetId && (
                <p className="text-sm text-muted-foreground">
                  Hodnota „{mergeSource.item.name}“ bude u {souboru(mergeSource.item.count ?? 0)} nahrazena
                  hodnotou „{data[mergeSource.prop].find((x) => x.id === mergeTargetId)?.name}“ a „{mergeSource.item.name}“ bude odstraněna.
                </p>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving || !mergeTargetId}
              onClick={async (e) => {
                e.preventDefault();
                const ok = await runAction(
                  {
                    action: "merge",
                    property: mergeSource!.prop,
                    sourceId: mergeSource!.item.id,
                    targetId: mergeTargetId,
                  },
                  "Položky sloučeny",
                );
                if (ok) setMergeSource(null);
              }}
            >
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Sloučit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FilterManager;

import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SectionSwitcher, { useSectionAccent } from "@/components/SectionSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Archive, ArchiveRestore, ArrowLeft, Loader2, LogOut, Pencil, RefreshCw, Replace, Search, Settings as SettingsIcon, Trash2, Upload } from "lucide-react";
import jkLogo from "@/assets/jk-machinery-logo.png";
import { SYMBOL_BUCKET, useSymbols, type SymbolRow } from "@/lib/symbols/symbolStore";
import { DEFAULT_SYMBOL_WIDTH_MM, MAX_SYMBOL_MM, MIN_SYMBOL_MM, slugifySymbolName, uniqueSymbolCode } from "@/lib/symbols/symbolTokens";
import SymbolThumb from "@/components/symbols/SymbolThumb";

const RENDITION_MAX_PX = 1200;
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const isSvg = (f: File) => f.type === "image/svg+xml" || /\.svg$/i.test(f.name);
const isAccepted = (f: File) => isSvg(f) || f.type === "image/png" || /\.png$/i.test(f.name);
const baseName = (n: string) => n.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim();

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Soubor nelze načíst jako obrázek.")); };
    img.src = url;
  });
}

/** Zmenšená PNG verze (delší strana max. 1200 px), originál zůstává beze změny. */
async function makeRendition(file: File): Promise<{ blob: Blob; w: number; h: number }> {
  const img = await loadImage(file);
  let w = img.naturalWidth || RENDITION_MAX_PX;
  let h = img.naturalHeight || RENDITION_MAX_PX;
  const scale = isSvg(file) ? RENDITION_MAX_PX / Math.max(w, h) : Math.min(1, RENDITION_MAX_PX / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Prohlížeč neumí zpracovat obrázek.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, cw, ch);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("Zmenšení obrázku selhalo.");
  if (isSvg(file)) { w = cw; h = ch; }
  return { blob, w, h };
}

async function uploadFiles(code: string, file: File) {
  const stamp = Date.now();
  const ext = isSvg(file) ? "svg" : "png";
  const original = `originals/${code}-${stamp}.${ext}`;
  const render = `renders/${code}-${stamp}.png`;
  const r = await makeRendition(file);
  const up1 = await supabase.storage.from(SYMBOL_BUCKET).upload(original, file, { contentType: isSvg(file) ? "image/svg+xml" : "image/png", upsert: false });
  if (up1.error) throw up1.error;
  const up2 = await supabase.storage.from(SYMBOL_BUCKET).upload(render, r.blob, { contentType: "image/png", upsert: false });
  if (up2.error) throw up2.error;
  return { file_path: original, render_path: render, width_px: r.w, height_px: r.h };
}

async function usageOf(code: string): Promise<number> {
  const { data, error } = await supabase.rpc("symbol_usage", { _code: code });
  if (error) throw error;
  return Number(data ?? 0);
}

const czDocs = (n: number) => (n === 1 ? "1 dokumentu" : `${n} dokumentech`);

export default function SymbolManager() {
  const { profile, isAdmin, user } = useAuth() as any;
  const navigate = useNavigate();
  const sectionAccent = useSectionAccent();
  const { list, loaded, reload } = useSymbols();
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; failed: string[] } | null>(null);
  const [edit, setEdit] = useState<SymbolRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editWidth, setEditWidth] = useState("20");
  const [replace, setReplace] = useState<{ row: SymbolRow; file: File; usage: number } | null>(null);
  const [del, setDel] = useState<{ row: SymbolRow; usage: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<SymbolRow | null>(null);

  const shown = useMemo(() => list
    .filter((r) => showArchived || !r.archived)
    .filter((r) => !q.trim() || norm(r.name).includes(norm(q.trim()))), [list, q, showArchived]);

  const bulkUpload = async (files: File[]) => {
    const ok = files.filter(isAccepted);
    const skipped = files.filter((f) => !isAccepted(f)).map((f) => f.name);
    if (!ok.length) { toast({ title: "Žádný vhodný soubor", description: "Nahrát lze jen PNG a SVG.", variant: "destructive" }); return; }
    const taken = new Set(list.map((r) => r.code));
    const jobs = ok.map((file) => {
      const name = baseName(file.name) || "Piktogram";
      const code = uniqueSymbolCode(slugifySymbolName(name), taken);
      taken.add(code);
      return { file, name, code };
    });
    const failed: string[] = [...skipped];
    let done = 0;
    setProgress({ done: 0, total: jobs.length, failed });
    const queue = [...jobs];
    const worker = async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        try {
          const paths = await uploadFiles(job.code, job.file);
          const { error } = await supabase.from("symbols").insert({ code: job.code, name: job.name, default_width_mm: DEFAULT_SYMBOL_WIDTH_MM, updated_by: user?.id ?? null, ...paths });
          if (error) throw error;
        } catch (e) {
          console.error("[symbols] upload failed", job.file.name, e);
          failed.push(job.file.name);
        }
        done++;
        setProgress({ done, total: jobs.length, failed: [...failed] });
      }
    };
    await Promise.all([worker(), worker()]);
    await reload().catch(() => undefined);
    toast({
      title: `Nahráno ${jobs.length - (failed.length - skipped.length)} z ${jobs.length} piktogramů`,
      description: failed.length ? `Nepodařilo se: ${failed.slice(0, 5).join(", ")}${failed.length > 5 ? "…" : ""}` : undefined,
      variant: failed.length ? "destructive" : undefined,
    });
    setTimeout(() => setProgress(null), 1500);
  };

  const saveEdit = async () => {
    if (!edit) return;
    const name = editName.trim();
    const w = Number(editWidth.replace(",", "."));
    if (!name) { toast({ title: "Název nesmí být prázdný.", variant: "destructive" }); return; }
    if (!Number.isFinite(w) || w < MIN_SYMBOL_MM || w > MAX_SYMBOL_MM) { toast({ title: `Šířka musí být ${MIN_SYMBOL_MM}–${MAX_SYMBOL_MM} mm.`, variant: "destructive" }); return; }
    setBusy(true);
    const { error } = await supabase.from("symbols").update({ name, default_width_mm: w, updated_by: user?.id ?? null }).eq("id", edit.id);
    setBusy(false);
    if (error) { toast({ title: "Uložení selhalo", description: error.message, variant: "destructive" }); return; }
    setEdit(null);
    await reload();
  };

  const startReplace = async (row: SymbolRow, file: File) => {
    if (!isAccepted(file)) { toast({ title: "Nahrát lze jen PNG a SVG.", variant: "destructive" }); return; }
    try { setReplace({ row, file, usage: await usageOf(row.code) }); }
    catch (e: any) { toast({ title: "Nelze zjistit použití", description: e?.message, variant: "destructive" }); }
  };

  const doReplace = async () => {
    if (!replace) return;
    setBusy(true);
    try {
      const paths = await uploadFiles(replace.row.code, replace.file);
      const { error } = await supabase.from("symbols").update({ ...paths, updated_by: user?.id ?? null }).eq("id", replace.row.id);
      if (error) throw error;
      const old = [replace.row.file_path, replace.row.render_path].filter(Boolean) as string[];
      if (old.length) await supabase.storage.from(SYMBOL_BUCKET).remove(old);
      toast({ title: "Soubor nahrazen", description: "Dokumenty piktogram zobrazí v nové podobě." });
      setReplace(null);
      await reload();
    } catch (e: any) {
      toast({ title: "Nahrazení selhalo", description: e?.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  const toggleArchive = async (row: SymbolRow) => {
    const { error } = await supabase.from("symbols").update({ archived: !row.archived, updated_by: user?.id ?? null }).eq("id", row.id);
    if (error) { toast({ title: "Změna selhala", description: error.message, variant: "destructive" }); return; }
    toast({ title: row.archived ? "Piktogram obnoven" : "Piktogram archivován", description: row.archived ? undefined : "Nelze ho nově vkládat, v dokumentech se ale dál zobrazuje." });
    await reload();
  };

  const startDelete = async (row: SymbolRow) => {
    try { setDel({ row, usage: await usageOf(row.code) }); }
    catch (e: any) { toast({ title: "Nelze zjistit použití", description: e?.message, variant: "destructive" }); }
  };

  const doDelete = async () => {
    if (!del || del.usage > 0) return;
    setBusy(true);
    const { error } = await supabase.from("symbols").delete().eq("id", del.row.id);
    if (!error) await supabase.storage.from(SYMBOL_BUCKET).remove([del.row.file_path, del.row.render_path].filter(Boolean) as string[]);
    setBusy(false);
    if (error) { toast({ title: "Smazání selhalo", description: error.message, variant: "destructive" }); return; }
    setDel(null);
    await reload();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-[3px] bg-card" style={{ borderBottomColor: sectionAccent }}>
        <div className="container max-w-[105rem] flex flex-wrap items-center gap-4 py-4">
          <div className="flex items-center gap-3 flex-1">
            <Link to="/"><img src={jkLogo} alt="JK Machinery" className="h-9 w-auto" /></Link>
            <div className="h-8 w-px bg-border" />
            <h1 className="font-semibold leading-tight">Content system</h1>
          </div>
          <div className="hidden md:flex items-end justify-center self-stretch"><SectionSwitcher showCreator={isAdmin} /></div>
          <div className="flex items-center gap-3 justify-end flex-1">
            {(profile?.full_name?.trim() || profile?.email) && (
              <div className="text-sm text-right leading-tight hidden sm:block">
                {profile?.full_name?.trim() && <div className="font-medium">{profile.full_name}</div>}
                <div className="text-xs text-muted-foreground">{profile?.email}</div>
              </div>
            )}
            {isAdmin && (
              <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                <Link to="/settings" aria-label="Nastavení"><SettingsIcon className="w-4 h-4" /></Link>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={async () => { await supabase.auth.signOut(); navigate("/auth", { replace: true }); }}>
              <LogOut className="w-4 h-4 mr-1" /> Odhlásit
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-[105rem] space-y-4 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" asChild><Link to="/library"><ArrowLeft className="w-4 h-4 mr-1" /> Soubory</Link></Button>
          <h2 className="text-xl font-semibold">Piktogramy</h2>
          <div className="relative ml-auto w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hledat podle názvu…" className="pl-8" />
          </div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={showArchived} onCheckedChange={setShowArchived} /> Zobrazit archivované</label>
          <Button variant="outline" size="icon" onClick={() => void reload()} aria-label="Obnovit"><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={() => uploadRef.current?.click()} disabled={!!progress && progress.done < progress.total}>
            <Upload className="w-4 h-4 mr-1" /> Nahrát piktogramy
          </Button>
          <input ref={uploadRef} type="file" accept=".png,.svg,image/png,image/svg+xml" multiple className="hidden" onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; if (f.length) void bulkUpload(f); }} />
          <input ref={replaceRef} type="file" accept=".png,.svg,image/png,image/svg+xml" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f && replaceTarget.current) void startReplace(replaceTarget.current, f); }} />
        </div>

        {progress && (
          <Card className="space-y-2 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">{progress.done < progress.total && <Loader2 className="h-4 w-4 animate-spin" />}Nahrávám {progress.done} / {progress.total}</span>
              {progress.failed.length > 0 && <span className="text-destructive">Chyby: {progress.failed.length}</span>}
            </div>
            <Progress value={(progress.done / Math.max(1, progress.total)) * 100} />
          </Card>
        )}

        {!loaded ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : shown.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">{list.length ? "Nic nenalezeno" : "Knihovna je prázdná. Nahrajte první piktogramy (PNG nebo SVG, lze vybrat více souborů najednou)."}</Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {shown.map((r) => (
              <Card key={r.id} className={`group flex flex-col gap-2 p-3 ${r.archived ? "opacity-60" : ""}`}>
                <div className="flex h-28 items-center justify-center rounded bg-muted/40"><SymbolThumb code={r.code} width={96} /></div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium" title={r.name}>{r.name}</div>
                  <div className="text-xs text-muted-foreground">{Number(r.default_width_mm)} mm · {r.width_px}×{r.height_px} px{r.archived ? " · archivováno" : ""}</div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Upravit" aria-label="Upravit" onClick={() => { setEdit(r); setEditName(r.name); setEditWidth(String(r.default_width_mm)); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Nahradit soubor" aria-label="Nahradit soubor" onClick={() => { replaceTarget.current = r; replaceRef.current?.click(); }}><Replace className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" title={r.archived ? "Obnovit" : "Archivovat"} aria-label={r.archived ? "Obnovit" : "Archivovat"} onClick={() => void toggleArchive(r)}>{r.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}</Button>
                  <Button size="icon" variant="ghost" className="ml-auto h-7 w-7 text-destructive" title="Smazat" aria-label="Smazat" onClick={() => void startDelete(r)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upravit piktogram</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Název</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
            <div className="space-y-1"><Label>Výchozí šířka (mm)</Label><Input type="number" min={MIN_SYMBOL_MM} max={MAX_SYMBOL_MM} step="0.5" value={editWidth} onChange={(e) => setEditWidth(e.target.value)} /></div>
            {edit && <p className="text-xs text-muted-foreground">Kód pro odkazy: <code>{edit.code}</code> (nemění se)</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Zrušit</Button>
            <Button onClick={() => void saveEdit()} disabled={busy}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Uložit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!replace} onOpenChange={(o) => !o && !busy && setReplace(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nahradit soubor?</AlertDialogTitle>
            <AlertDialogDescription>
              Piktogram „{replace?.row.name}“ je použit v {czDocs(replace?.usage ?? 0)}. Po nahrazení se ve všech dokumentech zobrazí nový obrázek ({replace?.file.name}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void doReplace(); }} disabled={busy}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Nahradit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!del} onOpenChange={(o) => !o && !busy && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{del && del.usage > 0 ? "Piktogram nelze smazat" : "Smazat piktogram?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {del && del.usage > 0
                ? `Piktogram „${del.row.name}“ je použit v ${czDocs(del.usage)}. Místo smazání ho můžete archivovat – nepůjde nově vkládat, ale v dokumentech zůstane.`
                : `Piktogram „${del?.row.name}“ se nikde nepoužívá a bude trvale smazán.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{del && del.usage > 0 ? "Zavřít" : "Zrušit"}</AlertDialogCancel>
            {del && del.usage === 0 && (
              <AlertDialogAction onClick={(e) => { e.preventDefault(); void doDelete(); }} disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Smazat</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

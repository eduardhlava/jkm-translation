import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";
import { useSymbols, type SymbolRow } from "@/lib/symbols/symbolStore";
import SymbolThumb from "./SymbolThumb";

const RECENT_KEY = "symbols.recent";
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function readRecent(): string[] {
  try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); return Array.isArray(v) ? v.map(String) : []; } catch { return []; }
}
function pushRecent(code: string) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([code, ...readRecent().filter((c) => c !== code)].slice(0, 12))); } catch { /* ignore */ }
}

/** Sdílený výběr piktogramu z knihovny (textové bloky i buňky tabulek). */
export default function SymbolPicker({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (row: SymbolRow) => void }) {
  const { list, loaded } = useSymbols();
  const [q, setQ] = useState("");
  const active = useMemo(() => list.filter((r) => !r.archived), [list]);
  const filtered = useMemo(() => (q.trim() ? active.filter((r) => norm(r.name).includes(norm(q.trim()))) : active), [active, q]);
  const recent = useMemo(() => {
    if (q.trim()) return [];
    const map = new Map(active.map((r) => [r.code, r]));
    return readRecent().map((c) => map.get(c)).filter((r): r is SymbolRow => !!r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, q, open]);

  const pick = (r: SymbolRow) => { pushRecent(r.code); onPick(r); onOpenChange(false); setQ(""); };
  const tile = (r: SymbolRow) => (
    <button key={r.id} type="button" onClick={() => pick(r)} className="flex flex-col items-center gap-1 rounded-md border bg-background p-2 text-center text-xs hover:border-primary hover:bg-muted" title={r.name}>
      <span className="flex h-16 w-full items-center justify-center"><SymbolThumb code={r.code} width={56} /></span>
      <span className="line-clamp-2 w-full break-words">{r.name}</span>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <DialogHeader><DialogTitle>Vložit piktogram</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hledat podle názvu…" className="pl-8" />
        </div>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {!loaded && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
          {loaded && recent.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground">Naposledy použité</h3>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{recent.map(tile)}</div>
            </section>
          )}
          {loaded && (
            <section className="space-y-2">
              {recent.length > 0 && <h3 className="text-xs font-medium text-muted-foreground">Všechny piktogramy</h3>}
              {filtered.length ? <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{filtered.map(tile)}</div> : <p className="py-6 text-center text-sm text-muted-foreground">{active.length ? "Nic nenalezeno" : "Knihovna piktogramů je prázdná."}</p>}
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

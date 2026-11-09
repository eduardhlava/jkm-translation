import { useState } from "react";
import { Shapes, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import SymbolPicker from "./SymbolPicker";
import SymbolThumb from "./SymbolThumb";
import { useSymbols } from "@/lib/symbols/symbolStore";
import { MAX_SYMBOL_MM, MIN_SYMBOL_MM, type SymbolPos, type SymbolRef } from "@/lib/symbols/symbolTokens";

const TEXT_POS_LABELS: Partial<Record<SymbolPos, string>> = { left: "Vlevo s obtékáním", right: "Vpravo s obtékáním", center: "Na střed (samostatně)" };
const CELL_POS_LABELS: Partial<Record<SymbolPos, string>> = { left: "Vlevo od textu", top: "Nad textem", center: "Samostatně na střed" };

/** Náhledová šířka v editoru: 1 mm ≈ 2.2 px (obsah stránky A4 ≈ 175 mm). */
export const editorPx = (mm: number, max = 260) => Math.min(max, Math.max(12, mm * 2.2));

export function InsertSymbolButton({ onInsert, label = "Vložit piktogram", compact }: { onInsert: (s: SymbolRef) => void; label?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="ghost" size={compact ? "sm" : "icon"} aria-label={label} title={label} onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(true)} className={compact ? "h-7 justify-start gap-2 px-2 text-xs" : "h-7 w-7"}>
            <Shapes className="h-4 w-4" />{compact && label}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <SymbolPicker open={open} onOpenChange={setOpen} onPick={(r) => onInsert({ code: r.code, w: Number(r.default_width_mm) || 20, pos: "left" })} />
    </>
  );
}

function SymbolRowControls({ s, labels, onChange, onRemove }: { s: SymbolRef; labels: Partial<Record<SymbolPos, string>>; onChange: (s: SymbolRef) => void; onRemove: () => void }) {
  const { byCode } = useSymbols();
  const row = byCode.get(s.code);
  const [w, setW] = useState(String(s.w));
  const commit = () => {
    const n = Number(w.replace(",", "."));
    if (Number.isFinite(n) && n >= MIN_SYMBOL_MM && n <= MAX_SYMBOL_MM) onChange({ ...s, w: Math.round(n * 10) / 10 });
    else setW(String(s.w));
  };
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-2 py-1 text-xs">
      <SymbolThumb code={s.code} width={24} />
      <span className="max-w-[10rem] truncate" title={row?.name ?? s.code}>{row?.name ?? s.code}{row?.archived ? " (archivováno)" : ""}</span>
      <Input aria-label="Šířka v mm" value={w} onChange={(e) => setW(e.target.value)} onBlur={commit} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") commit(); }} className="h-6 w-14 px-1 text-xs" />
      <span className="text-muted-foreground">mm</span>
      <Select value={s.pos} onValueChange={(v) => onChange({ ...s, pos: v as SymbolPos })}>
        <SelectTrigger className="h-6 w-[150px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{Object.entries(labels).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
      </Select>
      <button type="button" onClick={onRemove} aria-label="Odebrat piktogram" title="Odebrat piktogram" className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}

export function SymbolListEditor({ symbols, onChange, kind }: { symbols: SymbolRef[]; onChange: (s: SymbolRef[]) => void; kind: "text" | "cell" }) {
  if (!symbols.length) return null;
  const labels = kind === "text" ? TEXT_POS_LABELS : CELL_POS_LABELS;
  return (
    <div className="flex flex-wrap gap-1.5">
      {symbols.map((s, i) => (
        <SymbolRowControls
          key={`${s.code}-${i}`}
          s={s}
          labels={labels}
          onChange={(next) => onChange(symbols.map((x, j) => (j === i ? next : x)))}
          onRemove={() => onChange(symbols.filter((_, j) => j !== i))}
        />
      ))}
    </div>
  );
}

/** Náhled umístění v editoru textu: na střed nad textem, vlevo/vpravo vedle. */
export function TextSymbolsLayout({ symbols, children }: { symbols: SymbolRef[]; children: React.ReactNode }) {
  if (!symbols.length) return <>{children}</>;
  const of = (p: SymbolPos) => symbols.filter((s) => s.pos === p);
  const col = (list: SymbolRef[]) => list.length ? <div className="flex shrink-0 flex-col items-center gap-1 pt-1">{list.map((s, i) => <SymbolThumb key={i} code={s.code} width={editorPx(s.w, 180)} />)}</div> : null;
  return (
    <div className="flex-1 space-y-2">
      {of("center").length > 0 && <div className="flex flex-col items-center gap-1">{of("center").map((s, i) => <SymbolThumb key={i} code={s.code} width={editorPx(s.w)} />)}</div>}
      <div className="flex items-start gap-2">{col(of("left"))}<div className="min-w-0 flex-1">{children}</div>{col(of("right"))}</div>
    </div>
  );
}

export function CellSymbolsAbove({ symbols }: { symbols: SymbolRef[] }) {
  const above = symbols.filter((s) => s.pos !== "left");
  if (!above.length) return null;
  const centered = above.some((s) => s.pos === "center");
  return <div className={`flex flex-wrap gap-1 px-1 pt-1 ${centered ? "justify-center" : ""}`}>{above.map((s, i) => <SymbolThumb key={i} code={s.code} width={editorPx(s.w, 120)} />)}</div>;
}

export function CellSymbolsLeft({ symbols }: { symbols: SymbolRef[] }) {
  const lefts = symbols.filter((s) => s.pos === "left");
  if (!lefts.length) return null;
  return <span className="flex shrink-0 items-center gap-1 pl-1">{lefts.map((s, i) => <SymbolThumb key={i} code={s.code} width={editorPx(s.w, 120)} />)}</span>;
}

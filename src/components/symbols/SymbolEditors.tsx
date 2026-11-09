import { useState } from "react";
import { Shapes, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import SymbolPicker from "./SymbolPicker";
import SymbolThumb from "./SymbolThumb";
import { cachedSignedUrl, signedSymbolUrl, useSymbols, type SymbolRow } from "@/lib/symbols/symbolStore";
import { MAX_SYMBOL_MM, MIN_SYMBOL_MM, type SymbolPos, type SymbolRef } from "@/lib/symbols/symbolTokens";

const TEXT_POS_LABELS: Partial<Record<SymbolPos, string>> = { left: "Vlevo s obtékáním", right: "Vpravo s obtékáním", center: "Na střed (samostatně)" };
const CELL_POS_LABELS: Partial<Record<SymbolPos, string>> = { left: "Vlevo od textu", top: "Nad textem", center: "Samostatně na střed" };

/** Náhledová šířka v editoru: 1 mm ≈ 2.2 px (obsah stránky A4 ≈ 175 mm). */
export const editorPx = (mm: number, max = 260) => Math.min(max, Math.max(12, mm * 2.2));

export function InsertSymbolButton({ onInsert, label = "Vložit grafický symbol", compact }: { onInsert: (s: SymbolRef) => void; label?: string; compact?: boolean }) {
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
      <SymbolThumb code={s.code} width={24} maxHeight={24} />
      <span className="max-w-[10rem] truncate" title={row?.name ?? s.code}>{row?.name ?? s.code}{row?.archived ? " (archivováno)" : ""}</span>
      <Input aria-label="Šířka v mm" value={w} onChange={(e) => setW(e.target.value)} onBlur={commit} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") commit(); }} className="h-6 w-14 px-1 text-xs" />
      <span className="text-muted-foreground">mm</span>
      <Select value={s.pos} onValueChange={(v) => onChange({ ...s, pos: v as SymbolPos })}>
        <SelectTrigger className="h-6 w-[150px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{Object.entries(labels).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
      </Select>
      <button type="button" onClick={onRemove} aria-label="Odebrat grafický symbol" title="Odebrat grafický symbol" className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
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

const PLACEHOLDER_SRC = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect x="1" y="1" width="38" height="38" fill="none" stroke="#9ca3af" stroke-dasharray="3 2"/><text x="20" y="24" font-size="9" text-anchor="middle" fill="#6b7280">?</text></svg>');

/** Doplní inline piktogramům v editoru podepsané URL a náhledovou šířku (neukládá se). */
export function hydrateSymbolImgs(root: HTMLElement | null, byCode: Map<string, SymbolRow>) {
  if (!root) return;
  root.querySelectorAll<HTMLImageElement>("img[data-sym]").forEach((img) => {
    const code = img.dataset.sym ?? "";
    const pos = img.dataset.pos ?? "left";
    img.setAttribute("contenteditable", "false");
    img.className = `sym sym-${["left", "right", "center"].includes(pos) ? pos : "left"}${img.classList.contains("sym-selected") ? " sym-selected" : ""}`;
    img.style.width = `${editorPx(Number(img.dataset.w) || 20)}px`;
    const row = byCode.get(code);
    img.title = row ? row.name : `Neznámý grafický symbol: ${code}`;
    if (!row) { if (byCode.size) img.src = PLACEHOLDER_SRC; return; }
    const path = row.render_path || row.file_path;
    const hit = cachedSignedUrl(path);
    if (hit) { if (img.src !== hit) img.src = hit; return; }
    void signedSymbolUrl(path).then((u) => { if (u && img.isConnected) img.src = u; });
  });
}

/** Malá lišta u vybraného inline piktogramu: šířka, umístění, odebrat. */
export function InlineSymbolToolbar({ img, container, onChange, onClose }: { img: HTMLImageElement; container: HTMLElement; onChange: () => void; onClose: () => void }) {
  const [w, setW] = useState(img.dataset.w ?? "20");
  const [pos, setPos] = useState(img.dataset.pos ?? "left");
  const [, force] = useState(0);
  const cr = container.getBoundingClientRect();
  const ir = img.getBoundingClientRect();
  const top = ir.bottom - cr.top + 4;
  const left = Math.max(0, Math.min(ir.left - cr.left, cr.width - 330));
  const apply = (next: { w?: string; pos?: string }) => {
    if (next.w !== undefined) img.dataset.w = next.w;
    if (next.pos !== undefined) { img.dataset.pos = next.pos; setPos(next.pos); }
    onChange();
    force((n) => n + 1);
  };
  const commitW = () => {
    const n = Number(w.replace(",", "."));
    if (Number.isFinite(n) && n >= MIN_SYMBOL_MM && n <= MAX_SYMBOL_MM) apply({ w: String(Math.round(n * 10) / 10) });
    else setW(img.dataset.w ?? "20");
  };
  return (
    <div data-sym-toolbar className="absolute z-20 flex items-center gap-1 rounded-md border bg-popover px-2 py-1 text-xs shadow-md" style={{ top, left }} onMouseDown={(e) => e.stopPropagation()}>
      <Input aria-label="Šířka v mm" value={w} onChange={(e) => setW(e.target.value)} onBlur={commitW} onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") commitW(); if (e.key === "Escape") onClose(); }} className="h-6 w-14 px-1 text-xs" />
      <span className="text-muted-foreground">mm</span>
      {(["left", "right", "center"] as const).map((p) => (
        <Button key={p} type="button" size="sm" variant={pos === p ? "secondary" : "ghost"} className="h-6 px-2 text-xs" onClick={() => apply({ pos: p })}>
          {p === "left" ? "Vlevo" : p === "right" ? "Vpravo" : "Na střed"}
        </Button>
      ))}
      <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs text-destructive" aria-label="Odebrat grafický symbol" title="Odebrat grafický symbol" onClick={() => { img.remove(); onChange(); onClose(); }}>Odebrat grafický symbol</Button>
      <button type="button" onClick={onClose} aria-label="Zavřít" className="rounded p-0.5 text-muted-foreground hover:bg-muted"><X className="h-3.5 w-3.5" /></button>
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

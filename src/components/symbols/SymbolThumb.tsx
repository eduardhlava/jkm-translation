import { useSymbols, useSymbolUrl } from "@/lib/symbols/symbolStore";
import { cn } from "@/lib/utils";

export function symbolThumbDimensions(width: number, ratio: number, maxHeight?: number) {
  const height = width / ratio;
  const scale = maxHeight === undefined ? 1 : Math.min(1, maxHeight / height);
  return { width: width * scale, height: height * scale };
}

/** Náhled piktogramu z knihovny. Neznámý kód → šedý zástupný rámeček. */
export default function SymbolThumb({ code, width, maxHeight, className, title }: { code: string; width: number; maxHeight?: number; className?: string; title?: string }) {
  const { byCode, loaded } = useSymbols();
  const row = byCode.get(code);
  const url = useSymbolUrl(row);
  const ratio = row && row.width_px > 0 && row.height_px > 0 ? row.width_px / row.height_px : 1;
  const dimensions = symbolThumbDimensions(width, ratio, maxHeight);
  if (loaded && !row) {
    return (
      <span
        className={cn("inline-flex items-center justify-center rounded border border-dashed border-muted-foreground/50 bg-muted p-1 text-center text-[10px] leading-tight text-muted-foreground", maxHeight !== undefined && "max-w-full overflow-hidden break-words", className)}
        style={maxHeight === undefined ? { width, minHeight: Math.min(width, 48) } : dimensions}
        title={`Neznámý grafický symbol: ${code}`}
      >
        Neznámý grafický symbol: {code}
      </span>
    );
  }
  return (
    <span className={cn("inline-block shrink-0", maxHeight !== undefined && "max-w-full", className)} style={dimensions} title={title ?? row?.name}>
      {url ? <img src={url} alt={row?.name ?? code} className="h-full w-full object-contain" draggable={false} /> : <span className="block h-full w-full animate-pulse rounded bg-muted" />}
    </span>
  );
}

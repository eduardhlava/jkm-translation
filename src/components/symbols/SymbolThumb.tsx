import { useSymbols, useSymbolUrl } from "@/lib/symbols/symbolStore";
import { cn } from "@/lib/utils";

/** Náhled piktogramu z knihovny. Neznámý kód → šedý zástupný rámeček. */
export default function SymbolThumb({ code, width, className, title }: { code: string; width: number; className?: string; title?: string }) {
  const { byCode, loaded } = useSymbols();
  const row = byCode.get(code);
  const url = useSymbolUrl(row);
  const ratio = row && row.width_px > 0 && row.height_px > 0 ? row.width_px / row.height_px : 1;
  if (loaded && !row) {
    return (
      <span
        className={cn("inline-flex items-center justify-center rounded border border-dashed border-muted-foreground/50 bg-muted p-1 text-center text-[10px] leading-tight text-muted-foreground", className)}
        style={{ width, minHeight: Math.min(width, 48) }}
        title={`Neznámý piktogram: ${code}`}
      >
        Neznámý piktogram: {code}
      </span>
    );
  }
  return (
    <span className={cn("inline-block shrink-0", className)} style={{ width, height: width / ratio }} title={title ?? row?.name}>
      {url ? <img src={url} alt={row?.name ?? code} className="h-full w-full object-contain" draggable={false} /> : <span className="block h-full w-full animate-pulse rounded bg-muted" />}
    </span>
  );
}

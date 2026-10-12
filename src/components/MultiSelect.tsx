import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Props {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function MultiSelect({ options, value, onChange, placeholder = "—", disabled, className }: Props) {
  const [open, setOpen] = useState(false);
  const all = Array.from(new Set([...options, ...value]));
  const toggle = (o: string) =>
    onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o]);

  return (
    <Popover open={open} onOpenChange={(v) => !disabled && setOpen(v)}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn("h-auto min-h-10 w-full justify-between px-3 py-1.5 font-normal", className)}
        >
          <div className="flex min-w-0 flex-1 flex-wrap gap-1">
            {value.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              value.map((v) => (
                <Badge key={v} variant="secondary" className="gap-1 pr-1 font-normal">
                  {v}
                  <span
                    role="button"
                    aria-label={`Odebrat ${v}`}
                    className="rounded hover:bg-muted-foreground/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(v);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </span>
                </Badge>
              ))
            )}
          </div>
          <ChevronDown className="ml-1 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-48 p-0" align="start">
        <div className="max-h-64 overflow-auto p-1">
          {all.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Žádné položky</div>}
          {all.map((o) => (
            <label key={o} className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted">
              <Checkbox checked={value.includes(o)} onCheckedChange={() => toggle(o)} />
              <span className="truncate">{o}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-between border-t p-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange([])} disabled={value.length === 0}>
            Zrušit výběr
          </Button>
          <Button type="button" size="sm" onClick={() => setOpen(false)}>
            Hotovo
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

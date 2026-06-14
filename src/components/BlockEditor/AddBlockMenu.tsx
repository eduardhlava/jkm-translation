import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Heading1, Heading2, Heading3, Heading4, Type, Table as TableIcon, Image as ImageIcon, AlertTriangle, Info, AlertCircle, SeparatorHorizontal } from "lucide-react";
import { BLOCK_TYPE_LABELS, type BlockType } from "./types";

const ICONS: Record<BlockType, React.ComponentType<{ className?: string }>> = {
  heading1: Heading1,
  heading2: Heading2,
  heading3: Heading3,
  heading4: Heading4,
  text: Type,
  table: TableIcon,
  image: ImageIcon,
  alert: AlertTriangle,
  info: Info,
  warning: AlertCircle,
  pagebreak: SeparatorHorizontal,
};

const ORDER: BlockType[] = [
  "heading1", "heading2", "heading3", "heading4",
  "text", "table", "image",
  "alert", "info", "warning",
  "pagebreak",
];

interface Props {
  onAdd: (type: BlockType) => void;
  variant?: "default" | "ghost";
  label?: string;
}

export default function AddBlockMenu({ onAdd, variant = "default", label = "Přidat blok" }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={variant} size="sm">
          <Plus className="w-4 h-4 mr-1" /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="grid grid-cols-2 gap-1">
          {ORDER.map((t) => {
            const Icon = ICONS[t];
            return (
              <button
                key={t}
                onClick={(e) => {
                  onAdd(t);
                  // Close popover by clicking outside
                  (e.currentTarget.closest("[data-radix-popper-content-wrapper]") as HTMLElement | null)?.dispatchEvent(
                    new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
                  );
                }}
                className="flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
              >
                <Icon className="w-4 h-4 text-muted-foreground" />
                <span>{BLOCK_TYPE_LABELS[t]}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

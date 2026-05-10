import { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Minus,
  Image as ImageIcon,
  Table as TableIcon,
  Link as LinkIcon,
  Undo,
  Redo,
  Palette,
  Rows,
  Columns,
  Trash2,
  Plus,
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
} from "lucide-react";

interface Props {
  editor: Editor | null;
}

const COLORS = [
  "#000000", "#374151", "#6B7280", "#9CA3AF",
  "#EF4444", "#F97316", "#F59E0B", "#EAB308",
  "#22C55E", "#10B981", "#14B8A6", "#06B6D4",
  "#3B82F6", "#6366F1", "#8B5CF6", "#EC4899",
];

const EditorToolbar = ({ editor }: Props) => {
  if (!editor) return null;

  // Prevent toolbar buttons from stealing focus from the editor
  const stop = (e: React.MouseEvent) => e.preventDefault();

  const btn = (active: boolean) =>
    `h-8 w-8 ${active ? "bg-accent text-accent-foreground" : ""}`;

  const run = (fn: () => void) => fn();

  const addImage = () => {
    const url = window.prompt("URL obrázku:");
    if (url) (editor.chain() as any).focus().setImage({ src: url }).run();
  };
  const setImageWidth = (pct: number) => {
    const { state } = editor;
    const { from } = state.selection;
    const node = state.doc.nodeAt(from) || state.doc.nodeAt(Math.max(0, from - 1));
    if (!node || node.type.name !== "image") {
      // Try to find by selection - fallback: ask which image (use prompt)
      // Apply as inline style to currently selected image via updateAttributes
    }
    (editor.chain() as any).focus().updateAttributes("image", { width: `${pct}%`, height: "auto" }).run();
  };
  const addLink = () => {
    const prev = editor.getAttributes("link").href;
    const url = window.prompt("URL odkazu:", prev ?? "https://");
    if (url === null) return;
    if (url === "") (editor.chain() as any).focus().extendMarkRange("link").unsetLink().run();
    else (editor.chain() as any).focus().extendMarkRange("link").setLink({ href: url, target: "_blank" }).run();
  };
  const insertTable = () =>
    (editor.chain() as any).focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();

  const inTable = editor.isActive("table");

  return (
    <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 p-2">
      <Button variant="ghost" size="icon" className={btn(editor.isActive("bold"))} onMouseDown={stop} onClick={() => run(() => (editor.chain() as any).focus().toggleBold().run())}><Bold className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" className={btn(editor.isActive("italic"))} onMouseDown={stop} onClick={() => (editor.chain() as any).focus().toggleItalic().run()}><Italic className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" className={btn(editor.isActive("strike"))} onMouseDown={stop} onClick={() => (editor.chain() as any).focus().toggleStrike().run()}><Strikethrough className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" className={btn(editor.isActive("code"))} onMouseDown={stop} onClick={() => (editor.chain() as any).focus().toggleCode().run()}><Code className="w-4 h-4" /></Button>

      {/* Color picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onMouseDown={stop} title="Barva písma">
            <Palette className="w-4 h-4" style={{ color: editor.getAttributes("textStyle").color || undefined }} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start" onMouseDown={stop}>
          <div className="grid grid-cols-8 gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onMouseDown={stop}
                onClick={() => (editor.chain() as any).focus().setColor(c).run()}
                className="h-6 w-6 rounded border border-border hover:scale-110 transition-transform"
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="color"
              onMouseDown={stop}
              onChange={(e) => (editor.chain() as any).focus().setColor(e.target.value).run()}
              className="h-7 w-10 cursor-pointer rounded border border-border bg-transparent"
            />
            <Button variant="ghost" size="sm" onMouseDown={stop} onClick={() => (editor.chain() as any).focus().unsetColor().run()}>
              Reset
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <div className="h-5 w-px bg-border mx-1" />
      <Button variant="ghost" size="icon" className={btn(editor.isActive("heading", { level: 1 }))} onMouseDown={stop} onClick={() => (editor.chain() as any).focus().toggleHeading({ level: 1 }).run()}><Heading1 className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" className={btn(editor.isActive("heading", { level: 2 }))} onMouseDown={stop} onClick={() => (editor.chain() as any).focus().toggleHeading({ level: 2 }).run()}><Heading2 className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" className={btn(editor.isActive("heading", { level: 3 }))} onMouseDown={stop} onClick={() => (editor.chain() as any).focus().toggleHeading({ level: 3 }).run()}><Heading3 className="w-4 h-4" /></Button>

      <div className="h-5 w-px bg-border mx-1" />
      <Button variant="ghost" size="icon" className={btn(editor.isActive("bulletList"))} onMouseDown={stop} onClick={() => (editor.chain() as any).focus().toggleBulletList().run()}><List className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" className={btn(editor.isActive("orderedList"))} onMouseDown={stop} onClick={() => (editor.chain() as any).focus().toggleOrderedList().run()}><ListOrdered className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" className={btn(editor.isActive("blockquote"))} onMouseDown={stop} onClick={() => (editor.chain() as any).focus().toggleBlockquote().run()}><Quote className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" onMouseDown={stop} onClick={() => (editor.chain() as any).focus().setHorizontalRule().run()}><Minus className="w-4 h-4" /></Button>

      <div className="h-5 w-px bg-border mx-1" />
      <Button variant="ghost" size="icon" className={btn(editor.isActive("link"))} onMouseDown={stop} onClick={addLink}><LinkIcon className="w-4 h-4" /></Button>

      {/* Image group */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onMouseDown={stop} title="Obrázek">
            <ImageIcon className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2 space-y-2" align="start" onMouseDown={stop}>
          <Button variant="outline" size="sm" className="w-full justify-start" onMouseDown={stop} onClick={addImage}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Vložit z URL
          </Button>
          <div className="text-xs text-muted-foreground pt-1">Šířka vybraného obrázku:</div>
          <div className="flex gap-1">
            {[25, 50, 75, 100].map((p) => (
              <Button key={p} variant="outline" size="sm" onMouseDown={stop} onClick={() => setImageWidth(p)}>
                {p}%
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground">px:</span>
            <input
              type="number"
              min={50}
              max={2000}
              placeholder="600"
              onMouseDown={stop}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const v = (e.target as HTMLInputElement).value;
                  if (v) (editor.chain() as any).focus().updateAttributes("image", { width: `${v}px`, height: "auto" }).run();
                }
              }}
              className="h-7 w-20 rounded border border-input bg-background px-2 text-xs"
            />
          </div>
        </PopoverContent>
      </Popover>

      {/* Table group */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className={btn(inTable)} onMouseDown={stop} title="Tabulka">
            <TableIcon className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2 space-y-1" align="start" onMouseDown={stop}>
          <Button variant="ghost" size="sm" className="w-full justify-start" onMouseDown={stop} onClick={insertTable} disabled={inTable}>
            <Plus className="w-3.5 h-3.5 mr-2" /> Vložit tabulku 3×3
          </Button>
          <div className="my-1 h-px bg-border" />
          <div className="text-xs font-medium text-muted-foreground px-2 pt-1">Řádky</div>
          <Button variant="ghost" size="sm" className="w-full justify-start" disabled={!inTable} onMouseDown={stop} onClick={() => (editor.chain() as any).focus().addRowBefore().run()}>
            <ArrowUpToLine className="w-3.5 h-3.5 mr-2" /> Přidat nad
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start" disabled={!inTable} onMouseDown={stop} onClick={() => (editor.chain() as any).focus().addRowAfter().run()}>
            <ArrowDownToLine className="w-3.5 h-3.5 mr-2" /> Přidat pod
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start" disabled={!inTable} onMouseDown={stop} onClick={() => (editor.chain() as any).focus().deleteRow().run()}>
            <Rows className="w-3.5 h-3.5 mr-2" /> Smazat řádek
          </Button>
          <div className="text-xs font-medium text-muted-foreground px-2 pt-1">Sloupce</div>
          <Button variant="ghost" size="sm" className="w-full justify-start" disabled={!inTable} onMouseDown={stop} onClick={() => (editor.chain() as any).focus().addColumnBefore().run()}>
            <ArrowLeftToLine className="w-3.5 h-3.5 mr-2" /> Přidat vlevo
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start" disabled={!inTable} onMouseDown={stop} onClick={() => (editor.chain() as any).focus().addColumnAfter().run()}>
            <ArrowRightToLine className="w-3.5 h-3.5 mr-2" /> Přidat vpravo
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start" disabled={!inTable} onMouseDown={stop} onClick={() => (editor.chain() as any).focus().deleteColumn().run()}>
            <Columns className="w-3.5 h-3.5 mr-2" /> Smazat sloupec
          </Button>
          <div className="my-1 h-px bg-border" />
          <Button variant="ghost" size="sm" className="w-full justify-start" disabled={!inTable} onMouseDown={stop} onClick={() => (editor.chain() as any).focus().toggleHeaderRow().run()}>
            Přepnout hlavičku
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start" disabled={!inTable} onMouseDown={stop} onClick={() => (editor.chain() as any).focus().mergeOrSplit().run()}>
            Sloučit / rozdělit buňky
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start text-destructive" disabled={!inTable} onMouseDown={stop} onClick={() => (editor.chain() as any).focus().deleteTable().run()}>
            <Trash2 className="w-3.5 h-3.5 mr-2" /> Smazat tabulku
          </Button>
        </PopoverContent>
      </Popover>

      <div className="h-5 w-px bg-border mx-1" />
      <Button variant="ghost" size="icon" onMouseDown={stop} onClick={() => (editor.chain() as any).focus().undo().run()}><Undo className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" onMouseDown={stop} onClick={() => (editor.chain() as any).focus().redo().run()}><Redo className="w-4 h-4" /></Button>
    </div>
  );
};

export default EditorToolbar;

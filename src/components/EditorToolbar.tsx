import { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";

interface Props {
  editor: Editor | null;
}

const EditorToolbar = ({ editor }: Props) => {
  if (!editor) return null;
  const btn = (active: boolean) =>
    `h-8 w-8 ${active ? "bg-accent text-accent-foreground" : ""}`;

  const addImage = () => {
    const url = window.prompt("URL obrázku:");
    if (url) (editor.chain() as any).focus().setImage({ src: url }).run();
  };
  const addLink = () => {
    const prev = editor.getAttributes("link").href;
    const url = window.prompt("URL odkazu:", prev ?? "https://");
    if (url === null) return;
    if (url === "") (editor.chain() as any).focus().extendMarkRange("link").unsetLink().run();
    else (editor.chain() as any).focus().extendMarkRange("link").setLink({ href: url, target: "_blank" }).run();
  };
  const addTable = () =>
    (editor.chain() as any).focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();

  return (
    <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 p-2">
      <Button variant="ghost" size="icon" className={btn(editor.isActive("bold"))} onClick={() => (editor.chain() as any).focus().toggleBold().run()}><Bold className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" className={btn(editor.isActive("italic"))} onClick={() => (editor.chain() as any).focus().toggleItalic().run()}><Italic className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" className={btn(editor.isActive("strike"))} onClick={() => (editor.chain() as any).focus().toggleStrike().run()}><Strikethrough className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" className={btn(editor.isActive("code"))} onClick={() => (editor.chain() as any).focus().toggleCode().run()}><Code className="w-4 h-4" /></Button>
      <div className="h-5 w-px bg-border mx-1" />
      <Button variant="ghost" size="icon" className={btn(editor.isActive("heading", { level: 1 }))} onClick={() => (editor.chain() as any).focus().toggleHeading({ level: 1 }).run()}><Heading1 className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" className={btn(editor.isActive("heading", { level: 2 }))} onClick={() => (editor.chain() as any).focus().toggleHeading({ level: 2 }).run()}><Heading2 className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" className={btn(editor.isActive("heading", { level: 3 }))} onClick={() => (editor.chain() as any).focus().toggleHeading({ level: 3 }).run()}><Heading3 className="w-4 h-4" /></Button>
      <div className="h-5 w-px bg-border mx-1" />
      <Button variant="ghost" size="icon" className={btn(editor.isActive("bulletList"))} onClick={() => (editor.chain() as any).focus().toggleBulletList().run()}><List className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" className={btn(editor.isActive("orderedList"))} onClick={() => (editor.chain() as any).focus().toggleOrderedList().run()}><ListOrdered className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" className={btn(editor.isActive("blockquote"))} onClick={() => (editor.chain() as any).focus().toggleBlockquote().run()}><Quote className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" onClick={() => (editor.chain() as any).focus().setHorizontalRule().run()}><Minus className="w-4 h-4" /></Button>
      <div className="h-5 w-px bg-border mx-1" />
      <Button variant="ghost" size="icon" className={btn(editor.isActive("link"))} onClick={addLink}><LinkIcon className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" onClick={addImage}><ImageIcon className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" onClick={addTable}><TableIcon className="w-4 h-4" /></Button>
      <div className="h-5 w-px bg-border mx-1" />
      <Button variant="ghost" size="icon" onClick={() => (editor.chain() as any).focus().undo().run()}><Undo className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" onClick={() => (editor.chain() as any).focus().redo().run()}><Redo className="w-4 h-4" /></Button>
    </div>
  );
};

export default EditorToolbar;

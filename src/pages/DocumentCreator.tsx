import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Link as LinkExt } from "@tiptap/extension-link";
import { Table as TableExt } from "@tiptap/extension-table";
import TableRowExt from "@tiptap/extension-table-row";
import TableCellExt from "@tiptap/extension-table-cell";
import TableHeaderExt from "@tiptap/extension-table-header";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Download,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  LogOut,
  RefreshCw,
  Save,
  Settings as SettingsIcon,
  X,
} from "lucide-react";
import jkLogo from "@/assets/jk-machinery-logo.png";
import SectionSwitcher from "@/components/SectionSwitcher";
import EditorToolbar from "@/components/EditorToolbar";

interface ContentItem {
  id: string;
  url: string;
  properties: Record<string, string>;
}

interface PropMeta {
  type: string;
  options?: string[];
}

const FILTER_PROPS = ["Jazyk", "Typ", "Stav", "Section", "Subsection"] as const;

const DocumentCreator = () => {
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [schema, setSchema] = useState<Record<string, PropMeta>>({});
  const [titleProp, setTitleProp] = useState<string>("Name");
  const [titleQuery, setTitleQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState<ContentItem | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      LinkExt.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener", target: "_blank" } }),
      TableExt.configure({ resizable: true }),
      TableRowExt,
      TableHeaderExt,
      TableCellExt,
    ],
    content: "<p></p>",
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[400px] p-4",
      },
    },
  });

  // Load schema once
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("notion-content", { body: { action: "schema" } });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setSchema(data.properties ?? {});
        const tn = Object.entries<PropMeta>(data.properties ?? {}).find(([, p]) => p.type === "title")?.[0];
        if (tn) setTitleProp(tn);
      } catch (e) {
        toast.error("Nepodařilo se načíst schéma databáze", { description: e instanceof Error ? e.message : "" });
      }
    })();
  }, []);

  const fetchList = async () => {
    setLoading(true);
    try {
      const filterPayload = Object.entries(filters)
        .filter(([, v]) => v && v !== "__any__")
        .map(([property, value]) => ({ property, type: schema[property]?.type ?? "select", value }));
      const { data, error } = await supabase.functions.invoke("notion-content", {
        body: { action: "list", pageSize: 20, filters: filterPayload, titleQuery: titleQuery || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setItems(data.items ?? []);
    } catch (e) {
      toast.error("Načtení selhalo", { description: e instanceof Error ? e.message : "" });
    } finally {
      setLoading(false);
    }
  };

  // Auto-load on mount when schema is ready
  useEffect(() => {
    if (Object.keys(schema).length > 0 && items.length === 0) fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema]);

  const loadContent = async (item: ContentItem) => {
    setLoadingContent(true);
    try {
      const { data, error } = await supabase.functions.invoke("notion-content", {
        body: { action: "get", pageId: item.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      editor?.commands.setContent(data.html || "<p></p>");
      setActivePage(item);
      toast.success("Obsah načten");
    } catch (e) {
      toast.error("Načtení obsahu selhalo", { description: e instanceof Error ? e.message : "" });
    } finally {
      setLoadingContent(false);
    }
  };

  const saveToNotion = async () => {
    if (!activePage || !editor) return;
    setSaving(true);
    try {
      const html = editor.getHTML();
      const { data, error } = await supabase.functions.invoke("notion-content", {
        body: { action: "save", pageId: activePage.id, html },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Uloženo do Notion (${data.count} bloků)`);
    } catch (e) {
      toast.error("Uložení selhalo", { description: e instanceof Error ? e.message : "" });
    } finally {
      setSaving(false);
    }
  };

  const previewPdf = () => {
    if (!editor) return;
    setShowPdfPreview(true);
  };

  const downloadPdf = async () => {
    if (!previewRef.current) return;
    const html2pdf = (await import("html2pdf.js")).default;
    const opt = {
      margin: [15, 15, 15, 15] as [number, number, number, number],
      filename: `${activePage?.properties[titleProp] || "dokument"}.pdf`,
      image: { type: "jpeg", quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] },
    };
    await html2pdf().set(opt).from(previewRef.current).save();
  };

  const tableHeaders = useMemo(() => {
    const cols = [titleProp, ...FILTER_PROPS.filter((p) => schema[p])];
    return cols;
  }, [titleProp, schema]);

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="container max-w-[105rem] py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={jkLogo} alt="JK Machinery" className="h-9 w-auto" loading="lazy" />
            <div className="h-8 w-px bg-border" />
            <div>
              <h1 className="font-semibold leading-tight">JKM Document Creator</h1>
              <p className="text-xs text-muted-foreground">Editace a export obsahu z Notion</p>
            </div>
            <div className="hidden md:block ml-2">
              <SectionSwitcher showCreator={isAdmin} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {(profile?.full_name?.trim() || profile?.email) && (
              <div className="text-sm text-right leading-tight hidden sm:block">
                {profile?.full_name?.trim() && <div className="font-medium">{profile.full_name}</div>}
                <div className="text-xs text-muted-foreground">{profile?.email}</div>
              </div>
            )}
            {isAdmin && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/settings"><SettingsIcon className="w-4 h-4 mr-1" /> Nastavení</Link>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={async () => { await supabase.auth.signOut(); navigate("/auth", { replace: true }); }}>
              <LogOut className="w-4 h-4 mr-1" /> Odhlásit
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-[105rem] py-6 space-y-4">
        {/* Filters */}
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Jméno (obsahuje)</label>
              <Input value={titleQuery} onChange={(e) => setTitleQuery(e.target.value)} className="w-56" placeholder="Hledat…" />
            </div>
            {FILTER_PROPS.map((prop) => {
              const meta = schema[prop];
              if (!meta) return null;
              const opts = meta.options ?? [];
              return (
                <div key={prop} className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">{prop}</label>
                  <Select value={filters[prop] ?? "__any__"} onValueChange={(v) => setFilters((f) => ({ ...f, [prop]: v }))}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any__">— vše —</SelectItem>
                      {opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
            <Button onClick={fetchList} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
              Načíst seznam
            </Button>
          </div>
        </Card>

        {/* List */}
        <Card className="p-0 overflow-hidden">
          <div className="max-h-[40vh] overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <TableHeader className="bg-muted/70 [&_tr]:border-b-0 [&>tr>th]:sticky [&>tr>th]:top-0 [&>tr>th]:z-20 [&>tr>th]:bg-muted">
                <TableRow>
                  {tableHeaders.map((h) => <TableHead key={h}>{h}</TableHead>)}
                  <TableHead className="text-right">Akce</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 && (
                  <TableRow><TableCell colSpan={tableHeaders.length + 1} className="text-center text-muted-foreground py-6">Žádné položky</TableCell></TableRow>
                )}
                {items.map((it) => {
                  const isActive = activePage?.id === it.id;
                  return (
                    <TableRow key={it.id} className={isActive ? "bg-primary/5" : undefined}>
                      {tableHeaders.map((h) => (
                        <TableCell key={h} className={h === titleProp ? "font-medium" : "text-muted-foreground"}>
                          {it.properties[h] || "—"}
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" asChild>
                            <a href={it.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" /></a>
                          </Button>
                          <Button size="sm" onClick={() => loadContent(it)} disabled={loadingContent}>
                            {loadingContent && isActive ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
                            Načíst obsah
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </table>
          </div>
        </Card>

        {/* Editor */}
        {activePage && (
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-primary" />
                <span className="font-medium">{activePage.properties[titleProp] || "(bez názvu)"}</span>
                <a href={activePage.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={previewPdf}>
                  <Eye className="w-4 h-4 mr-1" /> Náhled PDF
                </Button>
                <Button size="sm" onClick={saveToNotion} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                  Uložit do Notion
                </Button>
              </div>
            </div>
            <EditorToolbar editor={editor} />
            <div className="bg-background">
              <EditorContent editor={editor} />
            </div>
          </Card>
        )}
      </main>

      {/* PDF Preview Modal */}
      {showPdfPreview && editor && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <div className="font-medium">Náhled PDF</div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={downloadPdf}><Download className="w-4 h-4 mr-1" /> Stáhnout PDF</Button>
                <Button variant="ghost" size="icon" onClick={() => setShowPdfPreview(false)}><X className="w-4 h-4" /></Button>
              </div>
            </div>
            <div className="overflow-auto p-6 bg-muted/30">
              <div ref={previewRef} className="pdf-preview bg-white mx-auto shadow-md p-10" style={{ width: "210mm", minHeight: "297mm" }}>
                <h1 className="text-2xl font-bold mb-4">{activePage?.properties[titleProp]}</h1>
                <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: editor.getHTML() }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentCreator;

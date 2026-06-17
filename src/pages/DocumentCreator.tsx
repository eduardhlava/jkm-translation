import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ResizableImage } from "@/components/ResizableImage";
import { Link as LinkExt } from "@tiptap/extension-link";
import { Table as TableExt } from "@tiptap/extension-table";
import TableRowExt from "@tiptap/extension-table-row";
import TableCellExt from "@tiptap/extension-table-cell";
import TableHeaderExt from "@tiptap/extension-table-header";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
import BlockEditor from "@/components/BlockEditor";
import type { Block } from "@/components/BlockEditor/types";
import { blocksToHtml } from "@/components/BlockEditor/serialize";
import { parseDocumentJson, SAMPLE_DOCUMENT_JSON } from "@/components/BlockEditor/importJson";
import PdfCanvasPreview from "@/components/PdfCanvasPreview";
import { Blocks, PencilLine, Upload, FileDown, MoreHorizontal, Check, FileCog } from "lucide-react";
import { useRef } from "react";
import DocumentMetadataDialog from "@/components/DocumentMetadata/DocumentMetadataDialog";
import { DEFAULT_DOCUMENT_METADATA, mergeMetadata, type DocumentMetadata } from "@/components/DocumentMetadata/types";

type EditorMode = "blocks" | "wysiwyg";

interface ContentItem {
  id: string;
  url: string;
  properties: Record<string, string>;
}

interface PropMeta {
  type: string;
  options?: string[];
}

const FILTER_PROPS = ["jazyk", "typ", "stav", "section", "subsection"] as const;

const DocumentCreator = () => {
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [schema, setSchema] = useState<Record<string, PropMeta>>({});
  const [titleProp, setTitleProp] = useState<string>("název");
  const [titleQuery, setTitleQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState<ContentItem | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSaveNotice, setShowSaveNotice] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const [pdfBuilding, setPdfBuilding] = useState(false);

  useEffect(() => {
    if (!pdfBlob) {
      setPdfObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(pdfBlob);
    setPdfObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pdfBlob]);
  const [mode, setMode] = useState<EditorMode>("blocks");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [docTitle, setDocTitle] = useState("");
  const [originalTitle, setOriginalTitle] = useState("");
  const [lastExportAt, setLastExportAt] = useState<string | null>(null);
  const [overwriteDialog, setOverwriteDialog] = useState<{ open: boolean; targetId: string | null }>({ open: false, targetId: null });
  const [numberHeadings, setNumberHeadings] = useState(false);
  const [collapsedBlocks, setCollapsedBlocks] = useState<Record<string, boolean>>({});
  const [metadata, setMetadata] = useState<DocumentMetadata>(DEFAULT_DOCUMENT_METADATA);
  const [metadataOpen, setMetadataOpen] = useState(false);



  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false } as any),
      TextStyle,
      Color,
      ResizableImage.configure({ inline: false, allowBase64: true, HTMLAttributes: { class: "max-w-full h-auto" } }),
      LinkExt.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener", target: "_blank" } }),
      TableExt.configure({ resizable: true, HTMLAttributes: { class: "tiptap-table" } }),
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
    setLoadingId(item.id);
    try {
      const [contentRes, blocksRes] = await Promise.all([
        supabase.functions.invoke("notion-content", { body: { action: "get", pageId: item.id } }),
        supabase.from("document_blocks").select("blocks, settings, notion_exported_at").eq("page_id", item.id).maybeSingle(),
      ]);
      if (contentRes.error) throw contentRes.error;
      if ((contentRes.data as any)?.error) throw new Error((contentRes.data as any).error);
      editor?.commands.setContent((contentRes.data as any).html || "<p></p>");

      const saved = ((blocksRes.data?.blocks as unknown) as Block[] | undefined) ?? [];
      setBlocks(saved);
      setMode(saved.length > 0 ? "blocks" : "wysiwyg");
      setActivePage(item);
      const initialTitle = item.properties[titleProp] || "";
      setDocTitle(initialTitle);
      setOriginalTitle(initialTitle);
      const savedSettings = (blocksRes.data as any)?.settings ?? {};
      setNumberHeadings(!!savedSettings.numberHeadings);
      setCollapsedBlocks((savedSettings.collapsedBlocks as Record<string, boolean>) ?? {});
      setMetadata(mergeMetadata({ ...(savedSettings.metadata ?? {}), docName: savedSettings.metadata?.docName ?? initialTitle }));
      setLastExportAt((blocksRes.data as any)?.notion_exported_at ?? null);
      toast.success("Obsah načten");
    } catch (e) {
      toast.error("Načtení obsahu selhalo", { description: e instanceof Error ? e.message : "" });
    } finally {
      setLoadingContent(false);
      setLoadingId(null);
    }
  };

  const [savingDraft, setSavingDraft] = useState(false);

  const saveDraft = async () => {
    if (!activePage || !editor) return;
    setSavingDraft(true);
    try {
      const html = blocksToHtml(blocks);
      // Sync WYSIWYG with blocks for consistency
      editor.commands.setContent(html || "<p></p>");
      const { error } = await supabase
        .from("document_blocks")
        .upsert({ page_id: activePage.id, blocks: blocks as any, settings: { numberHeadings, collapsedBlocks, metadata } as any }, { onConflict: "page_id" });
      if (error) throw error;
      toast.success("Uloženo do databáze aplikace");
    } catch (e) {
      toast.error("Uložení selhalo", { description: e instanceof Error ? e.message : "" });
    } finally {
      setSavingDraft(false);
    }
  };

  const runNotionExport = async (targetPageId: string, targetUrl: string, finalTitle: string) => {
    if (!editor) return;
    const html = mode === "blocks" ? blocksToHtml(blocks) : editor.getHTML();
    const doc = mode === "blocks" ? undefined : editor.getJSON();

    if (mode === "blocks") {
      editor.commands.setContent(html || "<p></p>");
    }
    // Persist blocks bound to the (possibly new) target page id
    const { error: upErr } = await supabase
      .from("document_blocks")
      .upsert({ page_id: targetPageId, blocks: blocks as any }, { onConflict: "page_id" });
    if (upErr) throw upErr;

    let phase: "delete" | "append" | "verify" | "done" = "delete";
    let cursor = 0;
    let after: string | undefined;

    for (let attempt = 0; attempt < 250 && phase !== "done"; attempt++) {
      const { data, error } = await supabase.functions.invoke("notion-content", {
        body: { action: "save", pageId: targetPageId, html, doc, phase, cursor, after },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      phase = data?.phase ?? "done";
      cursor = data?.cursor ?? 0;
      after = data?.after ?? after;
    }
    if (phase !== "done") throw new Error("Ukládání trvalo příliš dlouho, zkuste to prosím znovu.");

    const exportedAt = new Date().toISOString();
    await supabase
      .from("document_blocks")
      .update({ notion_exported_at: exportedAt })
      .eq("page_id", targetPageId);
    setLastExportAt(exportedAt);

    // Update local activePage binding to the target page
    setActivePage((prev) => prev ? { ...prev, id: targetPageId, url: targetUrl, properties: { ...prev.properties, [titleProp]: finalTitle } } : prev);
    setOriginalTitle(finalTitle);
    toast.success("Obsah uložen a ověřen");
  };

  const performExport = async (forceOverwriteId?: string) => {
    if (!activePage) return;
    setSaving(true);
    setShowSaveNotice(true);
    try {
      const title = (docTitle || "").trim();
      if (!title) throw new Error("Název dokumentu nesmí být prázdný");

      // Decide target page
      let targetId = activePage.id;
      let targetUrl = activePage.url;

      if (forceOverwriteId) {
        targetId = forceOverwriteId;
        targetUrl = activePage.url;
      } else {
        // Always check if a page with this title exists in Notion
        const { data, error } = await supabase.functions.invoke("notion-content", {
          body: { action: "checkTitle", title },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        const matches: Array<{ id: string; url: string }> = data?.matches ?? [];

        if (matches.length > 0) {
          // Ask user to confirm overwrite (use first match)
          setSaving(false);
          setShowSaveNotice(false);
          setOverwriteDialog({ open: true, targetId: matches[0].id });
          return;
        }

        // No match → create new page and switch binding
        const createRes = await supabase.functions.invoke("notion-content", {
          body: { action: "createPage", title },
        });
        if (createRes.error) throw createRes.error;
        if ((createRes.data as any)?.error) throw new Error((createRes.data as any).error);
        targetId = (createRes.data as any).id;
        targetUrl = (createRes.data as any).url;
      }

      // If we're overwriting an existing target, ensure its title matches the entered title
      if (forceOverwriteId) {

        const renameRes = await supabase.functions.invoke("notion-content", {
          body: { action: "updateTitle", pageId: targetId, title },
        });
        if (renameRes.error) throw renameRes.error;
        if ((renameRes.data as any)?.error) throw new Error((renameRes.data as any).error);
      }

      await runNotionExport(targetId, targetUrl, title);
    } catch (e) {
      toast.error("Uložení selhalo", { description: e instanceof Error ? e.message : "" });
    } finally {
      setSaving(false);
      setShowSaveNotice(false);
    }
  };

  const saveToNotion = () => performExport();

  const confirmOverwrite = async () => {
    const id = overwriteDialog.targetId;
    setOverwriteDialog({ open: false, targetId: null });
    if (id) await performExport(id);
  };


  const buildPdf = async (): Promise<Blob> => {
    const { generateDocumentPdf } = await import("@/lib/pdf/generate");
    const title = (docTitle || activePage?.properties[titleProp] || "dokument").trim();
    return await generateDocumentPdf(title, blocks, {
      numberHeadings,
      pageId: activePage?.id,
      metadata,
      onImagesRehydrated: (rewrites) => {
        if (!rewrites.size) return;
        setBlocks((prev) => {
          const next = prev.map((b) => {
            if (b.type !== "image") return b;
            const u = (b.content as any)?.url as string | undefined;
            const fresh = u ? rewrites.get(u) : undefined;
            return fresh ? { ...b, content: { ...b.content, url: fresh } } : b;
          });
          // Persist rehydrated permanent URLs so future loads don't 403.
          if (activePage) {
            supabase
              .from("document_blocks")
              .upsert({ page_id: activePage.id, blocks: next as any, settings: { numberHeadings, collapsedBlocks, metadata } as any }, { onConflict: "page_id" })
              .then(({ error }) => { if (error) console.warn("[pdf] persist rehydrated images failed", error); });
          }
          return next;
        });
      },
    });
  };


  const previewPdf = async () => {
    if (!activePage) return;
    setPdfBuilding(true);
    setShowPdfPreview(true);
    setPdfBlob(null);
    try {
      const blob = await buildPdf();
      setPdfBlob(blob);
    } catch (e) {
      console.error("[pdf] generation failed", e);
      toast.error("Generování PDF selhalo", { description: e instanceof Error ? e.message : "" });
      setShowPdfPreview(false);
    } finally {
      setPdfBuilding(false);
    }
  };

  const closePdfPreview = () => {
    setShowPdfPreview(false);
    setPdfBlob(null);
  };

  const [uploadingPdf, setUploadingPdf] = useState(false);

  const uploadPdfToNotion = async () => {
    if (!pdfBlob || !activePage) return;
    setUploadingPdf(true);
    try {
      const filename = getPdfFilename();
      const buf = await pdfBlob.arrayBuffer();
      // chunked base64 to avoid stack overflow
      const bytes = new Uint8Array(buf);
      let binary = "";
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
      }
      const pdfBase64 = btoa(binary);

      const { data, error } = await supabase.functions.invoke("notion-content", {
        body: { action: "uploadPdf", pageId: activePage.id, filename, pdfBase64 },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("PDF uloženo do Notion");
    } catch (err) {
      console.error("[pdf] upload to notion failed", err);
      toast.error(err instanceof Error ? err.message : "Nepodařilo se uložit PDF do Notion");
    } finally {
      setUploadingPdf(false);
    }
  };

  const getPdfFilename = () => {
    const rawName = (docTitle || activePage?.properties[titleProp] || "dokument").trim();
    const safeName = rawName.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
    return `${safeName || "dokument"}.pdf`;
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImportJsonClick = () => fileInputRef.current?.click();

  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const { title, blocks: imported } = parseDocumentJson(text);
      if (imported.length === 0) {
        toast.error("JSON neobsahuje žádné bloky");
        return;
      }
      setBlocks(imported);
      if (title) setDocTitle(title);
      toast.success(`Načteno ${imported.length} bloků z JSON`);
    } catch (err) {
      toast.error("Import JSON selhal", { description: err instanceof Error ? err.message : "" });
    }
  };

  const downloadSampleJson = () => {
    const json = JSON.stringify(SAMPLE_DOCUMENT_JSON, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dokument-vzor.json";
    a.click();
    URL.revokeObjectURL(url);
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
        {!activePage && (
          <Card className="p-4 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Název (obsahuje)</label>
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
        )}

        {/* List */}
        {!activePage && (
          <Card className="p-0 overflow-hidden bg-muted">
            <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 260px)" }}>
              <table className="w-full caption-bottom text-sm bg-card">
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
                              {loadingId === it.id ? (
                                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Načítám…</>
                              ) : (
                                <><Download className="w-4 h-4 mr-1" /> Načíst obsah</>
                              )}
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
        )}

        {/* Editor */}
        {activePage && (
          <Card className="overflow-hidden flex flex-col" style={{ height: "calc(100vh - 90px)" }}>
            <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2">
              <div className="flex items-center gap-2 text-sm flex-1 min-w-0">
                <Button variant="ghost" size="sm" onClick={() => setActivePage(null)}>
                  ← Zpět na seznam
                </Button>
                <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                <Input
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="h-8 max-w-md font-medium"
                  placeholder="Název dokumentu"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => setMetadataOpen(true)}>
                  <FileCog className="w-4 h-4 mr-1" /> Nastavení dokumentu
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem asChild>
                      <a href={activePage.url} target="_blank" rel="noopener noreferrer" className="cursor-pointer">
                        <ExternalLink className="w-4 h-4 mr-2" /> Zobraz v Notion
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setMode("blocks")}>
                      <Blocks className="w-4 h-4 mr-2" />
                      <span className="flex-1">Bloky</span>
                      {mode === "blocks" && <Check className="w-4 h-4 ml-2" />}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setMode("wysiwyg")}>
                      <PencilLine className="w-4 h-4 mr-2" />
                      <span className="flex-1">WYSIWYG</span>
                      {mode === "wysiwyg" && <Check className="w-4 h-4 ml-2" />}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={downloadSampleJson}>
                      <FileDown className="w-4 h-4 mr-2" /> Vzor JSON
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleImportJsonClick}>
                      <Upload className="w-4 h-4 mr-2" /> Importovat JSON
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" size="sm" onClick={previewPdf} disabled={saving}>
                  <Eye className="w-4 h-4 mr-1" /> Náhled PDF
                </Button>

                <div className="flex flex-col items-end">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" onClick={saveToNotion} disabled={saving}>
                        {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                        {saving ? "Exportuji…" : "Exportovat do Notion"}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">
                        {lastExportAt
                          ? `Poslední export: ${new Date(lastExportAt).toLocaleString("cs-CZ")}`
                          : "Zatím neexportováno"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  {showSaveNotice && (
                    <div className="mt-1 max-w-xs rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground shadow-sm">
                      Ukládání probíhá na pozadí. Počkejte prosím 1–2 minuty a během této doby nezasahujte do obsahu v Notion.
                    </div>
                  )}
                </div>
              </div>
            </div>
            {mode === "wysiwyg" ? (
              <>
                <div className="flex-shrink-0">
                  <EditorToolbar editor={editor} />
                </div>
                <div className="flex-1 min-h-0 overflow-auto bg-background">
                  <EditorContent editor={editor} />
                </div>
              </>
            ) : (
              <div className="flex-1 min-h-0 overflow-auto bg-muted/20 p-4">
                <div className="mx-auto max-w-4xl">
                  <BlockEditor
                    blocks={blocks}
                    onChange={setBlocks}
                    numberHeadings={numberHeadings}
                    collapsed={collapsedBlocks}
                    onCollapsedChange={setCollapsedBlocks}
                    leftSlot={
                      <Button type="button" variant="outline" size="sm" onClick={() => setMetadataOpen(true)}>
                        <FileCog className="w-4 h-4 mr-1" /> Metadata dokumentu
                      </Button>
                    }
                  />
                </div>
              </div>
            )}
            {mode === "blocks" && (
              <div className="flex-shrink-0 flex items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                  <Checkbox
                    checked={numberHeadings}
                    onCheckedChange={(v) => setNumberHeadings(v === true)}
                  />
                  Automaticky číslovat nadpisy (H1–H4)
                </label>
                <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleImportJsonFile}
                />
                <Button size="sm" onClick={saveDraft} disabled={savingDraft}>
                  {savingDraft ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                  Uložit
                </Button>

                </div>
              </div>
            )}

          </Card>
        )}
      </main>

      {/* PDF Preview Modal */}
      {showPdfPreview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-5xl h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <div className="font-medium">Náhled PDF</div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={uploadPdfToNotion}
                  disabled={!pdfBlob || pdfBuilding || uploadingPdf}
                  size="sm"
                >
                  {uploadingPdf ? (
                    <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Nahrávám…</>
                  ) : (
                    <><Save className="w-4 h-4 mr-1" /> Uložit do Notion</>
                  )}
                </Button>
                <Button variant="ghost" size="icon" onClick={closePdfPreview}><X className="w-4 h-4" /></Button>
              </div>
            </div>
            <div className="flex-1 min-h-0 bg-muted/30">
              {pdfBuilding && !pdfBlob ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generuji PDF…
                </div>
              ) : pdfBlob ? (
                <PdfCanvasPreview blob={pdfBlob} />
              ) : null}
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={overwriteDialog.open} onOpenChange={(open) => !open && setOverwriteDialog({ open: false, targetId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dokument se stejným názvem už v Notion existuje</AlertDialogTitle>
            <AlertDialogDescription>
              V Notion již existuje dokument s názvem „{docTitle}". Chcete jeho obsah přepsat aktuální verzí z editoru?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={confirmOverwrite}>Přepsat</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DocumentMetadataDialog
        open={metadataOpen}
        onOpenChange={setMetadataOpen}
        value={metadata}
        onChange={setMetadata}
      />
    </div>
  );
};

export default DocumentCreator;

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SectionSwitcher from "@/components/SectionSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  ChevronRight,
  ExternalLink,
  File as FileIcon,
  Folder,
  Home,
  Loader2,
  RefreshCw,
} from "lucide-react";
import jkLogo from "@/assets/jk-machinery-logo.png";

type FolderItem = { id: string; name: string; parentId: string | null; url: string };
type FileItem = {
  id: string;
  title: string;
  image: string;
  url: string;
  typ: string;
  stroj: string;
  stav: string;
  folderId: string | null;
  createdTime: string;
};

const Library = () => {
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.functions.invoke("notion-library", {
      body: { folderId, search: debounced || undefined },
    });
    if (error) {
      setError(error.message);
    } else {
      setFolders((data?.folders ?? []) as FolderItem[]);
      setFiles((data?.files ?? []) as FileItem[]);
      setBreadcrumbs((data?.breadcrumbs ?? []) as { id: string; name: string }[]);
    }
    setLoading(false);
  }, [folderId, debounced]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex flex-wrap items-center gap-4 px-4 py-3">
          <Link to="/">
            <img src={jkLogo} alt="JK Machinery" className="h-8 w-auto" />
          </Link>
          <SectionSwitcher showCreator />
          <div className="ml-auto flex items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hledat podle názvu…"
              className="w-56"
            />
            <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-4 px-4 py-6">
        <h1 className="text-xl font-semibold">Obrázky / Dokumenty</h1>

        <nav className="flex flex-wrap items-center gap-1 text-sm">
          <button
            className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-muted"
            onClick={() => setFolderId(null)}
          >
            <Home className="h-3.5 w-3.5" /> Kořen
          </button>
          {breadcrumbs.map((b) => (
            <span key={b.id} className="inline-flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <button
                className="rounded px-2 py-1 hover:bg-muted"
                onClick={() => setFolderId(b.id)}
              >
                {b.name || "Bez názvu"}
              </button>
            </span>
          ))}
        </nav>

        {error && (
          <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Načítám z Notion…
          </div>
        ) : (
          <div className="space-y-6">
            {folders.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground">Složky</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {folders.map((f) => (
                    <button key={f.id} onClick={() => setFolderId(f.id)} className="text-left">
                      <Card className="flex items-center gap-2 p-3 transition-colors hover:bg-muted">
                        <Folder className="h-5 w-5 shrink-0 text-primary" />
                        <span className="truncate text-sm font-medium">{f.name || "Bez názvu"}</span>
                      </Card>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">Soubory</h2>
              {files.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tato složka je prázdná.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {files.map((it) => (
                    <Card key={it.id} className="overflow-hidden">
                      <div className="flex h-32 items-center justify-center bg-muted">
                        {it.image ? (
                          <img
                            src={it.image}
                            alt={it.title}
                            loading="lazy"
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <FileIcon className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="space-y-1 p-3">
                        <div className="truncate text-sm font-medium">{it.title || "Bez názvu"}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {[it.typ, it.stroj, it.stav].filter(Boolean).join(" • ") || "—"}
                        </div>
                        <a
                          href={it.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> Notion
                        </a>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

export default Library;

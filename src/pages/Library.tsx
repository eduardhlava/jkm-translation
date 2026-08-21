import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SectionSwitcher from "@/components/SectionSwitcher";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronRight,
  File as FileIcon,
  Folder,
  Home,
  LayoutGrid,
  List as ListIcon,
  Loader2,
  LogOut,
  RefreshCw,
  Settings as SettingsIcon,
} from "lucide-react";
import jkLogo from "@/assets/jk-machinery-logo.png";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp"]);

const isImageUrl = (url: string) => {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return IMAGE_EXTENSIONS.has(pathname.slice(pathname.lastIndexOf(".")));
  } catch {
    return false;
  }
};

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

const ALL = "__all__";
const PAGE_SIZE = 20;

const Library = () => {
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [typ, setTyp] = useState(ALL);
  const [stroj, setStroj] = useState(ALL);
  const [stav, setStav] = useState(ALL);
  const [view, setView] = useState<"gallery" | "list">("list");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [allFolders, setAllFolders] = useState(false);
  const [detail, setDetail] = useState<FileItem | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.functions.invoke("notion-library", {
      body: { folderId: allFolders ? null : folderId, allFolders },
    });
    if (error) {
      setError(error.message);
    } else {
      setFolders((data?.folders ?? []) as FolderItem[]);
      setFiles((data?.files ?? []) as FileItem[]);
      setBreadcrumbs((data?.breadcrumbs ?? []) as { id: string; name: string }[]);
    }
    setLoading(false);
  }, [folderId, allFolders]);

  useEffect(() => {
    void load();
  }, [load]);

  const optionsOf = (key: "typ" | "stroj" | "stav") =>
    Array.from(new Set(files.map((f) => f[key]).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "cs"),
    );

  const typOptions = useMemo(() => optionsOf("typ"), [files]);
  const strojOptions = useMemo(() => optionsOf("stroj"), [files]);
  const stavOptions = useMemo(() => optionsOf("stav"), [files]);

  const filtered = useMemo(() => {
    const q = debounced.toLowerCase();
    return files.filter((f) => {
      if (q && !`${f.title} ${f.typ} ${f.stroj} ${f.stav}`.toLowerCase().includes(q)) return false;
      if (typ !== ALL && f.typ !== typ) return false;
      if (stroj !== ALL && f.stroj !== stroj) return false;
      if (stav !== ALL && f.stav !== stav) return false;
      return true;
    });
  }, [files, debounced, typ, stroj, stav]);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [debounced, typ, stroj, stav, folderId, view, allFolders]);

  const shown = filtered.slice(0, visible);

  const meta = (it: FileItem) => (
    <div className="space-y-0.5 text-xs text-muted-foreground">
      <div className="truncate">Typ: {it.typ || "—"}</div>
      <div className="truncate">Stroj: {it.stroj || "—"}</div>
      <div className="truncate">Stav: {it.stav || "—"}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex flex-wrap items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/">
              <img src={jkLogo} alt="JK Machinery" className="h-8 w-auto" />
            </Link>
            <div className="h-8 w-px bg-border" />
            <div>
              <h1 className="font-semibold leading-tight">Content Translator</h1>
              <p className="text-xs text-muted-foreground">Správa hesel slovníku</p>
            </div>
            <div className="hidden md:block ml-2">
              <SectionSwitcher showCreator={isAdmin} />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {(profile?.full_name?.trim() || profile?.email) && (
              <div className="text-sm text-right leading-tight hidden sm:block">
                {profile?.full_name?.trim() && (
                  <div className="font-medium">{profile.full_name}</div>
                )}
                <div className="text-xs text-muted-foreground">{profile?.email}</div>
              </div>
            )}
            {isAdmin && (
              <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                <Link to="/settings" aria-label="Nastavení">
                  <SettingsIcon className="w-4 h-4" />
                  <span className="sr-only">Nastavení</span>
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate("/auth", { replace: true });
              }}
            >
              <LogOut className="w-4 h-4 mr-1" /> Odhlásit
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-xl font-semibold">Soubory</h1>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            </Button>
            <div className="flex rounded-md border p-0.5">
              <Button
                variant={view === "gallery" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("gallery")}
                className={cn(view === "gallery" && "ring-2 ring-ring ring-offset-1")}
              >
                <LayoutGrid className="mr-1 h-4 w-4" /> Galerie
              </Button>
              <Button
                variant={view === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("list")}
                className={cn(view === "list" && "ring-2 ring-ring ring-offset-1")}
              >
                <ListIcon className="mr-1 h-4 w-4" /> Seznam
              </Button>
            </div>
          </div>
        </div>

        <nav className={cn("flex flex-wrap items-center gap-1 text-sm", allFolders && "opacity-50 pointer-events-none")}>
          <button
            className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-muted"
            onClick={() => setFolderId(null)}
            disabled={allFolders}
          >
            <Home className="h-3.5 w-3.5" /> Kořen
          </button>
          {breadcrumbs.map((b) => (
            <span key={b.id} className="inline-flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <button className="rounded px-2 py-1 hover:bg-muted" onClick={() => setFolderId(b.id)} disabled={allFolders}>
                {b.name || "Bez názvu"}
              </button>
            </span>
          ))}
        </nav>

        {!allFolders && (
          <section className="space-y-2">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium text-muted-foreground">Složky</h2>
              <Link
                to="/library/folders"
                className="text-sm font-medium text-primary hover:underline"
              >
                Správa složek
              </Link>
            </div>
            {folders.length > 0 ? (
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
            ) : (
              <p className="text-sm text-muted-foreground">Žádné podsložky.</p>
            )}
          </section>
        )}

        <Card className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Název (fulltext)</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hledat…"
            />
          </div>
          {[
            { label: "Typ", value: typ, set: setTyp, opts: typOptions },
            { label: "Stroj", value: stroj, set: setStroj, opts: strojOptions },
            { label: "Stav", value: stav, set: setStav, opts: stavOptions },
          ].map((f) => (
            <div key={f.label} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{f.label}</Label>
              <Select value={f.value} onValueChange={f.set}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Vše</SelectItem>
                  {f.opts.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
              <Checkbox checked={allFolders} onCheckedChange={(v) => setAllFolders(Boolean(v))} />
              Filtrovat ve všech složkách
            </label>
          </div>
        </Card>

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

            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                Soubory ({filtered.length})
              </h2>
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nic nenalezeno.</p>
              ) : view === "gallery" ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {shown.map((it) => {
                    const clickable = Boolean(it.image && isImageUrl(it.image));
                    return (
                      <Card key={it.id} className="overflow-hidden">
                        <div
                          className={cn(
                            "flex h-32 items-center justify-center bg-muted",
                            clickable && "cursor-pointer hover:bg-muted/80",
                          )}
                          onClick={() => clickable && setDetail(it)}
                        >
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
                          {meta(it)}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="divide-y">
                  {shown.map((it) => {
                    const clickable = Boolean(it.image && isImageUrl(it.image));
                    return (
                      <div key={it.id} className="flex items-center gap-3 p-2">
                        <div
                          className={cn(
                            "flex h-12 w-12 shrink-0 items-center justify-center rounded border bg-muted",
                            clickable && "cursor-pointer hover:bg-muted/80",
                          )}
                          onClick={() => clickable && setDetail(it)}
                        >
                          {it.image ? (
                            <img
                              src={it.image}
                              alt={it.title}
                              loading="lazy"
                              className="h-full w-full rounded object-cover"
                            />
                          ) : (
                            <FileIcon className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 truncate text-sm font-medium">
                          {it.title || "Bez názvu"}
                        </div>
                        <div className="hidden w-32 shrink-0 truncate text-xs text-muted-foreground sm:block">
                          {it.typ || "—"}
                        </div>
                        <div className="hidden w-24 shrink-0 truncate text-xs text-muted-foreground sm:block">
                          {it.stroj || "—"}
                        </div>
                        <div className="hidden w-24 shrink-0 truncate text-xs text-muted-foreground sm:block">
                          {it.stav || "—"}
                        </div>
                      </div>
                    );
                  })}
                </Card>
              )}

              {visible < filtered.length && (
                <div className="flex justify-center pt-2">
                  <Button variant="outline" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                    Načíst další ({filtered.length - visible})
                  </Button>
                </div>
              )}
            </section>
          </div>
        )}

        <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
          {detail && (
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>{detail.title || "Bez názvu"}</DialogTitle>
                <DialogDescription>
                  Typ: {detail.typ || "—"} · Stroj: {detail.stroj || "—"} · Stav: {detail.stav || "—"}
                </DialogDescription>
              </DialogHeader>
              <div className="flex max-h-[70vh] items-center justify-center rounded-md border bg-muted p-2">
                {detail.image ? (
                  <img
                    src={detail.image}
                    alt={detail.title}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <FileIcon className="h-16 w-16 text-muted-foreground" />
                )}
              </div>
            </DialogContent>
          )}
        </Dialog>
      </main>
    </div>
  );
};

export default Library;

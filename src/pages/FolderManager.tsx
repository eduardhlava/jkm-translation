import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import SectionSwitcher, { useSectionAccent } from "@/components/SectionSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderPlus,
  Loader2,
  LogOut,
  MoveRight,
  Pencil,
  Settings as SettingsIcon,
} from "lucide-react";
import jkLogo from "@/assets/jk-machinery-logo.png";

type FolderItem = { id: string; name: string; parentId: string | null; url: string };

const ROOT = "__root__";
const norm = (id: string | null | undefined) => (id ? id.replace(/-/g, "") : null);

const FolderManager = () => {
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const sectionAccent = useSectionAccent();
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [createParent, setCreateParent] = useState<string | null | undefined>(undefined);
  const [createName, setCreateName] = useState("");
  const [renameTarget, setRenameTarget] = useState<FolderItem | null>(null);
  const [renameName, setRenameName] = useState("");
  const [moveTarget, setMoveTarget] = useState<FolderItem | null>(null);
  const [moveParent, setMoveParent] = useState<string>(ROOT);

  const call = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("notion-folders", { body });
    if (error) throw new Error(error.message);
    if ((data as any)?.error) throw new Error((data as any).error);
    setFolders(((data as any)?.folders ?? []) as FolderItem[]);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await call({ action: "list" });
    } catch (e) {
      toast({ title: "Chyba načítání složek", description: (e as Error).message, variant: "destructive" });
    }
    setLoading(false);
  }, [call]);

  useEffect(() => {
    void load();
  }, [load]);

  const childrenOf = useMemo(() => {
    const map = new Map<string, FolderItem[]>();
    for (const f of folders) {
      const key = norm(f.parentId) ?? ROOT;
      map.set(key, [...(map.get(key) ?? []), f]);
    }
    return map;
  }, [folders]);

  const descendants = useCallback(
    (id: string): Set<string> => {
      const out = new Set<string>();
      const walk = (cur: string) => {
        for (const c of childrenOf.get(norm(cur)!) ?? []) {
          if (!out.has(c.id)) {
            out.add(c.id);
            walk(c.id);
          }
        }
      };
      walk(id);
      return out;
    },
    [childrenOf],
  );

  const pathOf = useCallback(
    (f: FolderItem) => {
      const parts = [f.name || "Bez názvu"];
      let cur = f.parentId;
      let guard = 20;
      while (cur && guard-- > 0) {
        const p = folders.find((x) => norm(x.id) === norm(cur));
        if (!p) break;
        parts.unshift(p.name || "Bez názvu");
        cur = p.parentId;
      }
      return parts.join(" / ");
    },
    [folders],
  );

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const runAction = async (body: Record<string, unknown>, success: string) => {
    setSaving(true);
    try {
      await call(body);
      toast({ title: success });
      return true;
    } catch (e) {
      toast({ title: "Chyba", description: (e as Error).message, variant: "destructive" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const renderTree = (parentKey: string, depth: number) =>
    (childrenOf.get(parentKey) ?? []).map((f) => {
      const kids = childrenOf.get(norm(f.id)!) ?? [];
      const open = expanded.has(f.id);
      return (
        <div key={f.id}>
          <div
            className="group flex items-center gap-1 rounded px-1 py-1.5 hover:bg-muted"
            style={{ paddingLeft: depth * 18 + 4 }}
          >
            <button
              className="flex h-5 w-5 items-center justify-center text-muted-foreground disabled:opacity-0"
              onClick={() => toggle(f.id)}
              disabled={kids.length === 0}
            >
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            <Folder className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate text-sm">{f.name || "Bez názvu"}</span>
            <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRenameTarget(f);
                  setRenameName(f.name);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMoveTarget(f);
                  setMoveParent(f.parentId ?? ROOT);
                }}
              >
                <MoveRight className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setCreateParent(f.id); setCreateName(""); }}>
                <FolderPlus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {open && renderTree(norm(f.id)!, depth + 1)}
        </div>
      );
    });

  const moveOptions = moveTarget
    ? folders.filter((f) => f.id !== moveTarget.id && !descendants(moveTarget.id).has(f.id))
    : [];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-[3px] bg-card" style={{ borderBottomColor: sectionAccent }}>
        <div className="container mx-auto flex flex-wrap items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/">
              <img src={jkLogo} alt="JK Machinery" className="h-8 w-auto" />
            </Link>
            <div className="h-8 w-px bg-border" />
            <div>
              <h1 className="font-semibold leading-tight">Překlady slovníku</h1>
            </div>
            <div className="hidden md:block ml-2">
              <SectionSwitcher showCreator={isAdmin} />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {(profile?.full_name?.trim() || profile?.email) && (
              <div className="text-sm text-right leading-tight hidden sm:block">
                {profile?.full_name?.trim() && <div className="font-medium">{profile.full_name}</div>}
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

      <main className="container mx-auto max-w-3xl space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/library">
              <ArrowLeft className="mr-1 h-4 w-4" /> Zpět
            </Link>
          </Button>
          <h1 className="text-xl font-semibold">Správa složek</h1>
          <Button
            className="ml-auto"
            size="sm"
            onClick={() => {
              setCreateParent(null);
              setCreateName("");
            }}
          >
            <FolderPlus className="mr-1 h-4 w-4" /> Nová složka
          </Button>
        </div>

        <Card className="p-2">
          {loading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Načítám složky…
            </div>
          ) : folders.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Zatím žádné složky.</p>
          ) : (
            renderTree(ROOT, 0)
          )}
        </Card>
        <p className="text-xs text-muted-foreground">
          Změny se ukládají přímo do Notion. Mazání složek není povoleno.
        </p>
      </main>

      {/* Create */}
      <Dialog open={createParent !== undefined} onOpenChange={(o) => !o && setCreateParent(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nová složka</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nadřazená složka</Label>
              <div className="rounded border px-3 py-2 text-sm">
                {createParent
                  ? pathOf(folders.find((f) => f.id === createParent)!)
                  : "Kořen"}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Název</Label>
              <Input value={createName} onChange={(e) => setCreateName(e.target.value)} autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateParent(undefined)}>
              Zrušit
            </Button>
            <Button
              disabled={saving || !createName.trim()}
              onClick={async () => {
                const ok = await runAction(
                  { action: "create", name: createName.trim(), parentId: createParent ?? null },
                  "Složka vytvořena",
                );
                if (ok) setCreateParent(undefined);
              }}
            >
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Vytvořit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Přejmenovat složku</DialogTitle>
          </DialogHeader>
          <Input value={renameName} onChange={(e) => setRenameName(e.target.value)} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Zrušit
            </Button>
            <Button
              disabled={saving || !renameName.trim()}
              onClick={async () => {
                const ok = await runAction(
                  { action: "rename", id: renameTarget!.id, name: renameName.trim() },
                  "Složka přejmenována",
                );
                if (ok) setRenameTarget(null);
              }}
            >
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Uložit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move */}
      <Dialog open={!!moveTarget} onOpenChange={(o) => !o && setMoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Přesunout „{moveTarget?.name}“</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nová nadřazená složka</Label>
            <Select value={moveParent} onValueChange={setMoveParent}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ROOT}>Kořen</SelectItem>
                {moveOptions.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {pathOf(f)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveTarget(null)}>
              Zrušit
            </Button>
            <Button
              disabled={saving}
              onClick={async () => {
                const ok = await runAction(
                  {
                    action: "move",
                    id: moveTarget!.id,
                    parentId: moveParent === ROOT ? null : moveParent,
                  },
                  "Složka přesunuta",
                );
                if (ok) setMoveTarget(null);
              }}
            >
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Přesunout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FolderManager;

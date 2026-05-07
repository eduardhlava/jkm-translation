import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  AppSettings,
  LANGUAGES,
  NotionItem,
  langLabel,
  loadSettings,
  propContext,
  propExample,
  propStatus,
  propText,
} from "@/lib/translator";
import { t } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import jkLogo from "@/assets/jk-machinery-logo.png";
import {
  CheckCircle2,
  Check,
  ExternalLink,
  Info,
  Languages,
  Loader2,
  LogOut,
  Lock,
  RefreshCw,
  Save,
  Settings as SettingsIcon,
} from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

type LocalStatus = "new" | "translated";

const Index = () => {
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [sourceLang, setSourceLang] = useState<string>("cz");
  const [targetLang, setTargetLang] = useState<string>("en");
  const [helperLang, setHelperLang] = useState<string>("__none__");
  const [helperCtxLang, setHelperCtxLang] = useState<string>("__none__");
  const [contextLang, setContextLang] = useState<string>("cz");
  const [items, setItems] = useState<NotionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, LocalStatus>>({});
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [countBump, setCountBump] = useState(0);
  const [confirmPulse, setConfirmPulse] = useState<Record<string, number>>({});
  const [successFlash, setSuccessFlash] = useState(0);
  const [machineFilter, setMachineFilter] = useState<string>("__any__");
  const [loadedSnapshot, setLoadedSnapshot] = useState<string | null>(null);
  const [showReloadDialog, setShowReloadDialog] = useState(false);

  const MACHINE_PROP = "stroj";

  const ui = (profile?.ui_lang as typeof settings.uiLang | undefined) ?? settings.uiLang;

  useEffect(() => {
    document.title = t(ui, "pageTitle");
  }, [ui]);

  useEffect(() => {
    const handler = () => setSettings(loadSettings());
    window.addEventListener("translator-settings-changed", handler);
    window.addEventListener("focus", handler);
    return () => {
      window.removeEventListener("translator-settings-changed", handler);
      window.removeEventListener("focus", handler);
    };
  }, []);

  const sourceProp = propText(sourceLang);
  const targetProp = propText(targetLang);
  const helperProp = helperLang !== "__none__" ? propText(helperLang) : null;
  const ctxProp = propContext(contextLang);
  const exProp = propExample(contextLang);
  const helperCtxProp = helperCtxLang !== "__none__" ? propContext(helperCtxLang) : null;
  const helperExProp = helperCtxLang !== "__none__" ? propExample(helperCtxLang) : null;
  const stProp = propStatus(targetLang);

  const loadCount = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("notion-count", {
        body: { statusProperty: stProp, statusValue: settings.statusNew },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPendingCount((prev) => {
        if (prev !== data.count) setCountBump((b) => b + 1);
        return data.count as number;
      });
    } catch (err) {
      console.error("count failed", err);
      setPendingCount(null);
    }
  };

  // Load count whenever target language or settings change
  useEffect(() => {
    loadCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetLang, settings.statusNew]);

  // Compute a snapshot of settings that affect what's loaded
  const currentSnapshot = JSON.stringify({
    sourceLang,
    targetLang,
    helperLang,
    contextLang,
    helperCtxLang,
    pageSize: settings.pageSize,
    statusNew: settings.statusNew,
  });

  // When loaded settings differ from current ones, prompt user to reload
  useEffect(() => {
    if (items.length > 0 && loadedSnapshot && loadedSnapshot !== currentSnapshot) {
      setShowReloadDialog(true);
    }
  }, [currentSnapshot, items.length, loadedSnapshot]);

  const fetchItems = async () => {
    if (sourceLang === targetLang) {
      toast.error(t(ui, "sameLangError"));
      return;
    }
    setLoading(true);
    setStatusOverrides({});
    setTranslations({});
    try {
      const { data, error } = await supabase.functions.invoke("notion-fetch", {
        body: {
          statusProperty: stProp,
          statusValue: settings.statusNew,
          textProperties: [sourceProp, targetProp, ctxProp, exProp, stProp, MACHINE_PROP, ...(helperProp ? [helperProp] : []), ...(helperCtxProp ? [helperCtxProp] : []), ...(helperExProp ? [helperExProp] : [])],
          pageSize: settings.pageSize,
          sortProperty: sourceProp,
          sortDirection: "ascending",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const fetched = (data?.items ?? []) as NotionItem[];
      setItems(fetched);
      const initial: Record<string, string> = {};
      fetched.forEach((it) => {
        initial[it.id] = it.properties[targetProp] ?? "";
      });
      setTranslations(initial);
      setMachineFilter("__any__");
      setLoadedSnapshot(currentSnapshot);
      if (fetched.length === 0) toast.info(t(ui, "noNewItems"));
      else toast.success(t(ui, "loadedN", { n: fetched.length }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error";
      toast.error(t(ui, "loadFailed"), { description: msg });
    } finally {
      setLoading(false);
    }
  };

  const canEditTarget = isAdmin || (profile?.target_languages ?? []).includes(targetLang);

  const localStatus = (id: string): LocalStatus => statusOverrides[id] ?? "new";

  const toggleStatus = (id: string) => {
    if (!canEditTarget) return;
    setStatusOverrides((m) => ({
      ...m,
      [id]: m[id] === "translated" ? "new" : "translated",
    }));
    // Trigger pop animation by bumping a counter for this row
    setConfirmPulse((m) => ({ ...m, [id]: (m[id] ?? 0) + 1 }));
  };

  const toUpdate = useMemo(
    () => (canEditTarget ? items.filter((it) => localStatus(it.id) === "translated") : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, statusOverrides, canEditTarget],
  );

  const splitMachines = (raw: string): string[] =>
    raw
      .split(/[\u0001,]/)
      .map((s) => s.trim())
      .filter(Boolean);

  const machineOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      splitMachines(it.properties[MACHINE_PROP] ?? "").forEach((v) => set.add(v));
    });
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base", numeric: true }),
    );
  }, [items]);

  const sortedItems = useMemo(
    () =>
      [...items]
        .filter((it) => {
          if (machineFilter === "__any__") return true;
          return splitMachines(it.properties[MACHINE_PROP] ?? "").includes(machineFilter);
        })
        .sort((a, b) =>
          (a.properties[sourceProp] ?? "").localeCompare(
            b.properties[sourceProp] ?? "",
            undefined,
            { sensitivity: "base", numeric: true },
          ),
        ),
    [items, sourceProp, machineFilter],
  );

  const handleUpdate = async () => {
    if (toUpdate.length === 0) {
      toast.info(t(ui, "noConfirmed"));
      return;
    }
    setSaving(true);
    try {
      const updates = toUpdate.map((it) => ({
        pageId: it.id,
        updates: {
          [stProp]: settings.statusReview,
          [targetProp]: translations[it.id] ?? "",
        },
      }));
      const { data, error } = await supabase.functions.invoke("notion-bulk-update", {
        body: { updates },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error);

      const okCount = data?.okCount ?? toUpdate.length;
      toast.success(t(ui, "updatedNofM", { ok: okCount, total: toUpdate.length }));
      setSuccessFlash((n) => n + 1);
      await Promise.all([fetchItems(), loadCount()]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error";
      toast.error(t(ui, "updateFailed"), { description: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container max-w-[105rem] py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={jkLogo}
              alt="JK Machinery"
              className="h-9 w-auto"
              loading="lazy"
            />
            <div className="h-8 w-px bg-border" />
            <div>
              <h1 className="font-semibold leading-tight">{t(ui, "appName")}</h1>
              <p className="text-xs text-muted-foreground">{t(ui, "appTagline")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {(profile?.full_name?.trim() || profile?.email) && (
              <div className="text-sm text-right leading-tight hidden sm:block">
                {profile?.full_name?.trim() && (
                  <div className="font-medium">{profile.full_name}</div>
                )}
                <div className="text-xs text-muted-foreground">{profile?.email}</div>
              </div>
            )}
            {isAdmin && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/settings">
                  <SettingsIcon className="w-4 h-4 mr-1" /> {t(ui, "settings")}
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
              <LogOut className="w-4 h-4 mr-1" /> {t(ui, "signOut")}
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-[105rem] py-6 space-y-4">
        <Card className="p-4 flex flex-wrap items-end gap-4 shadow-[var(--shadow-md)]">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t(ui, "sourceLang")}</label>
            <Select value={sourceLang} onValueChange={setSourceLang}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t(ui, "targetLang")}</label>
            <Select value={targetLang} onValueChange={setTargetLang}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.filter((l) => l.code !== sourceLang).map((l) => {
                  const allowed = isAdmin || (profile?.target_languages ?? []).includes(l.code);
                  return (
                    <SelectItem key={l.code} value={l.code}>
                      <span className="inline-flex items-center gap-2">
                        {l.label}
                        {allowed && <Check className="w-3.5 h-3.5 text-success" />}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t(ui, "helperLang")}</label>
            <Select value={helperLang} onValueChange={setHelperLang}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t(ui, "noneOption")}</SelectItem>
                {LANGUAGES.filter((l) => l.code !== sourceLang && l.code !== targetLang).map((l) => (
                  <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t(ui, "contextLang")}</label>
            <Select value={contextLang} onValueChange={setContextLang}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t(ui, "helperContextLang")}</label>
            <Select value={helperCtxLang} onValueChange={setHelperCtxLang}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t(ui, "noneOption")}</SelectItem>
                {LANGUAGES.filter((l) => l.code !== contextLang).map((l) => (
                  <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>


          <div className="flex-1" />

          <div className="flex flex-col items-end gap-2">
            {pendingCount !== null && (
              <div
                key={countBump}
                className="animate-count-bump text-sm self-end"
              >
                <span className="text-muted-foreground">{t(ui, "remainingToTranslate")}: </span>
                <span className="font-semibold text-primary tabular-nums">{pendingCount}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button onClick={fetchItems} disabled={loading} variant="outline" className="gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {t(ui, "loadN", { n: settings.pageSize })}
              </Button>
              <Button
                key={`update-${successFlash}`}
                onClick={handleUpdate}
                disabled={saving || toUpdate.length === 0}
                className={`gap-2 rounded-md ${successFlash > 0 ? "animate-success-flash" : ""}`}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t(ui, "updateBtn", { n: toUpdate.length })}
              </Button>
            </div>
          </div>
        </Card>

        {items.length === 0 && !loading && (
          <Card className="p-12 flex flex-col items-center gap-3 text-center text-muted-foreground">
            <CheckCircle2 className="w-10 h-10 text-success" />
            <p>{t(ui, "noItems")}</p>
          </Card>
        )}

        {items.length > 0 && (
          <Card className="overflow-hidden shadow-[var(--shadow-md)] rounded-xl">
            <div className="overflow-x-auto">
              <TooltipProvider delayDuration={150}>
              <Table>
                <TableHeader className="bg-muted/70">
                  <TableRow className="border-b-2 border-border">
                    <TableHead className="w-[14%] text-foreground font-semibold uppercase tracking-wide text-xs py-3 bg-primary/5">
                      <Badge className="bg-accent text-accent-foreground mr-2">{langLabel(sourceLang)}</Badge>
                      {t(ui, "sourceCol")}
                    </TableHead>
                    <TableHead className="w-[18%] text-foreground font-semibold uppercase tracking-wide text-xs py-3 bg-primary/5">
                      <Badge className="bg-primary/10 text-primary mr-2">{langLabel(targetLang)}</Badge>
                      {t(ui, "translationCol")}
                      {!canEditTarget && (
                        <Lock className="inline w-3 h-3 ml-1 text-muted-foreground" />
                      )}
                    </TableHead>
                    <TableHead className="w-[12%] text-foreground font-semibold uppercase tracking-wide text-xs py-3 bg-primary/5">{t(ui, "contextCol")} ({langLabel(contextLang)})</TableHead>
                    <TableHead className="w-[14%] text-foreground font-semibold uppercase tracking-wide text-xs py-3 bg-primary/5">{t(ui, "exampleCol")} ({langLabel(contextLang)})</TableHead>
                    {helperProp && (
                      <TableHead className="w-[12%] text-foreground font-semibold uppercase tracking-wide text-xs py-3">
                        <Badge className="bg-secondary text-secondary-foreground mr-2">{langLabel(helperLang)}</Badge>
                        {t(ui, "helperCol")}
                      </TableHead>
                    )}
                    {helperCtxProp && (
                      <TableHead className="w-[10%] text-foreground font-semibold uppercase tracking-wide text-xs py-3">{t(ui, "helperContextCol")} ({langLabel(helperCtxLang)})</TableHead>
                    )}
                    {helperExProp && (
                      <TableHead className="w-[12%] text-foreground font-semibold uppercase tracking-wide text-xs py-3">{t(ui, "helperExampleCol")} ({langLabel(helperCtxLang)})</TableHead>
                    )}
                    <TableHead className="w-[12%] text-foreground font-semibold uppercase tracking-wide text-xs py-3 align-top">
                      <div className="space-y-1.5">
                        <div>{t(ui, "machineCol")}</div>
                        <Select value={machineFilter} onValueChange={setMachineFilter}>
                          <SelectTrigger className="h-7 text-xs normal-case font-normal"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__any__">{t(ui, "anyMachine")}</SelectItem>
                            {machineOptions.map((m) => (
                              <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableHead>
                    <TableHead className="w-[10%] text-foreground font-semibold uppercase tracking-wide text-xs py-3">{t(ui, "statusCol")}</TableHead>
                    {isAdmin && <TableHead className="w-[6%]" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedItems.map((it) => {
                    const st = localStatus(it.id);
                    return (
                      <TableRow key={it.id}>
                        <TableCell className="align-top whitespace-pre-wrap text-sm bg-primary/5">
                          {it.properties[sourceProp] || (
                            <span className="text-muted-foreground italic">—</span>
                          )}
                        </TableCell>
                        <TableCell className="align-top bg-primary/5">
                          <Textarea
                            value={translations[it.id] ?? ""}
                            onChange={(e) =>
                              setTranslations((m) => ({ ...m, [it.id]: e.target.value }))
                            }
                            placeholder={t(ui, "translationPlaceholder", { lang: langLabel(targetLang) })}
                            className={`min-h-[64px] text-sm ${!canEditTarget ? "text-muted-foreground bg-muted/40 cursor-not-allowed" : ""}`}
                            readOnly={!canEditTarget}
                            title={!canEditTarget ? t(ui, "readOnlyTranslation") : undefined}
                          />
                        </TableCell>
                        <TableCell className="align-top whitespace-pre-wrap text-xs text-muted-foreground bg-primary/5">
                          {it.properties[ctxProp] || "—"}
                        </TableCell>
                        <TableCell className="align-top whitespace-pre-wrap text-xs text-muted-foreground bg-primary/5">
                          {it.properties[exProp] || "—"}
                        </TableCell>
                        {helperProp && (
                          <TableCell className="align-top whitespace-pre-wrap text-sm text-muted-foreground">
                            {it.properties[helperProp] || (
                              <span className="text-muted-foreground italic">—</span>
                            )}
                          </TableCell>
                        )}
                        {helperCtxProp && (
                          <TableCell className="align-top whitespace-pre-wrap text-xs text-muted-foreground">
                            {it.properties[helperCtxProp] || "—"}
                          </TableCell>
                        )}
                        {helperExProp && (
                          <TableCell className="align-top whitespace-pre-wrap text-xs text-muted-foreground">
                            {it.properties[helperExProp] || "—"}
                          </TableCell>
                        )}
                        <TableCell className="align-top text-sm">
                          {(() => {
                            const list = splitMachines(it.properties[MACHINE_PROP] ?? "");
                            if (list.length === 0)
                              return <span className="text-muted-foreground italic">—</span>;
                            const visible = list.slice(0, 3);
                            const hasMore = list.length > 3;
                            return (
                              <div className="flex flex-wrap items-center gap-1">
                                {visible.map((m) => (
                                  <Badge key={m} variant="secondary" className="text-[10px] font-normal px-1.5 py-0 leading-tight">
                                    {m}
                                  </Badge>
                                ))}
                                {hasMore && (
                                  <>
                                    <span className="text-muted-foreground text-xs">…</span>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button type="button" className="text-muted-foreground hover:text-primary inline-flex items-center">
                                          <Info className="w-3.5 h-3.5" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs">
                                        <div className="text-xs font-medium mb-1">{t(ui, "allMachinesTitle")}</div>
                                        <div className="flex flex-wrap gap-1">
                                          {list.map((m) => (
                                            <Badge key={m} variant="secondary" className="text-[10px] font-normal px-1.5 py-0 leading-tight">
                                              {m}
                                            </Badge>
                                          ))}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </>
                                )}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="align-top">
                          <Button
                            key={`btn-${it.id}-${confirmPulse[it.id] ?? 0}`}
                            variant={st === "translated" ? "default" : "outline"}
                            size="sm"
                            onClick={() => toggleStatus(it.id)}
                            disabled={!canEditTarget}
                            className={`w-full transition-colors ${confirmPulse[it.id] ? "animate-confirm-pop" : ""} ${st === "translated" ? "bg-success text-success-foreground hover:bg-success/90" : ""}`}
                          >
                            {st === "translated" ? (
                              <><CheckCircle2 className="w-4 h-4 mr-1" />{t(ui, "translated")}</>
                            ) : (
                              t(ui, "confirm")
                            )}
                          </Button>
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="align-top">
                            <a
                              href={it.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-muted-foreground hover:text-primary inline-flex items-center"
                              title={t(ui, "openInNotion")}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </TooltipProvider>
            </div>
          </Card>
        )}
      </main>

      <AlertDialog open={showReloadDialog} onOpenChange={setShowReloadDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t(ui, "reloadPromptTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(ui, "reloadPromptDesc", { n: settings.pageSize })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowReloadDialog(false)}>
              {t(ui, "cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowReloadDialog(false);
                fetchItems();
              }}
            >
              {t(ui, "reloadConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Index;

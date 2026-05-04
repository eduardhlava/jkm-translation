import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { LANGUAGES } from "@/lib/translator";
import { UI_LANGUAGES, UiLang, t } from "@/lib/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface UserRow {
  user_id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  is_admin: boolean;
  is_super_admin: boolean;
  target_languages: string[];
  ui_lang: string;
}

interface FormState {
  user_id?: string;
  email: string;
  full_name: string;
  password: string;
  is_active: boolean;
  is_admin: boolean;
  is_super_admin: boolean;
  target_languages: string[];
  ui_lang: string;
}

const empty: FormState = {
  email: "",
  full_name: "",
  password: "",
  is_active: true,
  is_admin: false,
  is_super_admin: false,
  target_languages: [],
  ui_lang: "cz",
};

export default function UsersAdmin({ ui }: { ui: UiLang }) {
  const [items, setItems] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "list" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setItems(data.items as UserRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (u: UserRow) => {
    setForm({
      user_id: u.user_id,
      email: u.email,
      full_name: u.full_name ?? "",
      password: "",
      is_active: u.is_active,
      is_admin: u.is_admin,
      is_super_admin: u.is_super_admin,
      target_languages: u.target_languages ?? [],
      ui_lang: u.ui_lang ?? "cz",
    });
    setOpen(true);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const action = form.user_id ? "update" : "create";
      const body: Record<string, unknown> = {
        action,
        email: form.email,
        is_active: form.is_active,
        is_admin: form.is_admin,
        target_languages: form.target_languages,
        ui_lang: form.ui_lang,
      };
      if (form.user_id) body.user_id = form.user_id;
      if (form.password) body.password = form.password;
      const { data, error } = await supabase.functions.invoke("admin-users", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(t(ui, form.user_id ? "userSaved" : "userCreated"));
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (u: UserRow) => {
    if (u.is_super_admin) return;
    if (!confirm(t(ui, "confirmDelete"))) return;
    try {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "delete", user_id: u.user_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(t(ui, "userDeleted"));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  const toggleLang = (code: string) => {
    setForm((f) => ({
      ...f,
      target_languages: f.target_languages.includes(code)
        ? f.target_languages.filter((c) => c !== code)
        : [...f.target_languages, code],
    }));
  };

  return (
    <Card className="p-6 space-y-4 shadow-[var(--shadow-md)]">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t(ui, "users")}</h2>
        <Button onClick={openNew} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" />
          {t(ui, "newUser")}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((u) => (
            <div
              key={u.user_id}
              className="flex items-center justify-between gap-3 p-3 rounded-md border bg-background"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate flex items-center gap-2">
                  {u.email}
                  {u.is_admin && (
                    <Badge variant="secondary" className="text-xs">
                      {t(ui, "isAdmin")}
                    </Badge>
                  )}
                  {!u.is_active && (
                    <Badge variant="destructive" className="text-xs">
                      {t(ui, "isActive")}: ✗
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {u.target_languages.length > 0
                    ? u.target_languages.join(", ")
                    : "—"}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => openEdit(u)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => remove(u)}
                disabled={u.is_super_admin}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {form.user_id ? t(ui, "editUser") : t(ui, "newUser")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t(ui, "email")}</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                {form.user_id ? t(ui, "passwordOptional") : t(ui, "password")}
              </Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                autoComplete="new-password"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="active"
                checked={form.is_active}
                disabled={form.is_super_admin}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, is_active: Boolean(v) }))
                }
              />
              <Label htmlFor="active" className="cursor-pointer">
                {t(ui, "isActive")}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="admin"
                checked={form.is_admin}
                disabled={form.is_super_admin}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, is_admin: Boolean(v) }))
                }
              />
              <Label htmlFor="admin" className="cursor-pointer">
                {t(ui, "isAdmin")}
              </Label>
            </div>
            <div className="space-y-1.5">
              <Label>{t(ui, "targetLangs")}</Label>
              <p className="text-xs text-muted-foreground">{t(ui, "targetLangsHint")}</p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {LANGUAGES.map((l) => (
                  <label
                    key={l.code}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={form.target_languages.includes(l.code)}
                      onCheckedChange={() => toggleLang(l.code)}
                    />
                    {l.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t(ui, "uiLanguage")}</Label>
              <Select
                value={form.ui_lang}
                onValueChange={(v) => setForm((f) => ({ ...f, ui_lang: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UI_LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              {t(ui, "cancel")}
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {form.user_id ? t(ui, "saveUser") : t(ui, "createUser")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

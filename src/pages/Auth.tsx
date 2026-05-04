import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Languages, Loader2 } from "lucide-react";
import { loadSettings } from "@/lib/translator";
import { t } from "@/lib/i18n";
import jkLogo from "@/assets/jk-machinery-logo.png";

const VITE_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const VITE_SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const Auth = () => {
  const navigate = useNavigate();
  const ui = loadSettings().uiLang;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = `${t(ui, "loginTitle")} – ${t(ui, "appName")}`;
    // Bootstrap super admin (idempotent)
    fetch(`${VITE_SUPABASE_URL}/functions/v1/admin-users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: VITE_SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ action: "bootstrap" }),
    }).catch(() => {});
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/", { replace: true });
    });
  }, [navigate, ui]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Verify active
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("user_id", data.user!.id)
        .maybeSingle();
      if (profile && profile.is_active === false) {
        await supabase.auth.signOut();
        throw new Error(t(ui, "accountInactive"));
      }
      toast.success(t(ui, "signIn"));
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(t(ui, "loginFailed"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)] flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-[var(--shadow-lg)]">
        <div className="flex justify-center mb-6">
          <img src={jkLogo} alt="JK Machinery" className="h-14 w-auto" />
        </div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-[var(--gradient-hero)] flex items-center justify-center">
            <Languages className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold leading-tight">{t(ui, "loginTitle")}</h1>
            <p className="text-xs text-muted-foreground">{t(ui, "loginSubtitle")}</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t(ui, "email")}</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <Label>{t(ui, "password")}</Label>
            <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <Button type="submit" className="w-full gap-2" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {t(ui, "signIn")}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default Auth;

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export interface AuthProfile {
  user_id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  target_languages: string[];
  ui_lang: string;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
  isAdmin: boolean;
  loading: boolean;
}

export function useAuth(): AuthState & { refresh: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    isAdmin: false,
    loading: true,
  });

  const loadProfile = async (user: User | null) => {
    if (!user) {
      setState({ session: null, user: null, profile: null, isAdmin: false, loading: false });
      return;
    }
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("user_id,email,is_active,target_languages,ui_lang").eq("user_id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    setState((s) => ({
      ...s,
      user,
      profile: profile as AuthProfile | null,
      isAdmin,
      loading: false,
    }));
  };

  const refresh = async () => {
    const { data } = await supabase.auth.getSession();
    setState((s) => ({ ...s, session: data.session, loading: true }));
    await loadProfile(data.session?.user ?? null);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((s) => ({ ...s, session }));
      // Defer DB calls to avoid deadlocks
      setTimeout(() => loadProfile(session?.user ?? null), 0);
    });
    supabase.auth.getSession().then(({ data }) => {
      setState((s) => ({ ...s, session: data.session }));
      loadProfile(data.session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { ...state, refresh };
}

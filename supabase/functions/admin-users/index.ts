// Admin-only user management. Uses service role to manage auth users + profiles + roles.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPER_ADMIN_EMAIL = "eduard@hlava.net";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function ensureSuperAdmin(admin: ReturnType<typeof createClient>) {
  // Check if eduard exists
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  let user = list?.users.find((u) => u.email?.toLowerCase() === SUPER_ADMIN_EMAIL);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: SUPER_ADMIN_EMAIL,
      password: "JKMchest75",
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user!;
  }
  // Ensure profile active
  await admin.from("profiles").upsert(
    { user_id: user.id, email: SUPER_ADMIN_EMAIL, is_active: true },
    { onConflict: "user_id" },
  );
  // Ensure admin role
  await admin.from("user_roles").upsert(
    { user_id: user.id, role: "admin" },
    { onConflict: "user_id,role" },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    // Bootstrap is open (idempotent — only creates eduard if missing)
    if (action === "bootstrap") {
      await ensureSuperAdmin(admin);
      return json({ ok: true });
    }

    // All other actions require an authenticated admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const caller = userRes.user;
    if (!caller) return json({ error: "Unauthorized" }, 401);

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    if (action === "list") {
      const { data: profiles, error: pErr } = await admin
        .from("profiles")
        .select("user_id, email, full_name, is_active, target_languages, ui_lang, created_at")
        .order("email");
      if (pErr) throw pErr;
      const { data: rolesAll, error: rErr } = await admin
        .from("user_roles")
        .select("user_id, role");
      if (rErr) throw rErr;
      const roleMap = new Map<string, string[]>();
      (rolesAll ?? []).forEach((r) => {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role);
        roleMap.set(r.user_id, arr);
      });
      const items = (profiles ?? []).map((p) => ({
        ...p,
        is_admin: (roleMap.get(p.user_id) ?? []).includes("admin"),
        is_super_admin: p.email === SUPER_ADMIN_EMAIL,
      }));
      return json({ items });
    }

    if (action === "create") {
      const { email, password, is_admin, is_active, target_languages, ui_lang, full_name } = body;
      if (!email || !password) return json({ error: "email a heslo jsou povinné" }, 400);
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (cErr) throw cErr;
      const uid = created.user!.id;
      await admin.from("profiles").upsert(
        {
          user_id: uid,
          email,
          full_name: full_name ?? "",
          is_active: is_active ?? true,
          target_languages: target_languages ?? [],
          ui_lang: ui_lang ?? "cz",
        },
        { onConflict: "user_id" },
      );
      if (is_admin) {
        await admin.from("user_roles").upsert(
          { user_id: uid, role: "admin" },
          { onConflict: "user_id,role" },
        );
      }
      return json({ ok: true, user_id: uid });
    }

    if (action === "update") {
      const { user_id, email, password, is_admin, is_active, target_languages, ui_lang, full_name } = body;
      if (!user_id) return json({ error: "user_id required" }, 400);

      const { data: existing } = await admin
        .from("profiles")
        .select("email")
        .eq("user_id", user_id)
        .maybeSingle();
      const isSuper = existing?.email === SUPER_ADMIN_EMAIL;

      const profilePatch: Record<string, unknown> = {};
      if (typeof email === "string") profilePatch.email = email;
      if (typeof full_name === "string") profilePatch.full_name = full_name;
      if (typeof is_active === "boolean")
        profilePatch.is_active = isSuper ? true : is_active;
      if (Array.isArray(target_languages)) profilePatch.target_languages = target_languages;
      if (typeof ui_lang === "string") profilePatch.ui_lang = ui_lang;
      if (Object.keys(profilePatch).length > 0) {
        const { error } = await admin
          .from("profiles")
          .update(profilePatch)
          .eq("user_id", user_id);
        if (error) throw error;
      }

      const authPatch: Record<string, unknown> = {};
      if (typeof email === "string") authPatch.email = email;
      if (typeof password === "string" && password.length > 0) authPatch.password = password;
      if (Object.keys(authPatch).length > 0) {
        const { error } = await admin.auth.admin.updateUserById(user_id, authPatch);
        if (error) throw error;
      }

      if (typeof is_admin === "boolean") {
        if (is_admin) {
          await admin
            .from("user_roles")
            .upsert({ user_id, role: "admin" }, { onConflict: "user_id,role" });
        } else if (!isSuper) {
          await admin.from("user_roles").delete().eq("user_id", user_id).eq("role", "admin");
        }
      }
      return json({ ok: true });
    }

    if (action === "delete") {
      const { user_id } = body;
      if (!user_id) return json({ error: "user_id required" }, 400);
      const { data: existing } = await admin
        .from("profiles")
        .select("email")
        .eq("user_id", user_id)
        .maybeSingle();
      if (existing?.email === SUPER_ADMIN_EMAIL)
        return json({ error: "Hlavního administrátora nelze smazat" }, 400);
      const { error } = await admin.auth.admin.deleteUser(user_id);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

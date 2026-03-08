import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Verify caller is admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleData) return new Response("Forbidden", { status: 403, headers: corsHeaders });

  const { action, ...params } = await req.json();

  if (action === "list_users") {
    // Get all users from auth
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 500 });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Get all subscriptions
    const { data: subs } = await supabase.from("subscriptions").select("*").eq("active", true);
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: roles } = await supabase.from("user_roles").select("*");

    const enriched = users.map((u: any) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      profile: profiles?.find((p: any) => p.user_id === u.id),
      subscription: subs?.find((s: any) => s.user_id === u.id),
      roles: roles?.filter((r: any) => r.user_id === u.id).map((r: any) => r.role) || [],
    }));

    return new Response(JSON.stringify(enriched), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (action === "update_subscription") {
    const { user_id, plan, daily_limit, price, is_trial, trial_ends_at, expires_at } = params;
    const { error } = await supabase
      .from("subscriptions")
      .update({ plan, daily_limit, price, is_trial, trial_ends_at, expires_at })
      .eq("user_id", user_id)
      .eq("active", true);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  if (action === "set_admin") {
    const { target_user_id, is_admin } = params;
    if (is_admin) {
      await supabase.from("user_roles").upsert({ user_id: target_user_id, role: "admin" }, { onConflict: "user_id,role" });
    } else {
      await supabase.from("user_roles").delete().eq("user_id", target_user_id).eq("role", "admin");
    }
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

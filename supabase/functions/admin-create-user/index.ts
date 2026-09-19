import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedRoles = new Set([
  "ADMIN",
  "SOC_LEAD",
  "SOC_ANALYST_L1",
  "SOC_ANALYST_L2",
  "SOC_ANALYST_L3",
]);

const staffEmailPattern = /^[A-Z0-9._%+-]+@ccorp\.local$/i;
const strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = req.headers.get("Authorization");

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile, error: profileError } = await adminClient
      .from("users")
      .select("role_id")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role_id !== "ADMIN") {
      return new Response(JSON.stringify({ error: "Administrator access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const name = String(body?.name ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const roleId = String(body?.role_id ?? "");

    if (!name || !staffEmailPattern.test(email) || !allowedRoles.has(roleId)) {
      return new Response(JSON.stringify({
        error: "A valid CCorp staff email, name, and role are required",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!strongPasswordPattern.test(password)) {
      return new Response(JSON.stringify({
        error: "Temporary password must be at least 12 characters and include upper, lower, number, and symbol",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (createError || !created.user) {
      return new Response(JSON.stringify({ error: createError?.message ?? "Unable to create user" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: profileUpdateError } = await adminClient
      .from("users")
      .upsert({
        id: created.user.id,
        email,
        name,
        role_id: roleId,
      });

    if (profileUpdateError) {
      await adminClient.auth.admin.deleteUser(created.user.id);
      return new Response(JSON.stringify({ error: "Unable to create the staff profile" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await adminClient.from("audit_log").insert({
      user_id: user.id,
      action: "USER_CREATED",
      details: `Staff account created: ${email} (${roleId})`,
    });

    return new Response(JSON.stringify({
      user: {
        id: created.user.id,
        email,
        name,
        role_id: roleId,
      },
    }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (_error) {
    return new Response(JSON.stringify({ error: "Unable to complete the request" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Edge function: resolves whether the current logged-in user should see a given notification list.
// Returns active notifications targeted at the caller (all / agents / panchayath).
// Also exposes admin endpoint to fetch analytics (per-panchayath/ward read counts).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizeMobile(raw: string): string {
  let s = String(raw || "").replace(/\D/g, "");
  if (s.startsWith("91") && s.length > 10) s = s.slice(2);
  s = s.replace(/^0+/, "");
  if (s.length > 10) s = s.slice(-10);
  return s;
}

async function isElifeAgent(mobile: string | null): Promise<boolean> {
  if (!mobile || mobile.length !== 10) return false;
  const elifeUrl = Deno.env.get("ELIFE_SUPABASE_URL");
  const elifeKey = Deno.env.get("ELIFE_SUPABASE_SERVICE_ROLE_KEY");
  if (!elifeUrl || !elifeKey) return false;
  const elife = createClient(elifeUrl, elifeKey);
  const variants = Array.from(new Set([mobile, `91${mobile}`, `0${mobile}`]));
  const probes = [
    { table: "pennyekart_agents", cols: ["mobile"] },
    { table: "members", cols: ["mobile", "mobile_number", "phone", "whatsapp_number"] },
  ];
  for (const p of probes) {
    for (const col of p.cols) {
      for (const v of variants) {
        const { data, error } = await elife.from(p.table).select("id").eq(col, v).limit(1);
        if (error) break;
        if (data && data.length) return true;
      }
    }
  }
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list";

    let userId: string | null = null;
    let profile: any = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
      userId = claims?.claims?.sub ?? null;
      if (userId) {
        const { data } = await sb
          .from("profiles")
          .select("user_id, mobile_number, local_body_id, ward_number, user_type")
          .eq("user_id", userId)
          .maybeSingle();
        profile = data;
      }
    }

    // ---------- ANALYTICS (admin only) ----------
    if (action === "analytics") {
      // Verify admin
      const { data: callerProfile } = await sb
        .from("profiles")
        .select("is_super_admin, role_id")
        .eq("user_id", userId ?? "")
        .maybeSingle();
      if (!callerProfile?.is_super_admin) {
        // soft check via role_permissions
        const { data: perms } = await sb
          .from("role_permissions")
          .select("permissions(name)")
          .eq("role_id", callerProfile?.role_id ?? "00000000-0000-0000-0000-000000000000");
        const ok = (perms ?? []).some((r: any) => r.permissions?.name === "read_settings");
        if (!ok) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const notificationId = url.searchParams.get("notification_id");
      if (!notificationId) {
        return new Response(JSON.stringify({ error: "notification_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: reads } = await sb
        .from("notification_reads")
        .select("user_id, delivered_at, read_at, clicked_at")
        .eq("notification_id", notificationId);

      const userIds = (reads ?? []).map((r) => r.user_id);
      let usersData: any[] = [];
      if (userIds.length) {
        const { data: profs } = await sb
          .from("profiles")
          .select("user_id, full_name, mobile_number, local_body_id, ward_number, user_type, is_super_admin, role_id, locations_local_bodies(name), roles(name)")
          .in("user_id", userIds);
        usersData = profs ?? [];
      }

      const userMap = new Map(usersData.map((u) => [u.user_id, u]));
      const enriched = (reads ?? []).map((r) => {
        const u: any = userMap.get(r.user_id) || {};
        const roleName = u.is_super_admin
          ? "Super Admin"
          : u.roles?.name || (u.user_type && u.user_type !== "customer" ? u.user_type : null);
        return {
          user_id: r.user_id,
          full_name: u.full_name,
          mobile_number: u.mobile_number,
          local_body_id: u.local_body_id,
          local_body_name: u.locations_local_bodies?.name ?? null,
          ward_number: u.ward_number,
          user_type: u.user_type ?? null,
          role_name: roleName,
          has_role: !!roleName,
          delivered_at: r.delivered_at,
          read_at: r.read_at,
          clicked_at: r.clicked_at,
        };
      });

      // Group by panchayath + ward
      const groups = new Map<string, any>();
      for (const e of enriched) {
        const key = `${e.local_body_name || "Unknown"}|${e.ward_number ?? "?"}`;
        if (!groups.has(key)) {
          groups.set(key, {
            local_body_name: e.local_body_name || "Unknown",
            ward_number: e.ward_number,
            delivered: 0,
            read: 0,
            clicked: 0,
          });
        }
        const g = groups.get(key);
        g.delivered++;
        if (e.read_at) g.read++;
        if (e.clicked_at) g.clicked++;
      }

      return new Response(
        JSON.stringify({
          totals: {
            delivered: enriched.length,
            read: enriched.filter((e) => e.read_at).length,
            clicked: enriched.filter((e) => e.clicked_at).length,
          },
          byPanchayath: Array.from(groups.values()),
          users: enriched,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------- LIST notifications for caller ----------
    if (!userId || !profile) {
      return new Response(JSON.stringify({ notifications: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all active notifications
    const { data: allNotifs } = await sb
      .from("notifications")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(50);

    // Resolve agent status only if we have agent-targeted notifications
    const hasAgentTargeted = (allNotifs ?? []).some((n) => n.target_audience === "agents");
    let agentStatus = false;
    if (hasAgentTargeted && profile.mobile_number) {
      const mobile = normalizeMobile(profile.mobile_number);
      agentStatus = await isElifeAgent(mobile);
    }

    const matched = (allNotifs ?? []).filter((n) => {
      if (n.target_audience === "all") return true;
      if (n.target_audience === "agents") return agentStatus;
      if (n.target_audience === "panchayath") {
        const ids: string[] = n.target_local_body_ids || [];
        return profile.local_body_id && ids.includes(profile.local_body_id);
      }
      return false;
    });

    // Get existing read records for this user
    const ids = matched.map((n) => n.id);
    let reads: any[] = [];
    if (ids.length) {
      const { data: r } = await sb
        .from("notification_reads")
        .select("notification_id, read_at, clicked_at, delivered_at")
        .eq("user_id", userId)
        .in("notification_id", ids);
      reads = r ?? [];
    }

    // Auto-create delivered records (best-effort)
    const existingIds = new Set(reads.map((r) => r.notification_id));
    const toCreate = ids.filter((id) => !existingIds.has(id));
    if (toCreate.length) {
      await sb.from("notification_reads").insert(
        toCreate.map((nid) => ({ notification_id: nid, user_id: userId }))
      );
    }

    const readMap = new Map(reads.map((r) => [r.notification_id, r]));
    const result = matched.map((n) => ({
      ...n,
      read_at: readMap.get(n.id)?.read_at ?? null,
      clicked_at: readMap.get(n.id)?.clicked_at ?? null,
    }));

    return new Response(JSON.stringify({ notifications: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notifications-resolve error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Temporary probe — public, returns columns + 1 sample for given tables
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = Deno.env.get("ELIFE_SUPABASE_URL");
  const key = Deno.env.get("ELIFE_SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return new Response(JSON.stringify({ error: "no creds" }), { status: 500, headers: corsHeaders });

  const tables = ["pennyekart_agents", "agent_work_logs"];
  const out: Record<string, any> = {};
  for (const t of tables) {
    try {
      const r = await fetch(`${url}/rest/v1/${t}?limit=2`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
      out[t] = { status: r.status, body: r.ok ? await r.json() : await r.text() };
    } catch (e) { out[t] = { error: String(e) }; }
  }
  // OpenAPI spec
  const spec = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }).then(r => r.json());
  const defs = spec.definitions ?? {};
  for (const t of tables) out[t].columns = Object.keys(defs[t]?.properties ?? {});
  return new Response(JSON.stringify(out, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

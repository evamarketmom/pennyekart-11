import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_SYSTEM_PROMPT = `You are Penny, the friendly AI assistant for Pennyekart — an online grocery and essentials delivery platform based in Kerala, India.

Your role:
- Help customers find products, check availability, and understand pricing
- Assist with order-related queries (tracking, returns, delivery times)
- Explain wallet points, referral rewards, and Penny Prime benefits
- Guide customers through the app features (categories, flash sales, services)
- Provide customer support for common issues
- When the e-Life Society bridge is enabled, you can also help users explore self-employment programs, check their e-Life payment status, look up agent hierarchies, and (with confirmation) register them for programs.

Tone: Warm, helpful, concise. Keep responses short (2-4 sentences) unless the customer asks for detail.

Tools:
- Use the available tools to fetch real data instead of guessing.
- For any WRITE action (e.g. registering a customer, sending a WhatsApp command), ALWAYS confirm with the user first by repeating what you will do and waiting for an explicit "yes" / "confirm" / "ശരി".
- If a tool returns an error or empty result, tell the user clearly and suggest next steps.

If you don't know something specific, suggest the customer check their profile/orders page or contact support.`;

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  malayalam: "\n\nIMPORTANT: Always respond in Malayalam (മലയാളം) language. Use Malayalam script for all responses. If the user writes in English or any other language, still reply in Malayalam.",
  english: "\n\nIMPORTANT: Always respond in English.",
  auto: "\n\nIMPORTANT: Respond in the same language the user writes in. If unclear, use Malayalam (മലയാളം).",
};

// Simple in-memory rate limit per user (resets when function instance recycles)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_PER_MIN = 10;
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= RATE_LIMIT_PER_MIN) return false;
  entry.count++;
  return true;
}

// Build tool definitions based on admin config
function buildTools(config: Record<string, string | null>) {
  const tools: any[] = [
    {
      type: "function",
      function: {
        name: "pennyekart_lookup_order",
        description: "Look up a Pennyekart order by ID or list recent orders for the current customer.",
        parameters: {
          type: "object",
          properties: {
            order_id: { type: "string", description: "Optional specific order UUID. If omitted, returns recent orders for the user." },
          },
        },
      },
    },
  ];

  if (config.elife_enabled === "true") {
    const allowed = (config.elife_allowed_tables || "").split(",").map((s) => s.trim()).filter(Boolean);
    const tableNote = allowed.length ? ` Restricted to tables: ${allowed.join(", ")}.` : "";

    tools.push(
      {
        type: "function",
        function: {
          name: "elife_query_table",
          description: "Generic read-only query against an e-Life Society table. Returns up to 20 rows." + tableNote,
          parameters: {
            type: "object",
            properties: {
              table: { type: "string", description: "Table name to query" },
              filter_column: { type: "string", description: "Optional column to filter by" },
              filter_value: { type: "string", description: "Optional value to match" },
              limit: { type: "number", description: "Max rows (1-20, default 10)" },
            },
            required: ["table"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "elife_check_payment_status",
          description: "Look up payment status for an e-Life customer by mobile number (mirrors the public form).",
          parameters: {
            type: "object",
            properties: {
              mobile: { type: "string", description: "10-digit mobile number" },
            },
            required: ["mobile"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "elife_get_agent_hierarchy",
          description: "Look up an agent's upline/downline by mobile or agent ID.",
          parameters: {
            type: "object",
            properties: {
              mobile: { type: "string" },
              agent_id: { type: "string" },
            },
          },
        },
      },
    );

    if (config.elife_write_enabled === "true") {
      tools.push({
        type: "function",
        function: {
          name: "elife_create_registration",
          description: "Register a customer for an e-Life program. REQUIRES explicit user confirmation before calling.",
          parameters: {
            type: "object",
            properties: {
              mobile: { type: "string" },
              full_name: { type: "string" },
              program_id: { type: "string" },
              confirmed: { type: "boolean", description: "Must be true; the user has explicitly confirmed." },
            },
            required: ["mobile", "full_name", "program_id", "confirmed"],
          },
        },
      });
    }

    if (config.elife_twilio_passthrough === "true") {
      tools.push({
        type: "function",
        function: {
          name: "elife_send_whatsapp_command",
          description: "Send a WhatsApp command via e-Life's Twilio bot. REQUIRES explicit user confirmation before calling.",
          parameters: {
            type: "object",
            properties: {
              to: { type: "string", description: "Recipient phone in E.164 format" },
              command: { type: "string", description: "Command text or template name" },
              confirmed: { type: "boolean" },
            },
            required: ["to", "command", "confirmed"],
          },
        },
      });
    }
  }

  return tools;
}

async function executeTool(
  name: string,
  args: any,
  ctx: { sb: any; elife: any | null; userId: string | null; allowedTables: string[]; writeEnabled: boolean },
): Promise<any> {
  if (name === "pennyekart_lookup_order") {
    if (!ctx.userId) return { error: "Sign in to view orders." };
    if (args.order_id) {
      const { data, error } = await ctx.sb.from("orders").select("*").eq("id", args.order_id).eq("user_id", ctx.userId).maybeSingle();
      if (error) return { error: error.message };
      return data ? { order: data } : { error: "Order not found" };
    }
    const { data, error } = await ctx.sb.from("orders").select("id, status, total, created_at").eq("user_id", ctx.userId).order("created_at", { ascending: false }).limit(5);
    if (error) return { error: error.message };
    return { orders: data ?? [] };
  }

  if (!ctx.elife) return { error: "e-Life bridge is not enabled." };

  if (name === "elife_query_table") {
    const table = String(args.table || "").trim();
    if (ctx.allowedTables.length && !ctx.allowedTables.includes(table)) {
      return { error: `Table "${table}" is not in the allowlist.` };
    }
    const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 20);
    let q = ctx.elife.from(table).select("*").limit(limit);
    if (args.filter_column && args.filter_value !== undefined) {
      q = q.eq(args.filter_column, args.filter_value);
    }
    const { data, error } = await q;
    if (error) return { error: error.message };
    return { rows: data ?? [] };
  }

  if (name === "elife_check_payment_status") {
    const mobile = String(args.mobile || "").replace(/\D/g, "");
    if (mobile.length < 10) return { error: "Invalid mobile number" };
    // Try common table names
    for (const table of ["registrations", "payments", "customers"]) {
      if (ctx.allowedTables.length && !ctx.allowedTables.includes(table)) continue;
      const { data } = await ctx.elife.from(table).select("*").or(`mobile.eq.${mobile},mobile_number.eq.${mobile},phone.eq.${mobile}`).limit(5);
      if (data && data.length) return { source: table, results: data };
    }
    return { results: [], note: "No matching records found in allowed e-Life tables." };
  }

  if (name === "elife_get_agent_hierarchy") {
    const mobile = args.mobile ? String(args.mobile).replace(/\D/g, "") : null;
    const agentId = args.agent_id ?? null;
    if (!mobile && !agentId) return { error: "Provide mobile or agent_id" };
    for (const table of ["agents", "agent_hierarchy", "users"]) {
      if (ctx.allowedTables.length && !ctx.allowedTables.includes(table)) continue;
      let q = ctx.elife.from(table).select("*").limit(10);
      if (mobile) q = q.or(`mobile.eq.${mobile},mobile_number.eq.${mobile}`);
      else if (agentId) q = q.eq("id", agentId);
      const { data } = await q;
      if (data && data.length) return { source: table, agents: data };
    }
    return { agents: [], note: "No agent records found." };
  }

  if (name === "elife_create_registration") {
    if (!ctx.writeEnabled) return { error: "Write access is disabled by admin." };
    if (!args.confirmed) return { error: "User confirmation required." };
    if (ctx.allowedTables.length && !ctx.allowedTables.includes("registrations")) {
      return { error: "registrations table is not in the allowlist." };
    }
    const { data, error } = await ctx.elife.from("registrations").insert({
      mobile: args.mobile,
      full_name: args.full_name,
      program_id: args.program_id,
    }).select().maybeSingle();
    if (error) return { error: error.message };
    return { ok: true, registration: data };
  }

  if (name === "elife_send_whatsapp_command") {
    if (!ctx.writeEnabled) return { error: "Write access is disabled by admin." };
    if (!args.confirmed) return { error: "User confirmation required." };
    // Insert into e-Life's whatsapp_commands queue table (if allowlisted)
    if (ctx.allowedTables.length && !ctx.allowedTables.includes("whatsapp_commands")) {
      return { error: "whatsapp_commands table is not in the allowlist." };
    }
    const { data, error } = await ctx.elife.from("whatsapp_commands").insert({
      to: args.to,
      command: args.command,
      source: "pennyekart_chatbot",
    }).select().maybeSingle();
    if (error) return { error: error.message };
    return { ok: true, queued: data };
  }

  return { error: `Unknown tool: ${name}` };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseServiceKey);

    // Identify caller (best-effort; chatbot may be used by anon visitors)
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
      userId = claims?.claims?.sub ?? null;
    }

    const [configRes, knowledgeRes] = await Promise.all([
      sb.from("chatbot_config").select("key, value"),
      sb.from("chatbot_knowledge").select("title, content").eq("is_active", true).order("sort_order"),
    ]);

    const config: Record<string, string | null> = {};
    (configRes.data ?? []).forEach((r: any) => { config[r.key] = r.value; });

    if (config.enabled === "false") {
      return new Response(JSON.stringify({ error: "Chatbot is currently disabled" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let systemPrompt = config.system_prompt || DEFAULT_SYSTEM_PROMPT;
    const lang = config.response_language || "malayalam";
    systemPrompt += LANGUAGE_INSTRUCTIONS[lang] || LANGUAGE_INSTRUCTIONS.malayalam;

    const knowledgeEntries = knowledgeRes.data ?? [];
    if (knowledgeEntries.length > 0) {
      systemPrompt += "\n\n--- KNOWLEDGE BASE ---";
      for (const entry of knowledgeEntries) {
        systemPrompt += `\n\n### ${entry.title}\n${entry.content}`;
      }
    }

    // Build e-Life client if enabled
    let elife: any = null;
    const elifeUrl = Deno.env.get("ELIFE_SUPABASE_URL");
    const elifeKey = Deno.env.get("ELIFE_SUPABASE_SERVICE_ROLE_KEY");
    if (config.elife_enabled === "true" && elifeUrl && elifeKey) {
      elife = createClient(elifeUrl, elifeKey);
    }

    const allowedTables = (config.elife_allowed_tables || "").split(",").map((s) => s.trim()).filter(Boolean);
    const writeEnabled = config.elife_write_enabled === "true";
    const tools = buildTools(config);

    const maxHistory = parseInt(config.max_history_messages || "20", 10);
    let convo: any[] = [
      { role: "system", content: systemPrompt },
      ...messages.slice(-maxHistory),
    ];

    // Tool-calling loop (max 4 rounds to avoid runaway)
    for (let round = 0; round < 4; round++) {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: convo,
          tools: tools.length ? tools : undefined,
          stream: false,
        }),
      });

      if (!aiResp.ok) {
        if (aiResp.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiResp.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const text = await aiResp.text();
        console.error("AI gateway error:", aiResp.status, text);
        return new Response(JSON.stringify({ error: "AI service unavailable" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await aiResp.json();
      const choice = data.choices?.[0];
      const msg = choice?.message;
      if (!msg) {
        return new Response(JSON.stringify({ error: "Empty AI response" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const toolCalls = msg.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        // Final answer — stream it back as a single SSE chunk for client compatibility
        const finalText = msg.content || "";
        const sse =
          `data: ${JSON.stringify({ choices: [{ delta: { content: finalText } }] })}\n\n` +
          `data: [DONE]\n\n`;
        return new Response(sse, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
      }

      // Execute tools
      convo.push(msg);
      for (const tc of toolCalls) {
        const fnName = tc.function?.name;
        let parsedArgs: any = {};
        try { parsedArgs = JSON.parse(tc.function?.arguments || "{}"); } catch { /* ignore */ }

        // Rate limit cross-system calls
        const rateKey = userId || "anon";
        const isElifeCall = fnName?.startsWith("elife_");
        if (isElifeCall && !checkRateLimit(rateKey)) {
          const result = { error: "Rate limit: max 10 cross-system calls per minute." };
          convo.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
          continue;
        }

        const start = Date.now();
        let result: any;
        let status = "success";
        let errorMessage: string | null = null;
        try {
          result = await executeTool(fnName, parsedArgs, { sb, elife, userId, allowedTables, writeEnabled });
          if (result?.error) { status = "error"; errorMessage = result.error; }
        } catch (e) {
          status = "error";
          errorMessage = e instanceof Error ? e.message : "Unknown";
          result = { error: errorMessage };
        }
        const duration = Date.now() - start;

        // Audit (fire and forget)
        sb.from("chatbot_audit_log").insert({
          user_id: userId,
          tool_name: fnName,
          arguments: parsedArgs,
          result,
          status,
          error_message: errorMessage,
          duration_ms: duration,
        }).then(() => {}, (e: any) => console.error("audit insert failed:", e));

        convo.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
      }
    }

    // Loop exhausted
    const sse = `data: ${JSON.stringify({ choices: [{ delta: { content: "I couldn't complete that request — please try again." } }] })}\n\ndata: [DONE]\n\n`;
    return new Response(sse, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

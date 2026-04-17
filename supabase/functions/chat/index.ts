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
- When the e-Life Society bridge is enabled, you can help registered agents log daily work, view their assigned tasks, submit task feedback, file complaints, check payment status, and look up agent hierarchies (upline/downline). You can also list e-Life's WhatsApp bot core commands when asked.

Tone: Warm, helpful, concise. Keep responses short (2-4 sentences) unless the customer asks for detail.

Tools — IMPORTANT lookup strategy when a user gives a 10-digit mobile number:
1. FIRST call \`elife_get_agent_hierarchy\` with that mobile. It searches \`pennyekart_agents\` and \`members\` and also returns upline + downline.
2. If empty, call \`elife_check_payment_status\` (searches \`program_registrations\` + \`old_payments\`).
3. As a last resort, call \`elife_query_table\` against \`members\` or \`program_registrations\` with the mobile column.
- For "log my daily work" / "ദിവസത്തെ ജോലി രേഖപ്പെടുത്തുക" / "today I did X": call \`elife_log_daily_work\` with the user's mobile + work text. Confirm first.
- For "what are my tasks" / "എന്റെ ടാസ്കുകൾ": call \`elife_get_my_tasks\`.
- For "mark task complete" / task feedback: call \`elife_submit_task_feedback\` (confirm first).
- For "file a complaint" / "പരാതി": call \`elife_file_complaint\` (confirm first).
- For "what WhatsApp commands can I send" / "കമാൻഡുകൾ": call \`elife_list_whatsapp_commands\`.
- Use \`pennyekart_lookup_order\` for Pennyekart order/delivery questions.
- For any WRITE action (logging work, submitting feedback, filing a complaint, registering, sending a WhatsApp command), ALWAYS confirm with the user first by repeating what you will do and waiting for explicit "yes" / "confirm" / "ശരി".
- If a tool returns an error or empty result, say so clearly and suggest next steps.

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
          description: "Look up an e-Life customer's program registrations and payment history by mobile number. Searches `program_registrations` and `old_payments` (with member join).",
          parameters: {
            type: "object",
            properties: {
              mobile: { type: "string", description: "10-digit mobile number (any format; will be normalized)" },
            },
            required: ["mobile"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "elife_get_agent_hierarchy",
          description: "Look up an e-Life agent by mobile number or agent ID. Searches `pennyekart_agents` and `members`, then enriches with upline (referrer) and direct downline. Use this FIRST whenever a user gives a mobile number.",
          parameters: {
            type: "object",
            properties: {
              mobile: { type: "string", description: "10-digit mobile (any format)" },
              agent_id: { type: "string" },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "elife_get_my_tasks",
          description: "Get the current tasks assigned to an e-Life agent's panchayath, plus the agent's feedback status for each. Identifies the agent by their mobile number.",
          parameters: {
            type: "object",
            properties: {
              mobile: { type: "string", description: "Agent's 10-digit mobile" },
            },
            required: ["mobile"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "elife_get_work_logs",
          description: "Get an e-Life agent's recent daily work log entries from `agent_work_logs`. Identifies the agent by mobile.",
          parameters: {
            type: "object",
            properties: {
              mobile: { type: "string", description: "Agent's 10-digit mobile" },
              days: { type: "number", description: "How many days back to look (default 7, max 30)" },
            },
            required: ["mobile"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "elife_list_whatsapp_commands",
          description: "List the active core WhatsApp bot commands from e-Life's `whatsapp_bot_commands` table (keyword, label, response). Use when a user asks 'what commands can I send' or wants the command menu.",
          parameters: { type: "object", properties: {} },
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

      tools.push({
        type: "function",
        function: {
          name: "elife_log_daily_work",
          description: "Log a daily work entry for an e-Life agent into `agent_work_logs`. Looks up the agent by mobile, then inserts (work_date, work_details). REQUIRES explicit user confirmation.",
          parameters: {
            type: "object",
            properties: {
              mobile: { type: "string", description: "Agent's 10-digit mobile" },
              work_text: { type: "string", description: "What the agent did today (free text)" },
              work_date: { type: "string", description: "Optional ISO date YYYY-MM-DD; defaults to today" },
              confirmed: { type: "boolean", description: "Must be true after the user confirms." },
            },
            required: ["mobile", "work_text", "confirmed"],
          },
        },
      });

      tools.push({
        type: "function",
        function: {
          name: "elife_submit_task_feedback",
          description: "Submit feedback for an e-Life agent task into `pennyekart_agent_task_feedback`. status must be 'completed' or 'not_completed'. Looks up agent by mobile. REQUIRES confirmation.",
          parameters: {
            type: "object",
            properties: {
              mobile: { type: "string" },
              task_id: { type: "string" },
              status: { type: "string", enum: ["completed", "not_completed"] },
              remarks: { type: "string" },
              confirmed: { type: "boolean" },
            },
            required: ["mobile", "task_id", "status", "confirmed"],
          },
        },
      });

      tools.push({
        type: "function",
        function: {
          name: "elife_file_complaint",
          description: "File a complaint for an e-Life agent into `agent_complaints`. Looks up the agent by mobile. REQUIRES confirmation.",
          parameters: {
            type: "object",
            properties: {
              mobile: { type: "string" },
              complaint_text: { type: "string" },
              confirmed: { type: "boolean" },
            },
            required: ["mobile", "complaint_text", "confirmed"],
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

// Normalize an Indian mobile: strip non-digits, remove leading "91" or "0", keep last 10 digits.
function normalizeMobile(raw: string): string {
  let s = String(raw || "").replace(/\D/g, "");
  if (s.startsWith("91") && s.length > 10) s = s.slice(2);
  s = s.replace(/^0+/, "");
  if (s.length > 10) s = s.slice(-10);
  return s;
}

// Try each candidate column individually so a missing column doesn't break the whole `or()`.
async function findByMobile(
  elife: any,
  allowedTables: string[],
  mobile: string,
  candidates: { table: string; cols: string[]; jsonbPaths?: string[] }[],
  limit = 10,
): Promise<{ source: string; rows: any[]; matched_column?: string } | null> {
  const variants = Array.from(new Set([mobile, `91${mobile}`, `+91${mobile}`, `0${mobile}`]));
  for (const c of candidates) {
    if (allowedTables.length && !allowedTables.includes(c.table)) continue;

    // Try plain columns one at a time
    for (const col of c.cols) {
      for (const v of variants) {
        const { data, error } = await elife.from(c.table).select("*").eq(col, v).limit(limit);
        if (error) {
          // Column doesn't exist — try the next column variant
          break;
        }
        if (data && data.length) return { source: c.table, rows: data, matched_column: col };
      }
    }

    // Try JSONB paths e.g. "answers->_fixed->>mobile"
    for (const path of c.jsonbPaths || []) {
      for (const v of variants) {
        const { data, error } = await elife.from(c.table).select("*").eq(path, v).limit(limit);
        if (error) break;
        if (data && data.length) return { source: c.table, rows: data, matched_column: path };
      }
    }
  }
  return null;
}

async function executeTool(
  name: string,
  args: any,
  ctx: { sb: any; elife: any | null; userId: string | null; callerMobile: string | null; callerIsAgent: boolean; allowedTables: string[]; writeEnabled: boolean },
): Promise<any> {
  // Gate: agent-only tools require the logged-in caller to be a verified e-Life agent
  const AGENT_ONLY = new Set([
    "elife_get_my_tasks",
    "elife_get_work_logs",
    "elife_log_daily_work",
    "elife_submit_task_feedback",
    "elife_file_complaint",
  ]);
  if (AGENT_ONLY.has(name) && !ctx.callerIsAgent) {
    return { error: "This tool is only available to registered e-Life agents. The current user's mobile is not in pennyekart_agents/members." };
  }
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
    const mobile = normalizeMobile(args.mobile);
    if (mobile.length < 10) return { error: "Invalid mobile number — please give a 10-digit number." };

    const hit = await findByMobile(ctx.elife, ctx.allowedTables, mobile, [
      // program_registrations stores mobile inside JSONB: answers->_fixed->>mobile
      { table: "program_registrations", cols: ["mobile", "mobile_number", "phone"], jsonbPaths: ["answers->_fixed->>mobile", "answers->>mobile"] },
      { table: "old_payments", cols: ["mobile"] },
      { table: "members", cols: ["mobile", "mobile_number", "phone", "whatsapp_number"] },
    ]);

    if (!hit) {
      return { results: [], note: `No payment/registration records found for ${mobile} in program_registrations, old_payments, or members.` };
    }
    return { source: hit.source, mobile, matched_column: hit.matched_column, results: hit.rows };
  }

  if (name === "elife_get_agent_hierarchy") {
    const mobile = args.mobile ? normalizeMobile(args.mobile) : null;
    const agentId = args.agent_id ?? null;
    if (!mobile && !agentId) return { error: "Provide mobile or agent_id" };

    let agent: any = null;
    let source: string | null = null;

    if (mobile) {
      const hit = await findByMobile(ctx.elife, ctx.allowedTables, mobile, [
        { table: "pennyekart_agents", cols: ["mobile"] },
        { table: "members", cols: ["mobile", "mobile_number", "phone", "whatsapp_number"] },
      ], 5);
      if (hit) {
        agent = hit.rows[0];
        source = hit.source;
      }
    } else if (agentId) {
      for (const table of ["pennyekart_agents", "members"]) {
        if (ctx.allowedTables.length && !ctx.allowedTables.includes(table)) continue;
        const { data } = await ctx.elife.from(table).select("*").eq("id", agentId).limit(1);
        if (data && data.length) { agent = data[0]; source = table; break; }
      }
    }

    // Fallback: if not found in agents/members but mobile was given, also surface program_registrations matches
    // so the user gets *some* useful info instead of a flat "not found".
    if (!agent && mobile) {
      const regHit = await findByMobile(ctx.elife, ctx.allowedTables, mobile, [
        { table: "program_registrations", cols: [], jsonbPaths: ["answers->_fixed->>mobile", "answers->>mobile"] },
        { table: "old_payments", cols: ["mobile"] },
      ], 10);
      if (regHit) {
        return {
          agent: null,
          note: `${mobile} is not a registered agent in pennyekart_agents, but found ${regHit.rows.length} record(s) in ${regHit.source}.`,
          related_source: regHit.source,
          related_records: regHit.rows,
        };
      }
      return { agent: null, note: `No agent or registration found for ${mobile}.` };
    }

    if (!agent) {
      return { agent: null, note: `No agent found for ${agentId}.` };
    }

    // Enrich with upline + downline using the real e-Life schema (parent_agent_id on pennyekart_agents).
    let upline: any = null;
    if (source === "pennyekart_agents" && agent.parent_agent_id) {
      const { data } = await ctx.elife.from("pennyekart_agents").select("*").eq("id", agent.parent_agent_id).limit(1);
      if (data && data.length) upline = data[0];
    }

    let downline: any[] = [];
    if (source === "pennyekart_agents") {
      const { data } = await ctx.elife.from("pennyekart_agents").select("*").eq("parent_agent_id", agent.id).limit(50);
      if (data) downline = data;
    }

    return { source, agent, upline, downline_count: downline.length, downline };
  }

  if (name === "elife_create_registration") {
    if (!ctx.writeEnabled) return { error: "Write access is disabled by admin." };
    if (!args.confirmed) return { error: "User confirmation required." };
    if (ctx.allowedTables.length && !ctx.allowedTables.includes("program_registrations")) {
      return { error: "program_registrations table is not in the allowlist." };
    }
    const { data, error } = await ctx.elife.from("program_registrations").insert({
      mobile: normalizeMobile(args.mobile),
      full_name: args.full_name,
      program_id: args.program_id,
    }).select().maybeSingle();
    if (error) return { error: error.message };
    return { ok: true, registration: data };
  }

  if (name === "elife_send_whatsapp_command") {
    if (!ctx.writeEnabled) return { error: "Write access is disabled by admin." };
    if (!args.confirmed) return { error: "User confirmation required." };
    if (ctx.allowedTables.length && !ctx.allowedTables.includes("whatsapp_bot_commands")) {
      return { error: "whatsapp_bot_commands table is not in the allowlist." };
    }
    const { data, error } = await ctx.elife.from("whatsapp_bot_commands").insert({
      to: args.to,
      command: args.command,
      source: "pennyekart_chatbot",
    }).select().maybeSingle();
    if (error) return { error: error.message };
    return { ok: true, queued: data };
  }

  // Helper: resolve a pennyekart_agents row by mobile (normalized).
  async function resolveAgent(mobile: string): Promise<any | null> {
    const m = normalizeMobile(mobile);
    if (m.length < 10) return null;
    if (ctx.allowedTables.length && !ctx.allowedTables.includes("pennyekart_agents")) return null;
    for (const v of [m, `91${m}`, `0${m}`]) {
      const { data } = await ctx.elife.from("pennyekart_agents").select("*").eq("mobile", v).limit(1);
      if (data && data.length) return data[0];
    }
    return null;
  }

  if (name === "elife_get_my_tasks") {
    const agent = await resolveAgent(args.mobile);
    if (!agent) return { error: `No agent found for mobile ${args.mobile}.` };
    if (ctx.allowedTables.length && !ctx.allowedTables.includes("pennyekart_agent_tasks")) {
      return { error: "pennyekart_agent_tasks not in allowlist." };
    }
    const { data: tasks, error } = await ctx.elife
      .from("pennyekart_agent_tasks").select("*")
      .eq("panchayath_id", agent.panchayath_id).eq("is_active", true)
      .order("created_at", { ascending: false }).limit(20);
    if (error) return { error: error.message };
    let feedback: any[] = [];
    if (tasks?.length && (!ctx.allowedTables.length || ctx.allowedTables.includes("pennyekart_agent_task_feedback"))) {
      const { data: fb } = await ctx.elife.from("pennyekart_agent_task_feedback")
        .select("*").eq("agent_id", agent.id).in("task_id", tasks.map((t: any) => t.id));
      feedback = fb ?? [];
    }
    return { agent: { id: agent.id, name: agent.name, panchayath_id: agent.panchayath_id }, tasks: tasks ?? [], feedback };
  }

  if (name === "elife_get_work_logs") {
    const agent = await resolveAgent(args.mobile);
    if (!agent) return { error: `No agent found for mobile ${args.mobile}.` };
    if (ctx.allowedTables.length && !ctx.allowedTables.includes("agent_work_logs")) {
      return { error: "agent_work_logs not in allowlist." };
    }
    const days = Math.min(Math.max(Number(args.days) || 7, 1), 30);
    const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
    const { data, error } = await ctx.elife.from("agent_work_logs").select("*")
      .eq("agent_id", agent.id).gte("work_date", since)
      .order("work_date", { ascending: false }).limit(50);
    if (error) return { error: error.message };
    return { agent: { id: agent.id, name: agent.name }, logs: data ?? [] };
  }

  if (name === "elife_list_whatsapp_commands") {
    if (ctx.allowedTables.length && !ctx.allowedTables.includes("whatsapp_bot_commands")) {
      return { error: "whatsapp_bot_commands not in allowlist." };
    }
    const { data, error } = await ctx.elife.from("whatsapp_bot_commands")
      .select("keyword, alt_keyword, label, response_text, sort_order")
      .eq("is_active", true).order("sort_order", { ascending: true }).limit(50);
    if (error) return { error: error.message };
    return { commands: data ?? [] };
  }

  if (name === "elife_log_daily_work") {
    if (!ctx.writeEnabled) return { error: "Write access is disabled by admin." };
    if (!args.confirmed) return { error: "User confirmation required." };
    if (ctx.allowedTables.length && !ctx.allowedTables.includes("agent_work_logs")) {
      return { error: "agent_work_logs not in allowlist." };
    }
    const agent = await resolveAgent(args.mobile);
    if (!agent) return { error: `No agent found for mobile ${args.mobile}.` };
    const work_date = args.work_date || new Date().toISOString().slice(0, 10);
    const { data, error } = await ctx.elife.from("agent_work_logs").insert({
      agent_id: agent.id, work_date, work_details: String(args.work_text || "").trim(),
    }).select().maybeSingle();
    if (error) return { error: error.message };
    return { ok: true, agent: { id: agent.id, name: agent.name }, log: data };
  }

  if (name === "elife_submit_task_feedback") {
    if (!ctx.writeEnabled) return { error: "Write access is disabled by admin." };
    if (!args.confirmed) return { error: "User confirmation required." };
    if (!["completed", "not_completed"].includes(args.status)) return { error: "status must be 'completed' or 'not_completed'." };
    if (ctx.allowedTables.length && !ctx.allowedTables.includes("pennyekart_agent_task_feedback")) {
      return { error: "pennyekart_agent_task_feedback not in allowlist." };
    }
    const agent = await resolveAgent(args.mobile);
    if (!agent) return { error: `No agent found for mobile ${args.mobile}.` };
    const { data, error } = await ctx.elife.from("pennyekart_agent_task_feedback").insert({
      task_id: args.task_id, agent_id: agent.id, status: args.status,
      remarks: args.remarks ?? null, feedback_by: agent.id,
    }).select().maybeSingle();
    if (error) return { error: error.message };
    return { ok: true, feedback: data };
  }

  if (name === "elife_file_complaint") {
    if (!ctx.writeEnabled) return { error: "Write access is disabled by admin." };
    if (!args.confirmed) return { error: "User confirmation required." };
    if (ctx.allowedTables.length && !ctx.allowedTables.includes("agent_complaints")) {
      return { error: "agent_complaints not in allowlist." };
    }
    const agent = await resolveAgent(args.mobile);
    if (!agent) return { error: `No agent found for mobile ${args.mobile}.` };
    const { data, error } = await ctx.elife.from("agent_complaints").insert({
      agent_id: agent.id, complaint_text: String(args.complaint_text || "").trim(), status: "pending",
    }).select().maybeSingle();
    if (error) return { error: error.message };
    return { ok: true, complaint: data };
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
    let callerMobile: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
      userId = claims?.claims?.sub ?? null;
      if (userId) {
        const { data: prof } = await sb.from("profiles").select("mobile_number, full_name").eq("user_id", userId).maybeSingle();
        if (prof?.mobile_number) callerMobile = normalizeMobile(prof.mobile_number);
      }
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

    // Verify whether the caller is a registered e-Life agent (defence-in-depth gate for agent-only tools)
    let callerIsAgent = false;
    if (elife && callerMobile && callerMobile.length === 10) {
      const variants = Array.from(new Set([callerMobile, `91${callerMobile}`, `0${callerMobile}`]));
      const probes: { table: string; cols: string[] }[] = [
        { table: "pennyekart_agents", cols: ["mobile"] },
        { table: "members", cols: ["mobile", "mobile_number", "phone", "whatsapp_number"] },
      ];
      outer: for (const p of probes) {
        if (allowedTables.length && !allowedTables.includes(p.table)) continue;
        for (const col of p.cols) {
          for (const v of variants) {
            const { data, error } = await elife.from(p.table).select("id").eq(col, v).limit(1);
            if (error) break;
            if (data && data.length) { callerIsAgent = true; break outer; }
          }
        }
      }
    }

    const tools = buildTools(config);

    // Inject runtime context into the system prompt so the model knows who the caller is
    let runtimeNote = "\n\n--- CALLER CONTEXT ---";
    runtimeNote += `\n- Logged in: ${userId ? "yes" : "no"}`;
    if (callerMobile) runtimeNote += `\n- Caller mobile: ${callerMobile}`;
    if (config.elife_enabled === "true") {
      runtimeNote += `\n- e-Life agent: ${callerIsAgent ? "yes — agent-only tools are allowed for this user" : "no — DO NOT call elife_log_daily_work, elife_get_my_tasks, elife_get_work_logs, elife_submit_task_feedback, elife_file_complaint or any write tool. Politely tell the user that agent features need a registered agent mobile."}`;
    }

    const maxHistory = parseInt(config.max_history_messages || "20", 10);
    let convo: any[] = [
      { role: "system", content: systemPrompt + runtimeNote },
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
          result = await executeTool(fnName, parsedArgs, { sb, elife, userId, callerMobile, callerIsAgent, allowedTables, writeEnabled });
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

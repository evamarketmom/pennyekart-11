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

Tone: Warm, helpful, concise. Keep responses short (2-4 sentences) unless the customer asks for detail.

Key facts:
- Pennyekart delivers groceries, essentials, and home services
- Customers earn wallet points on purchases
- Penny Prime offers special discounts via collab codes
- Delivery is organized by local body and ward in Kerala
- Flash sales offer time-limited deals
- Penny Carbs is the food delivery vertical
- Penny Services covers home services (plumbing, electrical, etc.)

If you don't know something specific (like a customer's order status), politely suggest they check their profile/orders page or contact support.
Never make up product prices or availability — suggest the customer search for the product in the app.`;

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  malayalam: "\n\nIMPORTANT: Always respond in Malayalam (മലയാളം) language. Use Malayalam script for all responses. If the user writes in English or any other language, still reply in Malayalam.",
  english: "\n\nIMPORTANT: Always respond in English.",
  auto: "\n\nIMPORTANT: Respond in the same language the user writes in. If unclear, use Malayalam (മലയാളം).",
};

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
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch config and knowledge from DB
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseServiceKey);

    const [configRes, knowledgeRes] = await Promise.all([
      sb.from("chatbot_config").select("key, value"),
      sb.from("chatbot_knowledge").select("title, content").eq("is_active", true).order("sort_order"),
    ]);

    const config: Record<string, string | null> = {};
    (configRes.data ?? []).forEach((r: any) => { config[r.key] = r.value; });

    // Check enabled
    if (config.enabled === "false") {
      return new Response(JSON.stringify({ error: "Chatbot is currently disabled" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build system prompt
    let systemPrompt = config.system_prompt || DEFAULT_SYSTEM_PROMPT;

    // Append language instruction
    const lang = config.response_language || "malayalam";
    systemPrompt += LANGUAGE_INSTRUCTIONS[lang] || LANGUAGE_INSTRUCTIONS.malayalam;

    // Append knowledge base
    const knowledgeEntries = knowledgeRes.data ?? [];
    if (knowledgeEntries.length > 0) {
      systemPrompt += "\n\n--- KNOWLEDGE BASE ---";
      for (const entry of knowledgeEntries) {
        systemPrompt += `\n\n### ${entry.title}\n${entry.content}`;
      }
    }

    // Trim message history
    const maxHistory = parseInt(config.max_history_messages || "20", 10);
    const trimmedMessages = messages.slice(-maxHistory);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...trimmedMessages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please try again later." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

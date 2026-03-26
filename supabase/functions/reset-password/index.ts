import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, mobile_number, date_of_birth, new_password, user_id } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Admin reset by user_id (no DOB verification needed)
    if (action === "reset_by_admin") {
      if (!user_id || !new_password || new_password.length < 6) {
        return new Response(JSON.stringify({ success: false, message: "User ID and password (min 6 chars) required." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: updateError } = await admin.auth.admin.updateUserById(user_id, { password: new_password });
      if (updateError) {
        return new Response(JSON.stringify({ success: false, message: updateError.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find profile by mobile number
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("user_id, date_of_birth, mobile_number")
      .eq("mobile_number", mobile_number)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ verified: false, message: "Account not found." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify DOB matches
    if (profile.date_of_birth !== date_of_birth) {
      return new Response(JSON.stringify({ verified: false, message: "Date of birth does not match." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      return new Response(JSON.stringify({ verified: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset") {
      if (!new_password || new_password.length < 6) {
        return new Response(JSON.stringify({ success: false, message: "Password must be at least 6 characters." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateError } = await admin.auth.admin.updateUserById(profile.user_id, {
        password: new_password,
      });

      if (updateError) {
        return new Response(JSON.stringify({ success: false, message: updateError.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

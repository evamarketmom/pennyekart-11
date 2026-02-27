import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ProviderConfig {
  provider_name: string;
  is_enabled: boolean;
  priority: number;
  credentials: Record<string, string>;
}

// ─── Provider Adapters ───

async function uploadToCloudinary(
  file: Uint8Array,
  fileName: string,
  creds: Record<string, string>
): Promise<string> {
  const { cloud_name, upload_preset } = creds;
  if (!cloud_name || !upload_preset) throw new Error("Cloudinary credentials missing");

  const formData = new FormData();
  formData.append("file", new Blob([file.buffer as ArrayBuffer]), fileName);
  formData.append("upload_preset", upload_preset);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`,
    { method: "POST", body: formData }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cloudinary upload failed [${res.status}]: ${err}`);
  }
  const data = await res.json();
  return data.secure_url;
}

async function uploadToS3(
  file: Uint8Array,
  fileName: string,
  contentType: string,
  creds: Record<string, string>
): Promise<string> {
  const { access_key, secret_key, bucket_name, region } = creds;
  if (!access_key || !secret_key || !bucket_name || !region)
    throw new Error("S3 credentials missing");

  const host = `${bucket_name}.s3.${region}.amazonaws.com`;
  const path = `/${fileName}`;
  const now = new Date();
  const dateStamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const shortDate = dateStamp.substring(0, 8);

  // Simple S3 PUT with presigned-style (using unsigned payload for simplicity)
  const encoder = new TextEncoder();

  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:UNSIGNED-PAYLOAD\nx-amz-date:${dateStamp}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = `PUT\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\nUNSIGNED-PAYLOAD`;

  const credentialScope = `${shortDate}/${region}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${dateStamp}\n${credentialScope}\n${await sha256Hex(canonicalRequest)}`;

  const signingKey = await getSignatureKey(secret_key, shortDate, region, "s3");
  const signature = await hmacHex(signingKey, stringToSign);

  const authorization = `AWS4-HMAC-SHA256 Credential=${access_key}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(`https://${host}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      Host: host,
      "x-amz-content-sha256": "UNSIGNED-PAYLOAD",
      "x-amz-date": dateStamp,
      Authorization: authorization,
    },
    body: file.buffer as ArrayBuffer,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`S3 upload failed [${res.status}]: ${err}`);
  }

  return `https://${host}${path}`;
}

async function uploadToImageKit(
  file: Uint8Array,
  fileName: string,
  creds: Record<string, string>
): Promise<string> {
  const { public_key, url_endpoint } = creds;
  if (!public_key || !url_endpoint) throw new Error("ImageKit credentials missing");

  // ImageKit upload API requires private key for server-side upload
  // Using the upload API with public key (unsigned)
  const formData = new FormData();
  formData.append("file", new Blob([file.buffer as ArrayBuffer]), fileName);
  formData.append("fileName", fileName);
  formData.append("publicKey", public_key);

  const res = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ImageKit upload failed [${res.status}]: ${err}`);
  }

  const data = await res.json();
  return data.url;
}

// ─── AWS Signature Helpers ───

async function hmac(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

async function hmacHex(key: ArrayBuffer, data: string): Promise<string> {
  const sig = await hmac(key, data);
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getSignatureKey(
  key: string, dateStamp: string, region: string, service: string
): Promise<ArrayBuffer> {
  let k = await hmac(new TextEncoder().encode("AWS4" + key).buffer, dateStamp);
  k = await hmac(k, region);
  k = await hmac(k, service);
  k = await hmac(k, "aws4_request");
  return k;
}

async function sha256Hex(data: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ─── Main Handler ───

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse multipart form
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate file size (1MB max)
    if (file.size > 1 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "File size exceeds 1MB limit" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate format
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return new Response(JSON.stringify({ error: "Only jpg, jpeg, png, webp formats allowed" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const ext = "webp";
    const contentType = "image/webp";
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    // Fetch enabled providers sorted by priority
    const { data: providers, error: provError } = await supabase
      .from("storage_providers")
      .select("*")
      .eq("is_enabled", true)
      .order("priority", { ascending: true });

    if (provError || !providers || providers.length === 0) {
      return new Response(JSON.stringify({ error: "No storage providers configured. Please configure at least one provider in admin settings." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try each provider in priority order
    let uploadedUrl = "";
    let usedProvider = "";
    let uploadStatus = "success";
    const errors: string[] = [];

    for (const provider of providers as ProviderConfig[]) {
      try {
        switch (provider.provider_name) {
          case "cloudinary":
            uploadedUrl = await uploadToCloudinary(fileBytes, fileName, provider.credentials);
            break;
          case "s3":
            uploadedUrl = await uploadToS3(fileBytes, fileName, contentType, provider.credentials);
            break;
          case "imagekit":
            uploadedUrl = await uploadToImageKit(fileBytes, fileName, provider.credentials);
            break;
          default:
            throw new Error(`Unknown provider: ${provider.provider_name}`);
        }
        usedProvider = provider.provider_name;
        if (errors.length > 0) uploadStatus = "fallback";
        break;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${provider.provider_name}: ${msg}`);
        console.error(`Provider ${provider.provider_name} failed:`, msg);
      }
    }

    if (!uploadedUrl) {
      return new Response(
        JSON.stringify({ error: "All providers failed", details: errors }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        url: uploadedUrl,
        provider: usedProvider,
        status: uploadStatus,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Upload error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

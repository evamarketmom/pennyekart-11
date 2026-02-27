import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ImageUploadProps {
  bucket: string;
  value: string;
  onChange: (url: string, meta?: { provider?: string; status?: string }) => void;
  label?: string;
  useExternalStorage?: boolean;
}

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const ImageUpload = ({ bucket, value, onChange, label, useExternalStorage = true }: ImageUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadMeta, setUploadMeta] = useState<{ provider?: string; status?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadMeta(null);

    // Client-side validation
    if (file.size > MAX_FILE_SIZE) {
      setError("File size exceeds 1MB limit");
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Only jpg, jpeg, png, webp formats allowed");
      return;
    }

    setUploading(true);

    if (useExternalStorage) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setError("Please log in to upload");
          setUploading(false);
          return;
        }

        const formData = new FormData();
        formData.append("file", file);

        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "xxlocaexuoowxdzupjcs";
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/upload-image`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            body: formData,
          }
        );

        const data = await res.json();
        if (!res.ok) {
          // Fallback to Supabase storage
          console.warn("External upload failed, falling back to Supabase storage:", data.error);
          await fallbackToSupabase(file);
          return;
        }

        setUploadMeta({ provider: data.provider, status: data.status });
        onChange(data.url, { provider: data.provider, status: data.status });
      } catch (err) {
        console.warn("External upload error, falling back:", err);
        await fallbackToSupabase(file);
      }
    } else {
      await fallbackToSupabase(file);
    }

    setUploading(false);
  };

  const fallbackToSupabase = async (file: File) => {
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, file);
    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
    setUploadMeta({ provider: "supabase", status: "fallback" });
    onChange(urlData.publicUrl, { provider: "supabase", status: "fallback" });
    setUploading(false);
  };

  return (
    <div className="space-y-2">
      {label && <span className="text-sm font-medium">{label}</span>}
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Image URL or upload"
          className="flex-1"
        />
        <Button type="button" variant="outline" size="icon" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="icon" onClick={() => { onChange(""); setUploadMeta(null); setError(null); }}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {uploadMeta?.provider && (
        <div className="flex items-center gap-1">
          <Badge variant="outline" className="text-[10px]">
            {uploadMeta.provider}
          </Badge>
          {uploadMeta.status === "fallback" && (
            <Badge variant="secondary" className="text-[10px]">fallback</Badge>
          )}
        </div>
      )}
      {value && (
        <img src={value} alt="Preview" className="h-20 w-20 rounded-md border object-cover" />
      )}
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleUpload} />
    </div>
  );
};

export default ImageUpload;

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
const TARGET_SIZE = 100 * 1024; // 100KB target
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const compressImage = (file: File, targetBytes: number): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let { width, height } = img;

      // Scale down if very large
      const maxDim = 1200;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      // Iteratively reduce quality to hit target
      let quality = 0.8;
      let blob: Blob | null = null;
      for (let i = 0; i < 6; i++) {
        blob = await new Promise<Blob | null>(r => canvas.toBlob(r, "image/webp", quality));
        if (!blob || blob.size <= targetBytes) break;
        quality -= 0.1;
      }

      if (!blob) return reject(new Error("Compression failed"));
      const compressed = new File([blob], file.name.replace(/\.\w+$/, ".webp"), { type: "image/webp" });
      resolve(compressed);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
    img.src = url;
  });
};

const ImageUpload = ({ bucket, value, onChange, label, useExternalStorage = true }: ImageUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadMeta, setUploadMeta] = useState<{ provider?: string; status?: string; size?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadMeta(null);

    if (file.size > MAX_FILE_SIZE) {
      setError("File size exceeds 1MB limit");
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Only jpg, jpeg, png, webp formats allowed");
      return;
    }

    setUploading(true);

    // Auto-compress to under 100KB
    let optimizedFile = file;
    try {
      if (file.size > TARGET_SIZE) {
        optimizedFile = await compressImage(file, TARGET_SIZE);
      }
    } catch {
      console.warn("Compression failed, using original file");
    }

    if (useExternalStorage) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setError("Please log in to upload");
          setUploading(false);
          return;
        }

        const formData = new FormData();
        formData.append("file", optimizedFile);

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
        await fallbackToSupabase(optimizedFile);
          return;
        }

        const sizeKB = (optimizedFile.size / 1024).toFixed(0);
        setUploadMeta({ provider: data.provider, status: data.status, size: `${sizeKB}KB` });
        onChange(data.url, { provider: data.provider, status: data.status });
      } catch (err) {
        console.warn("External upload error, falling back:", err);
      await fallbackToSupabase(optimizedFile);
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
    const sizeKB = (file.size / 1024).toFixed(0);
    setUploadMeta({ provider: "supabase", status: "fallback", size: `${sizeKB}KB` });
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
          {uploadMeta.size && (
            <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
              optimized: {uploadMeta.size}
            </Badge>
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

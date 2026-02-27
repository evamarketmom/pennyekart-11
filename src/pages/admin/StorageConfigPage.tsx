import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Cloud, HardDrive, ImageIcon, Loader2, Save, GripVertical } from "lucide-react";

interface StorageProvider {
  id: string;
  provider_name: string;
  is_enabled: boolean;
  priority: number;
  credentials: Record<string, string>;
}

const providerMeta: Record<string, { label: string; icon: typeof Cloud; fields: { key: string; label: string; sensitive?: boolean }[] }> = {
  cloudinary: {
    label: "Cloudinary",
    icon: Cloud,
    fields: [
      { key: "cloud_name", label: "Cloud Name" },
      { key: "upload_preset", label: "Upload Preset" },
    ],
  },
  s3: {
    label: "AWS S3",
    icon: HardDrive,
    fields: [
      { key: "access_key", label: "Access Key", sensitive: true },
      { key: "secret_key", label: "Secret Key", sensitive: true },
      { key: "bucket_name", label: "Bucket Name" },
      { key: "region", label: "Region" },
    ],
  },
  imagekit: {
    label: "ImageKit",
    icon: ImageIcon,
    fields: [
      { key: "public_key", label: "Public Key" },
      { key: "url_endpoint", label: "URL Endpoint" },
    ],
  },
};

const StorageConfigPage = () => {
  const [providers, setProviders] = useState<StorageProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchProviders = async () => {
    const { data, error } = await supabase
      .from("storage_providers")
      .select("*")
      .order("priority", { ascending: true });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setProviders((data as StorageProvider[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchProviders(); }, []);

  const updateProvider = (id: string, updates: Partial<StorageProvider>) => {
    setProviders((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  const updateCredential = (id: string, key: string, value: string) => {
    setProviders((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, credentials: { ...p.credentials, [key]: value } }
          : p
      )
    );
  };

  const handleSave = async (provider: StorageProvider) => {
    setSaving(provider.id);
    const { error } = await supabase
      .from("storage_providers")
      .update({
        is_enabled: provider.is_enabled,
        priority: provider.priority,
        credentials: provider.credentials as any,
      })
      .eq("id", provider.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${providerMeta[provider.provider_name]?.label ?? provider.provider_name} saved` });
    }
    setSaving(null);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Storage Configuration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure external image storage providers. Images will be uploaded to the highest-priority enabled provider with automatic fallback.
        </p>
      </div>

      <div className="space-y-6">
        {providers.map((provider) => {
          const meta = providerMeta[provider.provider_name];
          if (!meta) return null;
          const Icon = meta.icon;

          return (
            <Card key={provider.id}>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-lg">{meta.label}</CardTitle>
                      <CardDescription>
                        Priority: {provider.priority}
                        {provider.is_enabled && (
                          <Badge className="ml-2 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0">
                            Enabled
                          </Badge>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Priority</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        className="w-16 h-8 text-center"
                        value={provider.priority}
                        onChange={(e) =>
                          updateProvider(provider.id, { priority: parseInt(e.target.value) || 1 })
                        }
                      />
                    </div>
                    <Switch
                      checked={provider.is_enabled}
                      onCheckedChange={(v) => updateProvider(provider.id, { is_enabled: v })}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  {meta.fields.map((field) => (
                    <div key={field.key}>
                      <Label className="text-xs">{field.label}</Label>
                      <Input
                        type={field.sensitive ? "password" : "text"}
                        value={provider.credentials[field.key] ?? ""}
                        onChange={(e) =>
                          updateCredential(provider.id, field.key, e.target.value)
                        }
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                      />
                    </div>
                  ))}
                </div>
                <Button
                  className="mt-4"
                  onClick={() => handleSave(provider)}
                  disabled={saving === provider.id}
                >
                  {saving === provider.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save {meta.label}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AdminLayout>
  );
};

export default StorageConfigPage;

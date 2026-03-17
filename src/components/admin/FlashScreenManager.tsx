import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Pencil, Trash2, MonitorSmartphone, Image, Settings2 } from "lucide-react";
import ImageUpload from "@/components/admin/ImageUpload";

interface FlashScreen {
  id: string;
  title: string;
  image_url: string | null;
  link_url: string | null;
  is_active: boolean;
  sort_order: number;
}

interface PopupSettings {
  open_trigger: string;
  open_delay_seconds: number;
  auto_disappear_seconds: number;
}

const defaultSettings: PopupSettings = {
  open_trigger: "refresh",
  open_delay_seconds: 2,
  auto_disappear_seconds: 0,
};

const emptyForm = { title: "", image_url: "", link_url: "", is_active: true, sort_order: 0 };

const SETTINGS_KEYS = ["flash_popup_open_trigger", "flash_popup_open_delay", "flash_popup_auto_disappear"];

const FlashScreenManager = () => {
  const [items, setItems] = useState<FlashScreen[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<PopupSettings>(defaultSettings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchItems = async () => {
    const { data } = await supabase
      .from("offer_flash_screens" as any)
      .select("*")
      .order("sort_order");
    setItems((data as any as FlashScreen[]) ?? []);
  };

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", SETTINGS_KEYS);
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((r) => { if (r.value) map[r.key] = r.value; });
      setSettings({
        open_trigger: map["flash_popup_open_trigger"] || defaultSettings.open_trigger,
        open_delay_seconds: parseInt(map["flash_popup_open_delay"] || "") || defaultSettings.open_delay_seconds,
        auto_disappear_seconds: parseInt(map["flash_popup_auto_disappear"] || "0"),
      });
    }
  };

  useEffect(() => { fetchItems(); fetchSettings(); }, []);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    const pairs = [
      { key: "flash_popup_open_trigger", value: settings.open_trigger, description: "Flash popup trigger: refresh or countdown" },
      { key: "flash_popup_open_delay", value: String(settings.open_delay_seconds), description: "Delay in seconds before popup appears" },
      { key: "flash_popup_auto_disappear", value: String(settings.auto_disappear_seconds), description: "Auto disappear time in seconds (0 = manual close)" },
    ];
    for (const p of pairs) {
      const { data: existing } = await supabase.from("app_settings").select("id").eq("key", p.key).maybeSingle();
      if (existing) {
        await supabase.from("app_settings").update({ value: p.value, updated_by: user?.id }).eq("key", p.key);
      } else {
        await supabase.from("app_settings").insert({ key: p.key, value: p.value, description: p.description });
      }
    }
    setSavingSettings(false);
    toast({ title: "Popup settings saved" });
  };

  const handleSave = async () => {
    if (!form.title) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (editId) {
      const { error } = await (supabase.from("offer_flash_screens" as any) as any).update(form).eq("id", editId);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await (supabase.from("offer_flash_screens" as any) as any).insert({ ...form, created_by: user?.id });
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    }
    setOpen(false);
    setForm(emptyForm);
    setEditId(null);
    fetchItems();
    toast({ title: editId ? "Updated" : "Created" });
  };

  const handleDelete = async (id: string) => {
    await (supabase.from("offer_flash_screens" as any) as any).delete().eq("id", id);
    fetchItems();
    toast({ title: "Deleted" });
  };

  const openEdit = (item: FlashScreen) => {
    setForm({
      title: item.title,
      image_url: item.image_url ?? "",
      link_url: item.link_url ?? "",
      is_active: item.is_active,
      sort_order: item.sort_order,
    });
    setEditId(item.id);
    setOpen(true);
  };

  const canEdit = hasPermission("update_products");

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MonitorSmartphone className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Flash Screen Offer Banners</CardTitle>
            <Badge variant="secondary">{items.length}</Badge>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <>
                <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)}>
                  <Settings2 className="h-4 w-4 mr-1" /> Settings
                </Button>
                <Button size="sm" onClick={() => { setForm(emptyForm); setEditId(null); setOpen(true); }}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          These banners appear as a popup when customers open the app. They can also reopen it via a button.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Popup Settings Panel */}
        {showSettings && canEdit && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Settings2 className="h-4 w-4" /> Popup Behavior Settings
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">When to open</Label>
                <Select value={settings.open_trigger} onValueChange={(v) => setSettings({ ...settings, open_trigger: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="refresh">On page refresh/load</SelectItem>
                    <SelectItem value="countdown">After countdown delay</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  {settings.open_trigger === "refresh"
                    ? "Popup shows each time the page loads"
                    : "Popup shows after a countdown timer"}
                </p>
              </div>

              {settings.open_trigger === "refresh" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Open delay (seconds)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={60}
                    value={settings.open_delay_seconds}
                    onChange={(e) => setSettings({ ...settings, open_delay_seconds: Math.max(0, parseInt(e.target.value) || 0) })}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Wait this many seconds before showing the popup
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Auto disappear (seconds)</Label>
                <Input
                  type="number"
                  min={0}
                  max={120}
                  value={settings.auto_disappear_seconds}
                  onChange={(e) => setSettings({ ...settings, auto_disappear_seconds: Math.max(0, parseInt(e.target.value) || 0) })}
                />
                <p className="text-[10px] text-muted-foreground">
                  {settings.auto_disappear_seconds === 0
                    ? "Manual close only (no auto disappear)"
                    : `Popup auto-closes after ${settings.auto_disappear_seconds}s`}
                </p>
              </div>
            </div>
            <Button size="sm" onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        )}

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No flash screen banners yet</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border p-3 bg-background space-y-2">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.title} className="w-full h-32 rounded-md object-cover" />
                ) : (
                  <div className="w-full h-32 rounded-md bg-muted flex items-center justify-center">
                    <Image className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={item.is_active ? "default" : "secondary"} className="text-[10px]">
                        {item.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">Order: {item.sort_order}</span>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(item.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(emptyForm); setEditId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Flash Screen Banner" : "New Flash Screen Banner"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <ImageUpload
              bucket="banners"
              value={form.image_url}
              onChange={(url) => setForm({ ...form, image_url: url })}
              label="Banner Image"
            />
            <div>
              <Label>Link URL (optional)</Label>
              <Input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="e.g. /flash-sale/123 or https://..." />
            </div>
            <div>
              <Label>Sort Order</Label>
              <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: +e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>Active</Label>
            </div>
            <Button className="w-full" onClick={handleSave}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default FlashScreenManager;

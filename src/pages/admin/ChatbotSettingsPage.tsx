import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Eye, EyeOff, Save, Loader2 } from "lucide-react";
import { ElifeBridgeTab } from "@/components/admin/ElifeBridgeTab";

type ConfigMap = Record<string, string | null>;
type Knowledge = { id: string; title: string; content: string; is_active: boolean; sort_order: number };
type ApiKey = { id: string; service_name: string; api_key: string; base_url: string | null; description: string | null; is_active: boolean };

const ChatbotSettingsPage = () => {
  const { toast } = useToast();

  // General settings
  const [config, setConfig] = useState<ConfigMap>({});
  const [configLoading, setConfigLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Knowledge
  const [knowledge, setKnowledge] = useState<Knowledge[]>([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(true);
  const [editingKnowledge, setEditingKnowledge] = useState<Knowledge | null>(null);
  const [newKnowledge, setNewKnowledge] = useState(false);
  const [kForm, setKForm] = useState({ title: "", content: "", is_active: true });

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(true);
  const [editingApiKey, setEditingApiKey] = useState<ApiKey | null>(null);
  const [newApiKey, setNewApiKey] = useState(false);
  const [akForm, setAkForm] = useState({ service_name: "", api_key: "", base_url: "", description: "", is_active: true });
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  // Fetch config
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("chatbot_config").select("*");
      const map: ConfigMap = {};
      (data ?? []).forEach((r: any) => { map[r.key] = r.value; });
      setConfig(map);
      setConfigLoading(false);
    })();
  }, []);

  // Fetch knowledge
  const fetchKnowledge = async () => {
    setKnowledgeLoading(true);
    const { data } = await supabase.from("chatbot_knowledge").select("*").order("sort_order");
    setKnowledge((data ?? []) as Knowledge[]);
    setKnowledgeLoading(false);
  };
  useEffect(() => { fetchKnowledge(); }, []);

  // Fetch API keys
  const fetchApiKeys = async () => {
    setApiKeysLoading(true);
    const { data } = await supabase.from("chatbot_api_keys").select("*").order("created_at");
    setApiKeys((data ?? []) as ApiKey[]);
    setApiKeysLoading(false);
  };
  useEffect(() => { fetchApiKeys(); }, []);

  const updateConfig = (key: string, value: string | null) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const saveConfig = async () => {
    setSaving(true);
    for (const [key, value] of Object.entries(config)) {
      await supabase.from("chatbot_config").update({ value }).eq("key", key);
    }
    setSaving(false);
    toast({ title: "Settings saved" });
  };

  // Knowledge CRUD
  const saveKnowledge = async () => {
    if (!kForm.title.trim() || !kForm.content.trim()) return;
    if (editingKnowledge) {
      await supabase.from("chatbot_knowledge").update({ title: kForm.title, content: kForm.content, is_active: kForm.is_active }).eq("id", editingKnowledge.id);
    } else {
      await supabase.from("chatbot_knowledge").insert({ title: kForm.title, content: kForm.content, is_active: kForm.is_active });
    }
    setEditingKnowledge(null);
    setNewKnowledge(false);
    setKForm({ title: "", content: "", is_active: true });
    fetchKnowledge();
    toast({ title: editingKnowledge ? "Knowledge updated" : "Knowledge added" });
  };

  const deleteKnowledge = async (id: string) => {
    await supabase.from("chatbot_knowledge").delete().eq("id", id);
    fetchKnowledge();
    toast({ title: "Knowledge deleted" });
  };

  // API Keys CRUD
  const saveApiKey = async () => {
    if (!akForm.service_name.trim() || !akForm.api_key.trim()) return;
    if (editingApiKey) {
      await supabase.from("chatbot_api_keys").update({
        service_name: akForm.service_name, api_key: akForm.api_key,
        base_url: akForm.base_url || null, description: akForm.description || null, is_active: akForm.is_active,
      }).eq("id", editingApiKey.id);
    } else {
      await supabase.from("chatbot_api_keys").insert({
        service_name: akForm.service_name, api_key: akForm.api_key,
        base_url: akForm.base_url || null, description: akForm.description || null, is_active: akForm.is_active,
      });
    }
    setEditingApiKey(null);
    setNewApiKey(false);
    setAkForm({ service_name: "", api_key: "", base_url: "", description: "", is_active: true });
    fetchApiKeys();
    toast({ title: editingApiKey ? "API key updated" : "API key added" });
  };

  const deleteApiKey = async (id: string) => {
    await supabase.from("chatbot_api_keys").delete().eq("id", id);
    fetchApiKeys();
    toast({ title: "API key deleted" });
  };

  const maskKey = (key: string) => key.slice(0, 6) + "••••••" + key.slice(-4);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Chatbot Settings</h1>

        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
            <TabsTrigger value="apikeys">External Services</TabsTrigger>
            <TabsTrigger value="elife">e-Life Bridge</TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>General Configuration</CardTitle>
                <CardDescription>Control chatbot behavior and appearance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {configLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <Label>Enable Chatbot</Label>
                      <Switch checked={config.enabled === "true"} onCheckedChange={(v) => updateConfig("enabled", v ? "true" : "false")} />
                    </div>

                    <div className="space-y-2">
                      <Label>Bot Name</Label>
                      <Input value={config.bot_name ?? ""} onChange={(e) => updateConfig("bot_name", e.target.value)} />
                    </div>

                    <div className="space-y-2">
                      <Label>Welcome Message</Label>
                      <Textarea value={config.welcome_message ?? ""} onChange={(e) => updateConfig("welcome_message", e.target.value)} rows={3} />
                    </div>

                    <div className="space-y-2">
                      <Label>Response Language</Label>
                      <Select value={config.response_language ?? "malayalam"} onValueChange={(v) => updateConfig("response_language", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="malayalam">Malayalam (മലയാളം)</SelectItem>
                          <SelectItem value="english">English</SelectItem>
                          <SelectItem value="auto">Auto-detect</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Max History Messages</Label>
                      <Input type="number" value={config.max_history_messages ?? "20"} onChange={(e) => updateConfig("max_history_messages", e.target.value)} />
                    </div>

                    <div className="space-y-2">
                      <Label>Custom System Prompt (overrides default if set)</Label>
                      <Textarea value={config.system_prompt ?? ""} onChange={(e) => updateConfig("system_prompt", e.target.value || null)} rows={8} placeholder="Leave empty to use default prompt with knowledge base injected..." />
                    </div>

                    <Button onClick={saveConfig} disabled={saving}>
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Save Settings
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Knowledge Base */}
          <TabsContent value="knowledge">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Knowledge Base</CardTitle>
                  <CardDescription>Add service details, FAQs, and context the bot should know</CardDescription>
                </div>
                <Button size="sm" onClick={() => { setNewKnowledge(true); setEditingKnowledge(null); setKForm({ title: "", content: "", is_active: true }); }}>
                  <Plus className="mr-1 h-4 w-4" /> Add Entry
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {(newKnowledge || editingKnowledge) && (
                  <Card className="border-primary/30 bg-muted/30">
                    <CardContent className="pt-4 space-y-3">
                      <Input placeholder="Title (e.g. Return Policy)" value={kForm.title} onChange={(e) => setKForm({ ...kForm, title: e.target.value })} />
                      <Textarea placeholder="Content — service details, URLs, FAQs..." value={kForm.content} onChange={(e) => setKForm({ ...kForm, content: e.target.value })} rows={6} />
                      <div className="flex items-center gap-2">
                        <Switch checked={kForm.is_active} onCheckedChange={(v) => setKForm({ ...kForm, is_active: v })} />
                        <Label>Active</Label>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveKnowledge}>Save</Button>
                        <Button size="sm" variant="outline" onClick={() => { setNewKnowledge(false); setEditingKnowledge(null); }}>Cancel</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {knowledgeLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : knowledge.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">No knowledge entries yet</p>
                ) : (
                  knowledge.map((k) => (
                    <Card key={k.id} className={!k.is_active ? "opacity-50" : ""}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm">{k.title}</h3>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{k.content}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button size="icon" variant="ghost" onClick={() => { setEditingKnowledge(k); setNewKnowledge(false); setKForm({ title: k.title, content: k.content, is_active: k.is_active }); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete knowledge entry?</AlertDialogTitle>
                                  <AlertDialogDescription>This will remove "{k.title}" from the bot's context.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteKnowledge(k.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* External Services / API Keys */}
          <TabsContent value="apikeys">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>External Service API Keys</CardTitle>
                  <CardDescription>Store API keys for services the chatbot can reference</CardDescription>
                </div>
                <Button size="sm" onClick={() => { setNewApiKey(true); setEditingApiKey(null); setAkForm({ service_name: "", api_key: "", base_url: "", description: "", is_active: true }); }}>
                  <Plus className="mr-1 h-4 w-4" /> Add Service
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {(newApiKey || editingApiKey) && (
                  <Card className="border-primary/30 bg-muted/30">
                    <CardContent className="pt-4 space-y-3">
                      <Input placeholder="Service Name (e.g. Delivery Tracker)" value={akForm.service_name} onChange={(e) => setAkForm({ ...akForm, service_name: e.target.value })} />
                      <Input placeholder="API Key" value={akForm.api_key} onChange={(e) => setAkForm({ ...akForm, api_key: e.target.value })} />
                      <Input placeholder="Base URL (optional)" value={akForm.base_url} onChange={(e) => setAkForm({ ...akForm, base_url: e.target.value })} />
                      <Textarea placeholder="Description (optional)" value={akForm.description} onChange={(e) => setAkForm({ ...akForm, description: e.target.value })} rows={2} />
                      <div className="flex items-center gap-2">
                        <Switch checked={akForm.is_active} onCheckedChange={(v) => setAkForm({ ...akForm, is_active: v })} />
                        <Label>Active</Label>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveApiKey}>Save</Button>
                        <Button size="sm" variant="outline" onClick={() => { setNewApiKey(false); setEditingApiKey(null); }}>Cancel</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {apiKeysLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : apiKeys.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">No external services configured</p>
                ) : (
                  apiKeys.map((ak) => (
                    <Card key={ak.id} className={!ak.is_active ? "opacity-50" : ""}>
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm">{ak.service_name}</h3>
                            {ak.base_url && <p className="text-xs text-muted-foreground">{ak.base_url}</p>}
                            <p className="text-xs font-mono mt-1">
                              {visibleKeys.has(ak.id) ? ak.api_key : maskKey(ak.api_key)}
                              <button className="ml-2 text-muted-foreground hover:text-foreground" onClick={() => setVisibleKeys((prev) => { const n = new Set(prev); n.has(ak.id) ? n.delete(ak.id) : n.add(ak.id); return n; })}>
                                {visibleKeys.has(ak.id) ? <EyeOff className="h-3 w-3 inline" /> : <Eye className="h-3 w-3 inline" />}
                              </button>
                            </p>
                            {ak.description && <p className="text-xs text-muted-foreground mt-1">{ak.description}</p>}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button size="icon" variant="ghost" onClick={() => { setEditingApiKey(ak); setNewApiKey(false); setAkForm({ service_name: ak.service_name, api_key: ak.api_key, base_url: ak.base_url ?? "", description: ak.description ?? "", is_active: ak.is_active }); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete API key?</AlertDialogTitle>
                                  <AlertDialogDescription>This will remove the "{ak.service_name}" service key.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteApiKey(ak.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="elife">
            <ElifeBridgeTab />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default ChatbotSettingsPage;

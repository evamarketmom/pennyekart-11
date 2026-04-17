import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Plug, AlertTriangle } from "lucide-react";

type Cfg = Record<string, string | null>;

export const ElifeBridgeTab = () => {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<Cfg>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [tables, setTables] = useState<string[]>([]);
  const [allowed, setAllowed] = useState<Set<string>>(new Set());
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("chatbot_config").select("key, value");
      const map: Cfg = {};
      (data ?? []).forEach((r: any) => { map[r.key] = r.value; });
      setCfg(map);
      const allow = (map.elife_allowed_tables || "").split(",").map((s) => s.trim()).filter(Boolean);
      setAllowed(new Set(allow));
      setLoading(false);
    })();
    refreshAudit();
  }, []);

  const refreshAudit = async () => {
    const { data } = await supabase.from("chatbot_audit_log").select("*").order("created_at", { ascending: false }).limit(20);
    setAuditLogs(data ?? []);
  };

  const update = (k: string, v: string) => setCfg((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    const updates = [
      { key: "elife_enabled", value: cfg.elife_enabled || "false" },
      { key: "elife_write_enabled", value: cfg.elife_write_enabled || "false" },
      { key: "elife_twilio_passthrough", value: cfg.elife_twilio_passthrough || "false" },
      { key: "elife_allowed_tables", value: Array.from(allowed).join(",") },
    ];
    for (const u of updates) {
      const { data: existing } = await supabase.from("chatbot_config").select("id").eq("key", u.key).maybeSingle();
      if (existing) {
        await supabase.from("chatbot_config").update({ value: u.value }).eq("key", u.key);
      } else {
        await supabase.from("chatbot_config").insert(u);
      }
    }
    setSaving(false);
    toast({ title: "e-Life Bridge settings saved" });
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("elife-introspect");
      if (error) throw error;
      if (data?.tables) {
        setTables(data.tables);
        toast({ title: "Connected", description: `Found ${data.tables.length} tables in e-Life.` });
      } else {
        throw new Error(data?.error || "Unknown response");
      }
    } catch (e: any) {
      toast({ title: "Connection failed", description: e.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const toggleTable = (t: string) => {
    setAllowed((prev) => {
      const n = new Set(prev);
      n.has(t) ? n.delete(t) : n.add(t);
      return n;
    });
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" /> e-Life Society Bridge
          </CardTitle>
          <CardDescription>Connect Penny chatbot to the e-Life Society Supabase project</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable e-Life bridge</Label>
              <p className="text-xs text-muted-foreground">Lets the bot read e-Life data via tool calls</p>
            </div>
            <Switch checked={cfg.elife_enabled === "true"} onCheckedChange={(v) => update("elife_enabled", v ? "true" : "false")} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="flex items-center gap-2">Allow write operations <AlertTriangle className="h-3 w-3 text-amber-500" /></Label>
              <p className="text-xs text-muted-foreground">Bot can register customers / send commands (always with user confirmation)</p>
            </div>
            <Switch checked={cfg.elife_write_enabled === "true"} onCheckedChange={(v) => update("elife_write_enabled", v ? "true" : "false")} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Twilio WhatsApp passthrough</Label>
              <p className="text-xs text-muted-foreground">Queue commands into e-Life's whatsapp_commands table</p>
            </div>
            <Switch checked={cfg.elife_twilio_passthrough === "true"} onCheckedChange={(v) => update("elife_twilio_passthrough", v ? "true" : "false")} />
          </div>

          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between">
              <Label>Allowed e-Life tables</Label>
              <Button size="sm" variant="outline" onClick={testConnection} disabled={testing}>
                {testing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Test connection
              </Button>
            </div>
            {tables.length === 0 ? (
              <p className="text-xs text-muted-foreground">Click "Test connection" to load e-Life's tables, then pick which ones the bot may access.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 rounded border bg-muted/20">
                {tables.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={allowed.has(t)} onCheckedChange={() => toggleTable(t)} />
                    <span className="truncate">{t}</span>
                  </label>
                ))}
              </div>
            )}
            {allowed.size > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {Array.from(allowed).map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                ))}
              </div>
            )}
          </div>

          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save bridge settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Recent tool calls</CardTitle>
            <CardDescription>Last 20 cross-system calls made by the chatbot</CardDescription>
          </div>
          <Button size="sm" variant="ghost" onClick={refreshAudit}>Refresh</Button>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No tool calls yet</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {auditLogs.map((log) => (
                <div key={log.id} className="text-xs border rounded p-2 bg-muted/20">
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-mono font-semibold">{log.tool_name}</span>
                    <Badge variant={log.status === "success" ? "secondary" : "destructive"} className="text-[10px]">{log.status}</Badge>
                  </div>
                  <div className="text-muted-foreground mt-1">
                    {new Date(log.created_at).toLocaleString()} • {log.duration_ms}ms
                  </div>
                  {log.error_message && <p className="text-destructive mt-1">{log.error_message}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

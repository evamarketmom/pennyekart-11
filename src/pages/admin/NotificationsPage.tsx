import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, BarChart3, Loader2 } from "lucide-react";
import ImageUpload from "@/components/admin/ImageUpload";
import { useAuth } from "@/hooks/useAuth";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

interface Notification {
  id: string;
  title: string;
  message: string;
  image_url: string | null;
  link_url: string | null;
  link_label: string | null;
  target_audience: string;
  target_local_body_ids: string[];
  is_active: boolean;
  auto_dismiss_seconds: number;
  created_at: string;
}

interface LocalBody {
  id: string;
  name: string;
  body_type: string;
}

const PROJECT_ID = "xxlocaexuoowxdzupjcs";

const NotificationsPage = () => {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [localBodies, setLocalBodies] = useState<LocalBody[]>([]);
  const [editing, setEditing] = useState<Partial<Notification> | null>(null);
  const [analyticsFor, setAnalyticsFor] = useState<Notification | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [filterPanchayath, setFilterPanchayath] = useState("all");
  const [filterWard, setFilterWard] = useState("all");

  const fetchData = async () => {
    const [{ data: notifs }, { data: lbs }] = await Promise.all([
      supabase.from("notifications").select("*").order("created_at", { ascending: false }),
      supabase.from("locations_local_bodies").select("id, name, body_type").eq("is_active", true).order("name"),
    ]);
    setNotifications((notifs ?? []) as Notification[]);
    setLocalBodies(lbs ?? []);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!editing?.title || !editing?.message) {
      toast({ title: "Title and message required", variant: "destructive" });
      return;
    }
    const payload = {
      title: editing.title,
      message: editing.message,
      image_url: editing.image_url || null,
      link_url: editing.link_url || null,
      link_label: editing.link_label || null,
      target_audience: editing.target_audience || "all",
      target_local_body_ids: editing.target_local_body_ids || [],
      is_active: editing.is_active ?? true,
      auto_dismiss_seconds: Math.max(0, Number(editing.auto_dismiss_seconds) || 0),
    };
    const { error } = editing.id
      ? await supabase.from("notifications").update(payload).eq("id", editing.id)
      : await supabase.from("notifications").insert(payload);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Notification saved" });
    setEditing(null);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this notification?")) return;
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Deleted" });
    fetchData();
  };

  const openAnalytics = async (n: Notification) => {
    setAnalyticsFor(n);
    setAnalytics(null);
    setAnalyticsLoading(true);
    setFilterPanchayath("all");
    setFilterWard("all");
    try {
      const res = await fetch(
        `https://${PROJECT_ID}.supabase.co/functions/v1/notifications-resolve?action=analytics&notification_id=${n.id}`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      const data = await res.json();
      setAnalytics(data);
    } catch (e) {
      toast({ title: "Failed to load analytics", variant: "destructive" });
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const targetSummary = (n: Notification) => {
    if (n.target_audience === "all") return "All Users";
    if (n.target_audience === "agents") return "e-Life Agents";
    if (n.target_audience === "panchayath") {
      const names = n.target_local_body_ids
        .map((id) => localBodies.find((lb) => lb.id === id)?.name)
        .filter(Boolean)
        .slice(0, 2);
      return `Panchayath: ${names.join(", ")}${n.target_local_body_ids.length > 2 ? "..." : ""}`;
    }
    return n.target_audience;
  };

  const toggleLocalBody = (id: string) => {
    const cur = editing?.target_local_body_ids || [];
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    setEditing({ ...editing, target_local_body_ids: next });
  };

  const filteredUsers = (analytics?.users ?? []).filter((u: any) => {
    if (filterPanchayath !== "all" && u.local_body_name !== filterPanchayath) return false;
    if (filterWard !== "all" && String(u.ward_number) !== filterWard) return false;
    return true;
  });

  const uniquePanchayaths = Array.from(new Set((analytics?.users ?? []).map((u: any) => u.local_body_name).filter(Boolean)));
  const uniqueWards = Array.from(new Set(filteredUsers.map((u: any) => u.ward_number).filter((w: any) => w != null))).sort((a: any, b: any) => a - b);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-sm text-muted-foreground">Send announcements to customers, agents, or specific panchayaths</p>
          </div>
          <Button onClick={() => setEditing({ target_audience: "all", is_active: true, target_local_body_ids: [] })}>
            <Plus className="h-4 w-4 mr-2" /> New Notification
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notifications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No notifications yet
                    </TableCell>
                  </TableRow>
                ) : (
                  notifications.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {n.image_url && <img src={n.image_url} alt="" className="w-8 h-8 rounded object-cover" />}
                          <div>
                            <p className="font-medium">{n.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1 max-w-xs">{n.message}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{targetSummary(n)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={n.is_active ? "default" : "secondary"}>
                          {n.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(n.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openAnalytics(n)}>
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditing(n)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(n.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Edit / Create dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Notification" : "New Notification"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input value={editing?.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            </div>
            <div>
              <Label>Message *</Label>
              <Textarea
                rows={4}
                value={editing?.message || ""}
                onChange={(e) => setEditing({ ...editing, message: e.target.value })}
              />
            </div>
            <ImageUpload
              bucket="banners"
              value={editing?.image_url || ""}
              onChange={(url) => setEditing({ ...editing, image_url: url })}
              label="Image / Poster (optional)"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Link URL (optional)</Label>
                <Input
                  placeholder="https://... or /product/123"
                  value={editing?.link_url || ""}
                  onChange={(e) => setEditing({ ...editing, link_url: e.target.value })}
                />
              </div>
              <div>
                <Label>Link Button Label</Label>
                <Input
                  placeholder="Open"
                  value={editing?.link_label || ""}
                  onChange={(e) => setEditing({ ...editing, link_label: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Target Audience</Label>
              <Select
                value={editing?.target_audience || "all"}
                onValueChange={(v) => setEditing({ ...editing, target_audience: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="agents">e-Life Hierarchy Agents Only</SelectItem>
                  <SelectItem value="panchayath">Selected Panchayaths</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editing?.target_audience === "panchayath" && (
              <div>
                <Label>Select Panchayaths ({editing.target_local_body_ids?.length || 0} selected)</Label>
                <div className="border rounded-md max-h-48 overflow-y-auto p-2 space-y-1 mt-1">
                  {localBodies.map((lb) => (
                    <label key={lb.id} className="flex items-center gap-2 px-2 py-1 hover:bg-muted rounded cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={editing.target_local_body_ids?.includes(lb.id) || false}
                        onChange={() => toggleLocalBody(lb.id)}
                      />
                      <span>{lb.name}</span>
                      <Badge variant="outline" className="ml-auto text-[10px]">{lb.body_type}</Badge>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div>
              <Label>Auto-dismiss after (seconds)</Label>
              <Input
                type="number"
                min={0}
                placeholder="0 = stay until closed"
                value={editing?.auto_dismiss_seconds ?? 0}
                onChange={(e) => setEditing({ ...editing, auto_dismiss_seconds: Number(e.target.value) })}
              />
              <p className="text-xs text-muted-foreground mt-1">Set how many seconds the popup stays before auto-closing. Use 0 to keep it open until the user closes it.</p>
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={editing?.is_active ?? true}
                onCheckedChange={(c) => setEditing({ ...editing, is_active: c })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Analytics dialog */}
      <Dialog open={!!analyticsFor} onOpenChange={(o) => !o && setAnalyticsFor(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Analytics: {analyticsFor?.title}</DialogTitle>
          </DialogHeader>
          {analyticsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : analytics ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Delivered</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{analytics.totals.delivered}</p></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Read</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-primary">{analytics.totals.read}</p></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Clicked</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-emerald-600">{analytics.totals.clicked}</p></CardContent></Card>
              </div>

              <Accordion type="multiple" className="w-full">
                <AccordionItem value="by-panchayath">
                  <AccordionTrigger className="font-semibold">By Panchayath & Ward</AccordionTrigger>
                  <AccordionContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Panchayath</TableHead>
                          <TableHead>Ward</TableHead>
                          <TableHead className="text-right">Delivered</TableHead>
                          <TableHead className="text-right">Read</TableHead>
                          <TableHead className="text-right">Clicked</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(analytics.byPanchayath ?? []).map((g: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell>{g.local_body_name}</TableCell>
                            <TableCell>{g.ward_number ?? "-"}</TableCell>
                            <TableCell className="text-right">{g.delivered}</TableCell>
                            <TableCell className="text-right">{g.read}</TableCell>
                            <TableCell className="text-right">{g.clicked}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="per-user">
                  <AccordionTrigger className="font-semibold">Per-User Drilldown</AccordionTrigger>
                  <AccordionContent>
                    <div className="flex items-center justify-end mb-2 gap-2 flex-wrap">
                      <div className="flex gap-2">
                        <Select value={filterPanchayath} onValueChange={setFilterPanchayath}>
                          <SelectTrigger className="w-40 h-8"><SelectValue placeholder="Panchayath" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Panchayaths</SelectItem>
                            {uniquePanchayaths.map((p: any) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select value={filterWard} onValueChange={setFilterWard}>
                          <SelectTrigger className="w-32 h-8"><SelectValue placeholder="Ward" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Wards</SelectItem>
                            {uniqueWards.map((w: any) => <SelectItem key={w} value={String(w)}>Ward {w}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Mobile</TableHead>
                          <TableHead>Panchayath</TableHead>
                          <TableHead>Ward</TableHead>
                          <TableHead>Delivered</TableHead>
                          <TableHead>Read</TableHead>
                          <TableHead>Clicked</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((u: any) => (
                          <TableRow key={u.user_id}>
                            <TableCell>{u.full_name || "-"}</TableCell>
                            <TableCell className="text-xs">{u.mobile_number || "-"}</TableCell>
                            <TableCell>{u.local_body_name || "-"}</TableCell>
                            <TableCell>{u.ward_number ?? "-"}</TableCell>
                            <TableCell className="text-xs">{u.delivered_at ? new Date(u.delivered_at).toLocaleString() : "-"}</TableCell>
                            <TableCell className="text-xs">{u.read_at ? new Date(u.read_at).toLocaleString() : "-"}</TableCell>
                            <TableCell className="text-xs">{u.clicked_at ? new Date(u.clicked_at).toLocaleString() : "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default NotificationsPage;

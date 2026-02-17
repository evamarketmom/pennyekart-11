import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Search, Truck, Phone, Mail, MapPin, Settings2, Wallet } from "lucide-react";

interface DeliveryStaff {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  mobile_number: string | null;
  is_approved: boolean;
  created_at: string;
  local_body_id: string | null;
  ward_number: number | null;
  local_body_name?: string | null;
  district_name?: string | null;
  assigned_wards?: { local_body_id: string; local_body_name: string; ward_number: number }[];
}

interface LocalBody {
  id: string;
  name: string;
  ward_count: number;
  district_id: string;
}

const DeliveryManagementPage = () => {
  const [staff, setStaff] = useState<DeliveryStaff[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [localBodies, setLocalBodies] = useState<LocalBody[]>([]);
  const [wardDialogOpen, setWardDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<DeliveryStaff | null>(null);
  const [selectedLB, setSelectedLB] = useState("");
  const [selectedWards, setSelectedWards] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [settleDialogOpen, setSettleDialogOpen] = useState(false);
  const [settleStaff, setSettleStaff] = useState<DeliveryStaff | null>(null);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleNote, setSettleNote] = useState("");
  const [settleBalance, setSettleBalance] = useState(0);
  const [settling, setSettling] = useState(false);
  const { toast } = useToast();

  const fetchStaff = async () => {
    setLoading(true);
    const [profilesRes, localBodiesRes, districtsRes, assignmentsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_type", "delivery_staff"),
      supabase.from("locations_local_bodies").select("id, name, district_id, ward_count"),
      supabase.from("locations_districts").select("id, name"),
      supabase.from("delivery_staff_ward_assignments").select("*"),
    ]);

    const lbs = localBodiesRes.data ?? [];
    const districts = districtsRes.data ?? [];
    const assignments = assignmentsRes.data ?? [];
    setLocalBodies(lbs as LocalBody[]);

    const enriched = ((profilesRes.data ?? []) as unknown as DeliveryStaff[]).map((s) => {
      const staffAssignments = assignments
        .filter((a: any) => a.staff_user_id === s.user_id)
        .map((a: any) => {
          const lb = lbs.find((l) => l.id === a.local_body_id);
          return { local_body_id: a.local_body_id, local_body_name: lb?.name ?? "", ward_number: a.ward_number };
        });

      let local_body_name: string | null = null;
      let district_name: string | null = null;
      if (s.local_body_id) {
        const lb = lbs.find((l) => l.id === s.local_body_id);
        if (lb) {
          local_body_name = lb.name;
          const dist = districts.find((d) => d.id === lb.district_id);
          district_name = dist?.name ?? null;
        }
      }
      return { ...s, local_body_name, district_name, assigned_wards: staffAssignments };
    });

    setStaff(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchStaff(); }, []);

  const toggleApproval = async (userId: string, current: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_approved: !current }).eq("user_id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: !current ? "Staff approved" : "Staff unapproved" });
      fetchStaff();
    }
  };

  const openWardDialog = (s: DeliveryStaff) => {
    setSelectedStaff(s);
    setSelectedLB(s.local_body_id ?? "");
    setSelectedWards(
      (s.assigned_wards ?? [])
        .filter((w) => w.local_body_id === (s.local_body_id ?? ""))
        .map((w) => w.ward_number)
    );
    setWardDialogOpen(true);
  };

  const handleLBChange = (lbId: string) => {
    setSelectedLB(lbId);
    const existing = (selectedStaff?.assigned_wards ?? [])
      .filter((w) => w.local_body_id === lbId)
      .map((w) => w.ward_number);
    setSelectedWards(existing);
  };

  const toggleWard = (ward: number) => {
    setSelectedWards((prev) =>
      prev.includes(ward) ? prev.filter((w) => w !== ward) : [...prev, ward]
    );
  };

  const saveWardAssignments = async () => {
    if (!selectedStaff || !selectedLB) return;
    setSaving(true);

    // Delete existing assignments for this staff + local body
    await supabase
      .from("delivery_staff_ward_assignments")
      .delete()
      .eq("staff_user_id", selectedStaff.user_id)
      .eq("local_body_id", selectedLB);

    // Insert new assignments
    if (selectedWards.length > 0) {
      const rows = selectedWards.map((w) => ({
        staff_user_id: selectedStaff.user_id,
        local_body_id: selectedLB,
        ward_number: w,
      }));
      const { error } = await supabase.from("delivery_staff_ward_assignments").insert(rows);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    }

    toast({ title: "Ward assignments saved" });
    setSaving(false);
    setWardDialogOpen(false);
    fetchStaff();
  };

  const openSettleDialog = async (s: DeliveryStaff) => {
    setSettleStaff(s);
    setSettleAmount("");
    setSettleNote("");
    const { data } = await supabase.from("delivery_staff_wallets").select("balance").eq("staff_user_id", s.user_id).maybeSingle();
    setSettleBalance(data?.balance ?? 0);
    setSettleDialogOpen(true);
  };

  const handleSettle = async () => {
    if (!settleStaff || !settleAmount || Number(settleAmount) <= 0) return;
    const amt = Number(settleAmount);
    if (amt > settleBalance) {
      toast({ title: "Error", description: "Amount exceeds wallet balance", variant: "destructive" });
      return;
    }
    setSettling(true);

    // Get or create wallet
    let { data: wallet } = await supabase.from("delivery_staff_wallets").select("id").eq("staff_user_id", settleStaff.user_id).maybeSingle();
    if (!wallet) {
      const { data: newW } = await supabase.from("delivery_staff_wallets").insert({ staff_user_id: settleStaff.user_id }).select("id").single();
      wallet = newW;
    }
    if (!wallet) { setSettling(false); return; }

    // Insert settlement transaction
    const { error: txErr } = await supabase.from("delivery_staff_wallet_transactions").insert({
      staff_user_id: settleStaff.user_id,
      wallet_id: wallet.id,
      amount: amt,
      type: "settlement",
      description: settleNote || "Cash settlement by admin",
    });
    if (txErr) {
      toast({ title: "Error", description: txErr.message, variant: "destructive" });
      setSettling(false);
      return;
    }

    // Deduct balance
    const { error: walErr } = await supabase.from("delivery_staff_wallets").update({ balance: settleBalance - amt }).eq("staff_user_id", settleStaff.user_id);
    if (walErr) {
      toast({ title: "Error", description: walErr.message, variant: "destructive" });
      setSettling(false);
      return;
    }

    toast({ title: "Settlement recorded", description: `₹${amt} settled for ${settleStaff.full_name}` });
    setSettling(false);
    setSettleDialogOpen(false);
  };

  const filtered = staff.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.full_name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.mobile_number?.includes(q)
    );
  });

  const approvedCount = staff.filter((s) => s.is_approved).length;
  const pendingCount = staff.filter((s) => !s.is_approved).length;
  const selectedLBData = localBodies.find((l) => l.id === selectedLB);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Truck className="h-6 w-6 text-primary" />
              Delivery Staff Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Manage, approve and assign wards to delivery staff</p>
          </div>
          <div className="flex gap-3">
            <Badge variant="default" className="text-sm px-3 py-1">{approvedCount} Approved</Badge>
            <Badge variant="secondary" className="text-sm px-3 py-1">{pendingCount} Pending</Badge>
            <Badge variant="outline" className="text-sm px-3 py-1">{staff.length} Total</Badge>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, email, or phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Assigned Wards</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Approved</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No delivery staff found</TableCell></TableRow>
              ) : (
                filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.full_name ?? "—"}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {s.email && <div className="flex items-center gap-1.5 text-sm"><Mail className="h-3.5 w-3.5 text-muted-foreground" />{s.email}</div>}
                        {s.mobile_number && <div className="flex items-center gap-1.5 text-sm"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{s.mobile_number}</div>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {s.district_name || s.local_body_name ? (
                        <div className="flex items-center gap-1.5 text-sm">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>
                            {s.local_body_name && <span>{s.local_body_name}</span>}
                            {s.district_name && <span className="text-muted-foreground">, {s.district_name}</span>}
                          </span>
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {(s.assigned_wards ?? []).length > 0 ? (() => {
                        // Group by local body
                        const grouped: Record<string, number[]> = {};
                        s.assigned_wards!.forEach((w) => {
                          if (!grouped[w.local_body_name]) grouped[w.local_body_name] = [];
                          grouped[w.local_body_name].push(w.ward_number);
                        });
                        return (
                          <div className="space-y-0.5">
                            {Object.entries(grouped).map(([name, wards]) => (
                              <div key={name} className="text-sm">
                                <span className="font-medium">{name}</span>
                                <span className="text-muted-foreground ml-1">
                                  W{wards.sort((a, b) => a - b).join(", W")}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      })() : <span className="text-sm text-muted-foreground">None</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.is_approved ? "default" : "secondary"}>
                        {s.is_approved ? "Active" : "Pending"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch checked={s.is_approved} onCheckedChange={() => toggleApproval(s.user_id, s.is_approved)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => openWardDialog(s)}>
                          <Settings2 className="h-4 w-4 mr-1" /> Wards
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openSettleDialog(s)}>
                          <Wallet className="h-4 w-4 mr-1" /> Settle
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={wardDialogOpen} onOpenChange={setWardDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Wards — {selectedStaff?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Panchayath / Local Body</label>
              <Select value={selectedLB} onValueChange={handleLBChange}>
                <SelectTrigger><SelectValue placeholder="Select panchayath" /></SelectTrigger>
                <SelectContent>
                  {localBodies.map((lb) => (
                    <SelectItem key={lb.id} value={lb.id}>{lb.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedLBData && (
              <div>
                <label className="text-sm font-medium mb-2 block">Select Wards (1–{selectedLBData.ward_count})</label>
                <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto">
                  {Array.from({ length: selectedLBData.ward_count }, (_, i) => i + 1).map((w) => (
                    <label key={w} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <Checkbox checked={selectedWards.includes(w)} onCheckedChange={() => toggleWard(w)} />
                      W{w}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setWardDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveWardAssignments} disabled={saving}>
                {saving ? "Saving..." : "Save Assignments"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={settleDialogOpen} onOpenChange={setSettleDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Settle Wallet — {settleStaff?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm text-muted-foreground">Current Balance</span>
              <span className="text-lg font-bold">₹{settleBalance}</span>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Settlement Amount (₹)</label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                min={1}
                max={settleBalance}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Note (optional)</label>
              <Input
                placeholder="e.g. Cash collected on 17 Feb"
                value={settleNote}
                onChange={(e) => setSettleNote(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSettleDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSettle} disabled={settling || !settleAmount || Number(settleAmount) <= 0}>
                {settling ? "Settling..." : `Settle ₹${settleAmount || 0}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default DeliveryManagementPage;

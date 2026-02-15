import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Warehouse, Trash2, ArrowRightLeft, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Godown {
  id: string;
  name: string;
  godown_type: string;
  is_active: boolean;
  created_at: string;
}

interface LocalBody {
  id: string;
  name: string;
  body_type: string;
  ward_count: number;
}

interface GodownLocalBody {
  id: string;
  godown_id: string;
  local_body_id: string;
  locations_local_bodies?: LocalBody;
}

interface GodownWard {
  id: string;
  godown_id: string;
  local_body_id: string;
  ward_number: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  category: string | null;
}

interface StockItem {
  id: string;
  godown_id: string;
  product_id: string;
  quantity: number;
  purchase_price: number;
  batch_number: string | null;
  expiry_date: string | null;
  products?: Product;
}

interface StockTransfer {
  id: string;
  from_godown_id: string;
  to_godown_id: string;
  product_id: string;
  quantity: number;
  batch_number: string | null;
  status: string;
  transfer_type: string;
  created_at: string;
  products?: Product;
  from_godown?: Godown;
  to_godown?: Godown;
}

const GODOWN_TYPES = [
  { value: "micro", label: "Micro Godown", desc: "Under one panchayath, multi wards. Customer visible." },
  { value: "local", label: "Local Godown", desc: "Multi panchayath backup. Not customer visible." },
  { value: "area", label: "Area Godown", desc: "Multi panchayath + selling partners. Customer visible." },
];

const GodownsPage = () => {
  const { toast } = useToast();
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [localBodies, setLocalBodies] = useState<LocalBody[]>([]);
  const [godownLocalBodies, setGodownLocalBodies] = useState<GodownLocalBody[]>([]);
  const [godownWards, setGodownWards] = useState<GodownWard[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedGodown, setSelectedGodown] = useState<Godown | null>(null);
  const [form, setForm] = useState({ name: "", godown_type: "micro" });
  const [assignLocalBodyId, setAssignLocalBodyId] = useState("");
  const [selectedLocalBodyIds, setSelectedLocalBodyIds] = useState<string[]>([]);
  const [selectedWards, setSelectedWards] = useState<number[]>([]);
  const [allWards, setAllWards] = useState(false);
  const [activeTab, setActiveTab] = useState("micro");
  const [localBodySearch, setLocalBodySearch] = useState("");

  // Stock state
  const [products, setProducts] = useState<Product[]>([]);
  const [godownStock, setGodownStock] = useState<StockItem[]>([]);
  const [stockTransfers, setStockTransfers] = useState<StockTransfer[]>([]);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [stockGodown, setStockGodown] = useState<Godown | null>(null);
  const [stockForm, setStockForm] = useState({ product_id: "", quantity: 0, purchase_price: 0, batch_number: "", expiry_date: "" });
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferGodown, setTransferGodown] = useState<Godown | null>(null);
  const [transferForm, setTransferForm] = useState({ product_id: "", quantity: 0, to_godown_id: "", batch_number: "", transfer_type: "transfer" });
  const [godownInnerTab, setGodownInnerTab] = useState<Record<string, string>>({});

  const fetchGodowns = async () => {
    const { data } = await supabase.from("godowns").select("*").order("created_at", { ascending: false });
    if (data) setGodowns(data as Godown[]);
  };

  const fetchLocalBodies = async () => {
    const { data } = await supabase.from("locations_local_bodies").select("id, name, body_type, ward_count").eq("is_active", true);
    if (data) setLocalBodies(data as LocalBody[]);
  };

  const fetchGodownLocalBodies = async () => {
    const { data } = await supabase.from("godown_local_bodies").select("id, godown_id, local_body_id, locations_local_bodies(id, name, body_type, ward_count)");
    if (data) setGodownLocalBodies(data as unknown as GodownLocalBody[]);
  };

  const fetchGodownWards = async () => {
    const { data } = await supabase.from("godown_wards").select("*");
    if (data) setGodownWards(data as GodownWard[]);
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from("products").select("id, name, price, category").eq("is_active", true);
    if (data) setProducts(data as Product[]);
  };

  const fetchGodownStock = async () => {
    const { data } = await supabase.from("godown_stock").select("*, products(id, name, price, category)");
    if (data) setGodownStock(data as unknown as StockItem[]);
  };

  const fetchStockTransfers = async () => {
    const { data } = await supabase.from("stock_transfers")
      .select("*, products(id, name, price, category), from_godown:godowns!stock_transfers_from_godown_id_fkey(id, name, godown_type), to_godown:godowns!stock_transfers_to_godown_id_fkey(id, name, godown_type)")
      .order("created_at", { ascending: false });
    if (data) setStockTransfers(data as unknown as StockTransfer[]);
  };

  useEffect(() => {
    fetchGodowns();
    fetchLocalBodies();
    fetchGodownLocalBodies();
    fetchGodownWards();
    fetchProducts();
    fetchGodownStock();
    fetchStockTransfers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("godowns").insert({ name: form.name.trim(), godown_type: form.godown_type });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Godown created" }); setDialogOpen(false); setForm({ name: "", godown_type: "micro" }); fetchGodowns(); }
  };

  const selectedLocalBody = localBodies.find(lb => lb.id === assignLocalBodyId);
  const isMicroGodown = selectedGodown?.godown_type === "micro";

  const handleAssign = async () => {
    if (!selectedGodown) return;

    if (isMicroGodown) {
      if (!assignLocalBodyId) return;
      const wardNumbers = allWards
        ? Array.from({ length: selectedLocalBody?.ward_count ?? 0 }, (_, i) => i + 1)
        : selectedWards;

      if (wardNumbers.length === 0) {
        toast({ title: "Select at least one ward", variant: "destructive" });
        return;
      }

      const existing = godownLocalBodies.find(
        glb => glb.godown_id === selectedGodown.id && glb.local_body_id === assignLocalBodyId
      );
      if (!existing) {
        await supabase.from("godown_local_bodies").insert({ godown_id: selectedGodown.id, local_body_id: assignLocalBodyId });
      }

      const existingWards = godownWards.filter(
        w => w.godown_id === selectedGodown.id && w.local_body_id === assignLocalBodyId
      );
      if (existingWards.length > 0) {
        await supabase.from("godown_wards").delete().in("id", existingWards.map(w => w.id));
      }

      const rows = wardNumbers.map(wn => ({
        godown_id: selectedGodown.id,
        local_body_id: assignLocalBodyId,
        ward_number: wn,
      }));
      const { error } = await supabase.from("godown_wards").insert(rows);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: `${wardNumbers.length} ward(s) assigned` });
    } else {
      if (selectedLocalBodyIds.length === 0) {
        toast({ title: "Select at least one panchayath", variant: "destructive" });
        return;
      }
      const existingIds = godownLocalBodies
        .filter(glb => glb.godown_id === selectedGodown.id)
        .map(glb => glb.local_body_id);
      const newIds = selectedLocalBodyIds.filter(id => !existingIds.includes(id));
      if (newIds.length === 0) {
        toast({ title: "All selected panchayaths are already assigned", variant: "destructive" });
        return;
      }
      const rows = newIds.map(id => ({ godown_id: selectedGodown.id, local_body_id: id }));
      const { error } = await supabase.from("godown_local_bodies").insert(rows);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: `${newIds.length} panchayath(s) assigned` });
    }

    resetAssignForm();
    fetchGodownLocalBodies();
    fetchGodownWards();
  };

  const resetAssignForm = () => {
    setAssignLocalBodyId("");
    setSelectedLocalBodyIds([]);
    setSelectedWards([]);
    setAllWards(false);
    setLocalBodySearch("");
  };

  const handleRemoveAssignment = async (glbId: string, godownId: string, localBodyId: string) => {
    const wardsToRemove = godownWards.filter(w => w.godown_id === godownId && w.local_body_id === localBodyId);
    if (wardsToRemove.length > 0) {
      await supabase.from("godown_wards").delete().in("id", wardsToRemove.map(w => w.id));
    }
    await supabase.from("godown_local_bodies").delete().eq("id", glbId);
    fetchGodownLocalBodies();
    fetchGodownWards();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("godowns").delete().eq("id", id);
    fetchGodowns(); fetchGodownLocalBodies(); fetchGodownWards();
  };

  const toggleWard = (ward: number) => {
    setAllWards(false);
    setSelectedWards(prev => prev.includes(ward) ? prev.filter(w => w !== ward) : [...prev, ward]);
  };

  const handleAllWardsChange = (checked: boolean) => {
    setAllWards(checked);
    if (checked && selectedLocalBody) {
      setSelectedWards(Array.from({ length: selectedLocalBody.ward_count }, (_, i) => i + 1));
    } else {
      setSelectedWards([]);
    }
  };

  const filteredGodowns = godowns.filter(g => g.godown_type === activeTab);

  const filteredLocalBodies = localBodies.filter(lb =>
    lb.name.toLowerCase().includes(localBodySearch.toLowerCase()) ||
    lb.body_type.toLowerCase().includes(localBodySearch.toLowerCase())
  );

  const toggleLocalBody = (id: string) => {
    setSelectedLocalBodyIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAllFilteredLocalBodies = (checked: boolean) => {
    if (checked) {
      const allIds = filteredLocalBodies.map(lb => lb.id);
      setSelectedLocalBodyIds(prev => [...new Set([...prev, ...allIds])]);
    } else {
      const filteredIds = new Set(filteredLocalBodies.map(lb => lb.id));
      setSelectedLocalBodyIds(prev => prev.filter(id => !filteredIds.has(id)));
    }
  };

  const getWardsForAssignment = (godownId: string, localBodyId: string) => {
    return godownWards
      .filter(w => w.godown_id === godownId && w.local_body_id === localBodyId)
      .map(w => w.ward_number)
      .sort((a, b) => a - b);
  };

  // Stock handlers
  const handleAddStock = async () => {
    if (!stockGodown || !stockForm.product_id || stockForm.quantity <= 0) {
      toast({ title: "Fill all required fields", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("godown_stock").insert({
      godown_id: stockGodown.id,
      product_id: stockForm.product_id,
      quantity: stockForm.quantity,
      purchase_price: stockForm.purchase_price,
      batch_number: stockForm.batch_number || null,
      expiry_date: stockForm.expiry_date || null,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Stock added" });
      setStockDialogOpen(false);
      setStockForm({ product_id: "", quantity: 0, purchase_price: 0, batch_number: "", expiry_date: "" });
      fetchGodownStock();
    }
  };

  const handleDeleteStock = async (stockId: string) => {
    await supabase.from("godown_stock").delete().eq("id", stockId);
    fetchGodownStock();
  };

  // Transfer handlers
  const handleCreateTransfer = async () => {
    if (!transferGodown || !transferForm.product_id || !transferForm.to_godown_id || transferForm.quantity <= 0) {
      toast({ title: "Fill all required fields", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("stock_transfers").insert({
      from_godown_id: transferGodown.id,
      to_godown_id: transferForm.to_godown_id,
      product_id: transferForm.product_id,
      quantity: transferForm.quantity,
      batch_number: transferForm.batch_number || null,
      transfer_type: transferForm.transfer_type,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Transfer created" });
      setTransferDialogOpen(false);
      setTransferForm({ product_id: "", quantity: 0, to_godown_id: "", batch_number: "", transfer_type: "transfer" });
      fetchStockTransfers();
    }
  };

  const handleUpdateTransferStatus = async (transferId: string, status: string) => {
    await supabase.from("stock_transfers").update({ status }).eq("id", transferId);
    fetchStockTransfers();
    toast({ title: `Transfer ${status}` });
  };

  const getGodownInnerTab = (godownId: string) => godownInnerTab[godownId] || "assignments";
  const setInnerTab = (godownId: string, tab: string) => setGodownInnerTab(prev => ({ ...prev, [godownId]: tab }));

  // Get stock for a specific godown
  const getStockForGodown = (godownId: string) => godownStock.filter(s => s.godown_id === godownId);

  // Get transfers related to a godown
  const getTransfersForGodown = (godownId: string) =>
    stockTransfers.filter(t => t.from_godown_id === godownId || t.to_godown_id === godownId);

  // Get eligible target godowns for transfer
  const getTransferTargets = (fromGodown: Godown) => {
    if (fromGodown.godown_type === "local") {
      return godowns.filter(g => g.godown_type === "micro" && g.id !== fromGodown.id);
    }
    if (fromGodown.godown_type === "micro") {
      return godowns.filter(g => g.godown_type === "local" && g.id !== fromGodown.id);
    }
    if (fromGodown.godown_type === "area") {
      return godowns.filter(g => g.id !== fromGodown.id);
    }
    return [];
  };

  // Get available stock products for a godown (for transfer)
  const getStockProducts = (godownId: string) => {
    return godownStock.filter(s => s.godown_id === godownId && s.quantity > 0);
  };

  const renderAssignments = (g: Godown) => {
    const assignments = godownLocalBodies.filter(glb => glb.godown_id === g.id);
    return (
      <div>
        <p className="mb-2 text-sm text-muted-foreground">
          {g.godown_type === "micro" ? "Assigned Panchayaths & Wards:" : "Assigned Panchayaths:"}
        </p>
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">None assigned</p>
        ) : (
          <div className="space-y-2">
            {assignments.map(a => {
              const wards = getWardsForAssignment(g.id, a.local_body_id);
              const lb = a.locations_local_bodies;
              const isAllWards = lb && wards.length === lb.ward_count;
              return (
                <div key={a.id} className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="gap-1">
                    {lb?.name ?? "Unknown"}
                    <button onClick={() => handleRemoveAssignment(a.id, g.id, a.local_body_id)} className="ml-1 text-destructive hover:text-destructive/80">×</button>
                  </Badge>
                  {g.godown_type === "micro" && wards.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {isAllWards ? "All wards" : `Ward ${wards.join(", ")}`}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderStockDetails = (g: Godown) => {
    const stock = getStockForGodown(g.id);
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">Stock Items ({stock.length})</p>
          {g.godown_type !== "micro" && (
            <Button size="sm" onClick={() => { setStockGodown(g); setStockForm({ product_id: "", quantity: 0, purchase_price: 0, batch_number: "", expiry_date: "" }); setStockDialogOpen(true); }}>
              <Plus className="mr-1 h-3 w-3" /> Add Stock
            </Button>
          )}
        </div>
        {stock.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-4 text-center">No stock items</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Purchase Price</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stock.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.products?.name ?? "Unknown"}</TableCell>
                    <TableCell>{s.quantity}</TableCell>
                    <TableCell>₹{s.purchase_price}</TableCell>
                    <TableCell>{s.batch_number || "-"}</TableCell>
                    <TableCell>{s.expiry_date || "-"}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => handleDeleteStock(s.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  };

  const renderStockTransfers = (g: Godown) => {
    const transfers = getTransfersForGodown(g.id);
    const isLocal = g.godown_type === "local";
    const isMicro = g.godown_type === "micro";

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm font-medium text-muted-foreground">Stock Transfers</p>
          <div className="flex gap-2">
            {isLocal && (
              <Button size="sm" onClick={() => {
                setTransferGodown(g);
                setTransferForm({ product_id: "", quantity: 0, to_godown_id: "", batch_number: "", transfer_type: "transfer" });
                setTransferDialogOpen(true);
              }}>
                <ArrowRightLeft className="mr-1 h-3 w-3" /> Transfer to Micro
              </Button>
            )}
            {isMicro && (
              <Button size="sm" variant="outline" onClick={() => {
                setTransferGodown(g);
                setTransferForm({ product_id: "", quantity: 0, to_godown_id: "", batch_number: "", transfer_type: "return" });
                setTransferDialogOpen(true);
              }}>
                <ArrowRightLeft className="mr-1 h-3 w-3" /> Return to Local
              </Button>
            )}
          </div>
        </div>
        {transfers.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-4 text-center">No transfers</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.products?.name ?? "Unknown"}</TableCell>
                    <TableCell>{t.from_godown?.name ?? "Unknown"}</TableCell>
                    <TableCell>{t.to_godown?.name ?? "Unknown"}</TableCell>
                    <TableCell>{t.quantity}</TableCell>
                    <TableCell>
                      <Badge variant={t.transfer_type === "return" ? "secondary" : "default"}>
                        {t.transfer_type === "return" ? "Return" : "Transfer"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.status === "completed" ? "default" : t.status === "pending" ? "secondary" : "destructive"}>
                        {t.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {t.status === "pending" && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => handleUpdateTransferStatus(t.id, "completed")}>
                            Approve
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleUpdateTransferStatus(t.id, "rejected")}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Godowns</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add Godown</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Godown</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required maxLength={200} /></div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.godown_type} onValueChange={v => setForm({ ...form, godown_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GODOWN_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">{GODOWN_TYPES.find(t => t.value === form.godown_type)?.desc}</p>
                </div>
                <Button type="submit" className="w-full">Create</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {GODOWN_TYPES.map(t => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label} ({godowns.filter(g => g.godown_type === t.value).length})
              </TabsTrigger>
            ))}
          </TabsList>

          {GODOWN_TYPES.map(t => (
            <TabsContent key={t.value} value={t.value}>
              <div className="space-y-4">
                {filteredGodowns.length === 0 ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground">No {t.label}s yet.</CardContent></Card>
                ) : filteredGodowns.map(g => (
                  <Card key={g.id}>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Warehouse className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">{g.name}</CardTitle>
                        <Badge variant={g.is_active ? "default" : "secondary"}>{g.is_active ? "Active" : "Inactive"}</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setSelectedGodown(g); resetAssignForm(); setAssignDialogOpen(true); }}>
                          {g.godown_type === "micro" ? "Assign Wards" : "Assign Panchayath"}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(g.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Tabs value={getGodownInnerTab(g.id)} onValueChange={(tab) => setInnerTab(g.id, tab)}>
                        <TabsList className="mb-3">
                          <TabsTrigger value="assignments">Assignments</TabsTrigger>
                          <TabsTrigger value="stock">
                            <Package className="mr-1 h-3 w-3" /> Stock Details ({getStockForGodown(g.id).length})
                          </TabsTrigger>
                          <TabsTrigger value="transfers">
                            <ArrowRightLeft className="mr-1 h-3 w-3" /> Transfers ({getTransfersForGodown(g.id).length})
                          </TabsTrigger>
                        </TabsList>
                        <TabsContent value="assignments">{renderAssignments(g)}</TabsContent>
                        <TabsContent value="stock">{renderStockDetails(g)}</TabsContent>
                        <TabsContent value="transfers">{renderStockTransfers(g)}</TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Assign Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={(open) => { setAssignDialogOpen(open); if (!open) resetAssignForm(); }}>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {isMicroGodown ? `Assign Wards to ${selectedGodown?.name}` : `Assign Panchayath to ${selectedGodown?.name}`}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {isMicroGodown ? (
                <>
                  <div>
                    <Label>Search Panchayath</Label>
                    <Input placeholder="Search panchayath..." value={localBodySearch} onChange={e => setLocalBodySearch(e.target.value)} className="mb-2" />
                    <Select value={assignLocalBodyId} onValueChange={(v) => { setAssignLocalBodyId(v); setSelectedWards([]); setAllWards(false); }}>
                      <SelectTrigger><SelectValue placeholder="Select panchayath" /></SelectTrigger>
                      <SelectContent>
                        {filteredLocalBodies.map(lb => <SelectItem key={lb.id} value={lb.id}>{lb.name} ({lb.body_type})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {assignLocalBodyId && selectedLocalBody && (() => {
                    const allocatedByOthers = godownWards
                      .filter(w => w.local_body_id === assignLocalBodyId && w.godown_id !== selectedGodown?.id)
                      .map(w => w.ward_number);
                    const availableWards = Array.from({ length: selectedLocalBody.ward_count }, (_, i) => i + 1)
                      .filter(w => !allocatedByOthers.includes(w));

                    return (
                      <div>
                        <Label className="mb-2 block">
                          Select Wards ({availableWards.length} available of {selectedLocalBody.ward_count})
                        </Label>
                        {allocatedByOthers.length > 0 && (
                          <p className="text-xs text-muted-foreground mb-2">
                            Ward {allocatedByOthers.sort((a, b) => a - b).join(", ")} already assigned to other micro godowns
                          </p>
                        )}
                        {availableWards.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4 text-center">All wards are already assigned to other micro godowns</p>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 mb-3">
                              <Checkbox id="all-wards" checked={allWards} onCheckedChange={(c) => {
                                setAllWards(!!c);
                                setSelectedWards(c ? availableWards : []);
                              }} />
                              <label htmlFor="all-wards" className="text-sm font-medium cursor-pointer">All Available Wards</label>
                            </div>
                            <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto">
                              {availableWards.map(ward => (
                                <label key={ward} className="flex items-center gap-1.5 text-sm cursor-pointer">
                                  <Checkbox checked={selectedWards.includes(ward)} onCheckedChange={() => toggleWard(ward)} />
                                  {ward}
                                </label>
                              ))}
                            </div>
                          </>
                        )}
                        {selectedWards.length > 0 && (
                          <p className="mt-2 text-xs text-muted-foreground">{selectedWards.length} ward(s) selected</p>
                        )}
                      </div>
                    );
                  })()}

                  <Button onClick={handleAssign} disabled={!assignLocalBodyId || selectedWards.length === 0} className="w-full">
                    Assign
                  </Button>
                </>
              ) : (
                <>
                  <div>
                    <Label>Search Panchayath</Label>
                    <Input placeholder="Search panchayath..." value={localBodySearch} onChange={e => setLocalBodySearch(e.target.value)} />
                  </div>
                  <div className="flex items-center gap-2 border-b pb-2">
                    <Checkbox
                      id="select-all-lb"
                      checked={filteredLocalBodies.length > 0 && filteredLocalBodies.every(lb => selectedLocalBodyIds.includes(lb.id))}
                      onCheckedChange={(c) => selectAllFilteredLocalBodies(!!c)}
                    />
                    <label htmlFor="select-all-lb" className="text-sm font-medium cursor-pointer">Select All ({filteredLocalBodies.length})</label>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {filteredLocalBodies.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">No panchayaths found</p>
                    ) : filteredLocalBodies.map(lb => {
                      const alreadyAssigned = godownLocalBodies.some(
                        glb => glb.godown_id === selectedGodown?.id && glb.local_body_id === lb.id
                      );
                      return (
                        <label key={lb.id} className={`flex items-center gap-2 text-sm cursor-pointer p-1.5 rounded hover:bg-muted ${alreadyAssigned ? "opacity-50" : ""}`}>
                          <Checkbox
                            checked={selectedLocalBodyIds.includes(lb.id)}
                            onCheckedChange={() => toggleLocalBody(lb.id)}
                            disabled={alreadyAssigned}
                          />
                          <span>{lb.name}</span>
                          <Badge variant="outline" className="text-xs ml-auto">{lb.body_type}</Badge>
                          {alreadyAssigned && <span className="text-xs text-muted-foreground">Assigned</span>}
                        </label>
                      );
                    })}
                  </div>
                  {selectedLocalBodyIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">{selectedLocalBodyIds.length} panchayath(s) selected</p>
                  )}
                  <Button onClick={handleAssign} disabled={selectedLocalBodyIds.length === 0} className="w-full">
                    Assign {selectedLocalBodyIds.length > 0 ? `(${selectedLocalBodyIds.length})` : ""}
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Stock Dialog */}
        <Dialog open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Stock to {stockGodown?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Product</Label>
                <Select value={stockForm.product_id} onValueChange={v => setStockForm({ ...stockForm, product_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    {products.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} (₹{p.price})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" min={1} value={stockForm.quantity || ""} onChange={e => setStockForm({ ...stockForm, quantity: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Purchase Price (₹)</Label>
                  <Input type="number" min={0} step="0.01" value={stockForm.purchase_price || ""} onChange={e => setStockForm({ ...stockForm, purchase_price: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Batch Number</Label>
                  <Input value={stockForm.batch_number} onChange={e => setStockForm({ ...stockForm, batch_number: e.target.value })} placeholder="Optional" />
                </div>
                <div>
                  <Label>Expiry Date</Label>
                  <Input type="date" value={stockForm.expiry_date} onChange={e => setStockForm({ ...stockForm, expiry_date: e.target.value })} />
                </div>
              </div>
              <Button className="w-full" onClick={handleAddStock}>Add Stock</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Stock Transfer Dialog */}
        <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {transferForm.transfer_type === "return"
                  ? `Return Stock from ${transferGodown?.name}`
                  : `Transfer Stock from ${transferGodown?.name}`
                }
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Product (from stock)</Label>
                <Select value={transferForm.product_id} onValueChange={v => setTransferForm({ ...transferForm, product_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    {transferGodown && getStockProducts(transferGodown.id).map(s => (
                      <SelectItem key={s.id} value={s.product_id}>
                        {s.products?.name ?? "Unknown"} (Available: {s.quantity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{transferForm.transfer_type === "return" ? "Return to Godown" : "Transfer to Godown"}</Label>
                <Select value={transferForm.to_godown_id} onValueChange={v => setTransferForm({ ...transferForm, to_godown_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select godown" /></SelectTrigger>
                  <SelectContent>
                    {transferGodown && getTransferTargets(transferGodown).map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name} ({g.godown_type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" min={1} value={transferForm.quantity || ""} onChange={e => setTransferForm({ ...transferForm, quantity: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Batch Number</Label>
                  <Input value={transferForm.batch_number} onChange={e => setTransferForm({ ...transferForm, batch_number: e.target.value })} placeholder="Optional" />
                </div>
              </div>
              <Button className="w-full" onClick={handleCreateTransfer}>
                {transferForm.transfer_type === "return" ? "Create Return" : "Create Transfer"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default GodownsPage;

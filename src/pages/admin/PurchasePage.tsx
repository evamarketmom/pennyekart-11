import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart, Plus, Trash2, Send, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  price: number;
  category: string | null;
  purchase_rate: number;
  mrp: number;
  discount_rate: number;
}

interface Godown {
  id: string;
  name: string;
  godown_type: string;
  is_active: boolean;
}

interface PurchaseItem {
  product_id: string;
  quantity: number;
  purchase_rate: number;
  mrp: number;
  discount_rate: number;
  batch_number: string;
  expiry_date: string;
  mrp_changed: boolean;
}

interface StockHistory {
  id: string;
  quantity: number;
  purchase_price: number;
  batch_number: string | null;
  expiry_date: string | null;
  created_at: string;
  godown_name: string;
  product_name: string;
}

const PurchasePage = () => {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [localGodowns, setLocalGodowns] = useState<Godown[]>([]);
  const [selectedGodownIds, setSelectedGodownIds] = useState<string[]>([]);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // History state
  const [history, setHistory] = useState<StockHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const [prodRes, gdRes] = await Promise.all([
        supabase.from("products").select("id, name, price, category, purchase_rate, mrp, discount_rate").eq("is_active", true).order("name"),
        supabase.from("godowns").select("*").eq("godown_type", "local").eq("is_active", true).order("name"),
      ]);
      if (prodRes.data) setProducts(prodRes.data as Product[]);
      if (gdRes.data) setLocalGodowns(gdRes.data as Godown[]);
    };
    fetchData();
  }, []);

  const addItem = () => {
    setItems(prev => [...prev, { product_id: "", quantity: 1, purchase_rate: 0, mrp: 0, discount_rate: 0, batch_number: "", expiry_date: "", mrp_changed: false }]);
  };

  const handleProductSelect = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    setItems(prev => prev.map((item, i) =>
      i === index ? {
        ...item,
        product_id: productId,
        purchase_rate: product.purchase_rate,
        mrp: product.mrp,
        discount_rate: product.discount_rate,
        mrp_changed: false,
      } : item
    ));
  };

  const updateItem = (index: number, field: keyof PurchaseItem, value: string | number | boolean) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      if (field === "mrp") {
        const product = products.find(p => p.id === item.product_id);
        updated.mrp_changed = product ? Number(value) !== product.mrp : false;
      }
      return updated;
    }));
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const toggleGodown = (id: string) => {
    setSelectedGodownIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = (checked: boolean) => {
    setSelectedGodownIds(checked ? localGodowns.map(g => g.id) : []);
  };

  const handleSubmit = async () => {
    if (selectedGodownIds.length === 0) {
      toast({ title: "Select at least one godown", variant: "destructive" });
      return;
    }
    const validItems = items.filter(i => i.product_id && i.quantity > 0);
    if (validItems.length === 0) {
      toast({ title: "Add at least one product with quantity", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    // Update MRP on products where it was changed
    const mrpUpdates = validItems.filter(i => i.mrp_changed);
    for (const item of mrpUpdates) {
      await supabase.from("products").update({ mrp: item.mrp }).eq("id", item.product_id);
    }

    const rows = selectedGodownIds.flatMap(godownId =>
      validItems.map(item => ({
        godown_id: godownId,
        product_id: item.product_id,
        quantity: item.quantity,
        purchase_price: item.purchase_rate,
        batch_number: item.batch_number || null,
        expiry_date: item.expiry_date || null,
      }))
    );

    const { error } = await supabase.from("godown_stock").insert(rows);
    setSubmitting(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Stock added to ${selectedGodownIds.length} godown(s) — ${validItems.length} product(s)` });
      setItems([]);
      setSelectedGodownIds([]);
      // Refresh products to get updated MRPs
      if (mrpUpdates.length > 0) {
        const { data } = await supabase.from("products").select("id, name, price, category, purchase_rate, mrp, discount_rate").eq("is_active", true).order("name");
        if (data) setProducts(data as Product[]);
      }
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    let query = supabase
      .from("godown_stock")
      .select("id, quantity, purchase_price, batch_number, expiry_date, created_at, godown_id, product_id")
      .order("created_at", { ascending: false })
      .limit(100);

    if (dateFrom) query = query.gte("created_at", dateFrom);
    if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");

    const { data } = await query;
    if (data) {
      const mapped: StockHistory[] = data.map((row: any) => ({
        id: row.id,
        quantity: row.quantity,
        purchase_price: row.purchase_price,
        batch_number: row.batch_number,
        expiry_date: row.expiry_date,
        created_at: row.created_at,
        godown_name: localGodowns.find(g => g.id === row.godown_id)?.name ?? row.godown_id,
        product_name: products.find(p => p.id === row.product_id)?.name ?? row.product_id,
      }));
      setHistory(mapped);
    }
    setHistoryLoading(false);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShoppingCart className="h-6 w-6" /> Purchase — Add Stock
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Add products to multiple local godowns at once.
            </p>
          </div>
        </div>

        <Tabs defaultValue="purchase">
          <TabsList>
            <TabsTrigger value="purchase" className="gap-1"><ShoppingCart className="h-4 w-4" /> New Purchase</TabsTrigger>
            <TabsTrigger value="history" className="gap-1"><History className="h-4 w-4" /> History</TabsTrigger>
          </TabsList>

          <TabsContent value="purchase" className="space-y-6 mt-4">
            {/* Select Godowns */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">1. Select Local Godowns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  <Checkbox
                    checked={selectedGodownIds.length === localGodowns.length && localGodowns.length > 0}
                    onCheckedChange={(checked) => selectAll(!!checked)}
                  />
                  <span className="text-sm font-medium">Select All ({localGodowns.length})</span>
                  {selectedGodownIds.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{selectedGodownIds.length} selected</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {localGodowns.map(g => (
                    <label
                      key={g.id}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors text-sm ${
                        selectedGodownIds.includes(g.id) ? "border-primary bg-primary/10" : "border-border"
                      }`}
                    >
                      <Checkbox
                        checked={selectedGodownIds.includes(g.id)}
                        onCheckedChange={() => toggleGodown(g.id)}
                      />
                      {g.name}
                    </label>
                  ))}
                  {localGodowns.length === 0 && (
                    <p className="text-sm text-muted-foreground italic">No local godowns found</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Product Items */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">2. Add Products</CardTitle>
                  <Button size="sm" onClick={addItem}>
                    <Plus className="mr-1 h-3 w-3" /> Add Product
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic text-center py-6">
                    Click "Add Product" to start adding items to purchase.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {items.map((item, index) => (
                      <div key={index} className="border rounded-lg p-3 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Product</Label>
                            <Select value={item.product_id} onValueChange={v => handleProductSelect(index, v)}>
                              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                              <SelectContent>
                                {products.map(p => (
                                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Quantity</Label>
                            <Input type="number" min={1} value={item.quantity} onChange={e => updateItem(index, "quantity", parseInt(e.target.value) || 0)} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs">Purchase Rate</Label>
                            <Input type="number" min={0} step="0.01" value={item.purchase_rate} onChange={e => updateItem(index, "purchase_rate", parseFloat(e.target.value) || 0)} />
                          </div>
                          <div>
                            <Label className="text-xs flex items-center gap-1">
                              MRP
                              {item.mrp_changed && <Badge variant="outline" className="text-[10px] px-1 py-0 text-orange-600 border-orange-300">changed</Badge>}
                            </Label>
                            <Input type="number" min={0} step="0.01" value={item.mrp} onChange={e => updateItem(index, "mrp", parseFloat(e.target.value) || 0)} />
                          </div>
                          <div>
                            <Label className="text-xs">Discount Rate (%)</Label>
                            <Input type="number" min={0} step="0.01" value={item.discount_rate} onChange={e => updateItem(index, "discount_rate", parseFloat(e.target.value) || 0)} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
                          <div>
                            <Label className="text-xs">Batch No.</Label>
                            <Input value={item.batch_number} onChange={e => updateItem(index, "batch_number", e.target.value)} placeholder="Optional" />
                          </div>
                          <div>
                            <Label className="text-xs">Expiry</Label>
                            <Input type="date" value={item.expiry_date} onChange={e => updateItem(index, "expiry_date", e.target.value)} />
                          </div>
                          <div className="flex justify-end">
                            <Button variant="ghost" size="icon" onClick={() => removeItem(index)} className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Summary & Submit */}
            {items.length > 0 && selectedGodownIds.length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{items.filter(i => i.product_id && i.quantity > 0).length}</span> product(s) →{" "}
                      <span className="font-medium text-foreground">{selectedGodownIds.length}</span> godown(s) ={" "}
                      <span className="font-medium text-foreground">{items.filter(i => i.product_id && i.quantity > 0).length * selectedGodownIds.length}</span> stock entries
                      {items.some(i => i.mrp_changed) && (
                        <span className="ml-2 text-orange-600 text-xs">• MRP will be updated on {items.filter(i => i.mrp_changed).length} product(s)</span>
                      )}
                    </div>
                    <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
                      <Send className="h-4 w-4" />
                      {submitting ? "Adding Stock..." : "Add Stock to All Selected Godowns"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Purchase History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-end gap-3 mb-4">
                  <div>
                    <Label className="text-xs">From</Label>
                    <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">To</Label>
                    <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                  </div>
                  <Button size="sm" onClick={fetchHistory} disabled={historyLoading}>
                    {historyLoading ? "Loading..." : "Search"}
                  </Button>
                </div>

                {history.length > 0 ? (
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Godown</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead>Purchase Price</TableHead>
                          <TableHead>Batch</TableHead>
                          <TableHead>Expiry</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.map(h => (
                          <TableRow key={h.id}>
                            <TableCell className="text-xs">{new Date(h.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="font-medium text-sm">{h.product_name}</TableCell>
                            <TableCell className="text-sm">{h.godown_name}</TableCell>
                            <TableCell>{h.quantity}</TableCell>
                            <TableCell>₹{h.purchase_price}</TableCell>
                            <TableCell className="text-xs">{h.batch_number ?? "—"}</TableCell>
                            <TableCell className="text-xs">{h.expiry_date ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic text-center py-6">
                    Select a date range and click Search to view purchase history.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default PurchasePage;

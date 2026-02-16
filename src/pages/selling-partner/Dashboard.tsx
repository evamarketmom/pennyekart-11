import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, Plus, LogOut, Store, ShoppingCart, Wallet, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ImageUpload from "@/components/admin/ImageUpload";
import logo from "@/assets/logo.png";

interface SellerProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  is_approved: boolean;
  is_active: boolean;
  is_featured: boolean;
  stock: number;
  area_godown_id: string | null;
  image_url: string | null;
  image_url_2: string | null;
  image_url_3: string | null;
  purchase_rate: number;
  mrp: number;
  discount_rate: number;
  created_at: string;
}

interface Godown {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  category_type: string;
}

interface Order {
  id: string;
  status: string;
  total: number;
  items: any;
  created_at: string;
  shipping_address: string | null;
}

interface WalletTxn {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Order Placed",
  packed: "Packed",
  pickup: "Picked Up",
  shipped: "Shipped",
  delivery_pending: "Delivery Pending",
  delivered: "Delivered",
};

const emptyForm = {
  name: "", description: "", price: "", category: "", stock: "",
  area_godown_id: "", image_url: "", image_url_2: "", image_url_3: "",
  purchase_rate: "", mrp: "", discount_rate: "", is_featured: false,
};

const SellingPartnerDashboard = () => {
  const { profile, signOut, user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [assignedGodowns, setAssignedGodowns] = useState<Godown[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [orders, setOrders] = useState<Order[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTxn[]>([]);

  const fetchProducts = async () => {
    if (!user) return;
    const { data } = await supabase.from("seller_products").select("*").eq("seller_id", user.id).order("created_at", { ascending: false });
    if (data) setProducts(data as SellerProduct[]);
  };

  const fetchAssignedGodowns = async () => {
    if (!user) return;
    const { data: assignments } = await supabase.from("seller_godown_assignments").select("godown_id").eq("seller_id", user.id);
    if (!assignments || assignments.length === 0) { setAssignedGodowns([]); return; }
    const godownIds = assignments.map(a => a.godown_id);
    const { data: godownData } = await supabase.from("godowns").select("id, name").in("id", godownIds);
    if (godownData) setAssignedGodowns(godownData);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from("categories").select("id, name, category_type").eq("is_active", true).order("sort_order");
    if (data) setCategories(data as Category[]);
  };

  const fetchOrders = async () => {
    if (!user) return;
    const { data } = await supabase.from("orders").select("*").eq("seller_id", user.id).order("created_at", { ascending: false });
    if (data) setOrders(data as Order[]);
  };

  const fetchWallet = async () => {
    if (!user) return;
    const { data: wallet } = await supabase.from("seller_wallets").select("*").eq("seller_id", user.id).maybeSingle();
    if (wallet) {
      setWalletBalance(wallet.balance);
      const { data: txns } = await supabase.from("seller_wallet_transactions").select("*").eq("wallet_id", wallet.id).order("created_at", { ascending: false }).limit(50);
      setTransactions((txns ?? []) as WalletTxn[]);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchAssignedGodowns();
    fetchCategories();
    fetchOrders();
    fetchWallet();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const mrp = parseFloat(form.mrp) || 0;
    const discountRate = parseFloat(form.discount_rate) || 0;
    const sellingPrice = mrp - discountRate;
    const { error } = await supabase.from("seller_products").insert({
      seller_id: user.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: sellingPrice,
      purchase_rate: parseFloat(form.purchase_rate) || 0,
      mrp,
      discount_rate: discountRate,
      category: form.category.trim() || null,
      stock: parseInt(form.stock) || 0,
      area_godown_id: form.area_godown_id || null,
      image_url: form.image_url || null,
      image_url_2: form.image_url_2 || null,
      image_url_3: form.image_url_3 || null,
      is_featured: form.is_featured,
    });
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Product submitted for approval!" });
      setForm(emptyForm);
      setDialogOpen(false);
      fetchProducts();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Pennyekart" className="h-8" />
          <span className="font-semibold text-foreground">Selling Partner</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{profile?.full_name}</span>
          <Button variant="outline" size="sm" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-4 space-y-6">
        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Products</CardTitle>
              <Package className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{products.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
              <Store className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{products.filter(p => p.is_approved).length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">{orders.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Wallet</CardTitle>
              <Wallet className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold">₹{walletBalance.toFixed(2)}</p></CardContent>
          </Card>
        </div>

        <Tabs defaultValue="products">
          <TabsList className="w-full">
            <TabsTrigger value="products" className="flex-1">Products</TabsTrigger>
            <TabsTrigger value="orders" className="flex-1">Orders</TabsTrigger>
            <TabsTrigger value="wallet" className="flex-1">Wallet</TabsTrigger>
          </TabsList>

          {/* PRODUCTS TAB */}
          <TabsContent value="products" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setForm(emptyForm); }}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" /> Add Product</Button>
                </DialogTrigger>
                <DialogContent className="max-h-[85vh] flex flex-col">
                  <DialogHeader><DialogTitle>Add Product</DialogTitle></DialogHeader>
                  <form onSubmit={handleCreate} className="space-y-3 overflow-y-auto pr-2 flex-1">
                    <div><Label>Product Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
                    <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>

                    {/* Pricing - same as admin */}
                    <div className="grid grid-cols-3 gap-3">
                      <div><Label>Purchase Rate</Label><Input type="number" min="0" step="0.01" value={form.purchase_rate} onChange={e => setForm({ ...form, purchase_rate: e.target.value })} /></div>
                      <div><Label>MRP</Label><Input type="number" min="0" step="0.01" value={form.mrp} onChange={e => {
                        const m = e.target.value;
                        const dr = parseFloat(form.discount_rate) || 0;
                        setForm({ ...form, mrp: m, price: String((parseFloat(m) || 0) - dr) });
                      }} required /></div>
                      <div><Label>Discount Rate</Label><Input type="number" min="0" step="0.01" value={form.discount_rate} onChange={e => {
                        const dr = e.target.value;
                        const m = parseFloat(form.mrp) || 0;
                        setForm({ ...form, discount_rate: dr, price: String(m - (parseFloat(dr) || 0)) });
                      }} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Selling Price</Label><Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
                      <div><Label>Stock</Label><Input type="number" min="0" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} required /></div>
                    </div>

                    {/* Category */}
                    <div>
                      <Label>Category</Label>
                      <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                        <option value="">Select category</option>
                        {categories.filter(c => c.category_type === "grocery").length > 0 && (
                          <optgroup label="Grocery & Essentials">
                            {categories.filter(c => c.category_type === "grocery").map(c => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                          </optgroup>
                        )}
                        {categories.filter(c => c.category_type !== "grocery").length > 0 && (
                          <optgroup label="General Categories">
                            {categories.filter(c => c.category_type !== "grocery").map(c => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    {/* Images: 1 upload + 2 link fields */}
                    <ImageUpload bucket="products" value={form.image_url} onChange={url => setForm({ ...form, image_url: url })} label="Image 1 (Upload or paste URL)" />
                    <div><Label>Image 2 (URL)</Label><Input value={form.image_url_2} onChange={e => setForm({ ...form, image_url_2: e.target.value })} placeholder="Paste image URL" /></div>
                    {form.image_url_2 && <img src={form.image_url_2} alt="Preview 2" className="h-20 w-20 rounded-md border object-cover" />}
                    <div><Label>Image 3 (URL)</Label><Input value={form.image_url_3} onChange={e => setForm({ ...form, image_url_3: e.target.value })} placeholder="Paste image URL" /></div>
                    {form.image_url_3 && <img src={form.image_url_3} alt="Preview 3" className="h-20 w-20 rounded-md border object-cover" />}

                    {/* Area Godown */}
                    <div>
                      <Label>Area Godown (assigned by admin)</Label>
                      <Select value={form.area_godown_id} onValueChange={v => setForm({ ...form, area_godown_id: v })}>
                        <SelectTrigger><SelectValue placeholder={assignedGodowns.length ? "Select godown" : "No godowns assigned"} /></SelectTrigger>
                        <SelectContent>
                          {assignedGodowns.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Featured toggle */}
                    <div className="flex items-center gap-2 rounded-lg border p-3">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <div className="flex-1">
                        <Label className="text-sm font-medium">Featured Product</Label>
                        <p className="text-xs text-muted-foreground">Requires admin approval to display</p>
                      </div>
                      <Switch checked={form.is_featured} onCheckedChange={v => setForm({ ...form, is_featured: v })} />
                    </div>

                    <Button type="submit" className="w-full" disabled={assignedGodowns.length === 0}>Submit for Approval</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {products.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No products yet. Add your first product!</p>
            ) : (
              <div className="space-y-3">
                {products.map(p => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      {p.image_url && <img src={p.image_url} alt={p.name} className="h-12 w-12 rounded-md border object-cover" />}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{p.name}</p>
                          {p.is_featured && <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />}
                        </div>
                        <p className="text-sm text-muted-foreground">₹{p.price} · MRP: ₹{p.mrp} · Stock: {p.stock}</p>
                      </div>
                    </div>
                    <Badge variant={p.is_approved ? "default" : "secondary"}>
                      {p.is_approved ? "Approved" : "Pending"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ORDERS TAB */}
          <TabsContent value="orders">
            {orders.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No orders yet</p>
            ) : (
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map(o => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}</TableCell>
                        <TableCell>
                          <Badge variant={o.status === "delivered" ? "default" : "secondary"}>
                            {STATUS_LABELS[o.status] || o.status}
                          </Badge>
                        </TableCell>
                        <TableCell>₹{o.total}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* WALLET TAB */}
          <TabsContent value="wallet" className="space-y-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground">Available Balance</p>
                <p className="text-4xl font-bold mt-1">₹{walletBalance.toFixed(2)}</p>
              </CardContent>
            </Card>

            {transactions.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No transactions yet</p>
            ) : (
              <div className="space-y-2">
                {transactions.map(t => (
                  <div key={t.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{t.description || t.type}</p>
                      <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</p>
                    </div>
                    <span className={`font-semibold ${t.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {t.amount >= 0 ? "+" : ""}₹{Math.abs(t.amount).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default SellingPartnerDashboard;

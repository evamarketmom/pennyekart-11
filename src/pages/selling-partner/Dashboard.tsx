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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, Plus, LogOut, Store, ShoppingCart, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";

interface SellerProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  is_approved: boolean;
  is_active: boolean;
  stock: number;
  area_godown_id: string | null;
  created_at: string;
}

interface Godown {
  id: string;
  name: string;
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

const SellingPartnerDashboard = () => {
  const { profile, signOut, user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [assignedGodowns, setAssignedGodowns] = useState<Godown[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", price: "", category: "", stock: "", area_godown_id: "" });
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
    fetchOrders();
    fetchWallet();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("seller_products").insert({
      seller_id: user.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: parseFloat(form.price) || 0,
      category: form.category.trim() || null,
      stock: parseInt(form.stock) || 0,
      area_godown_id: form.area_godown_id || null,
    });
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Product submitted for approval!" });
      setForm({ name: "", description: "", price: "", category: "", stock: "", area_godown_id: "" });
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
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" /> Add Product</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Product</DialogTitle></DialogHeader>
                  <form onSubmit={handleCreate} className="space-y-4">
                    <div><Label>Product Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
                    <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Price (₹)</Label><Input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required /></div>
                      <div><Label>Stock</Label><Input type="number" min="0" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} required /></div>
                    </div>
                    <div><Label>Category</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
                    <div>
                      <Label>Area Godown (assigned by admin)</Label>
                      <Select value={form.area_godown_id} onValueChange={v => setForm({ ...form, area_godown_id: v })}>
                        <SelectTrigger><SelectValue placeholder={assignedGodowns.length ? "Select godown" : "No godowns assigned"} /></SelectTrigger>
                        <SelectContent>
                          {assignedGodowns.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
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
                    <div>
                      <p className="font-medium text-foreground">{p.name}</p>
                      <p className="text-sm text-muted-foreground">₹{p.price} · Stock: {p.stock}</p>
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

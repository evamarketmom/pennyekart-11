import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Search, Store, Phone, Mail, Package, Eye, MapPin, Wallet } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SellingPartner {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  mobile_number: string | null;
  is_approved: boolean;
  created_at: string;
  product_count?: number;
}

interface SellerProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  is_active: boolean;
  is_approved: boolean;
  image_url: string | null;
  category: string | null;
}

interface Godown {
  id: string;
  name: string;
  godown_type: string;
}

interface WalletInfo {
  balance: number;
  transactions: { id: string; type: string; amount: number; description: string | null; created_at: string }[];
}

const SellingPartnersPage = () => {
  const [partners, setPartners] = useState<SellingPartner[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedPartner, setSelectedPartner] = useState<SellingPartner | null>(null);
  const [partnerProducts, setPartnerProducts] = useState<SellerProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [assignedGodowns, setAssignedGodowns] = useState<string[]>([]);
  const [godownPartner, setGodownPartner] = useState<SellingPartner | null>(null);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [walletPartner, setWalletPartner] = useState<SellingPartner | null>(null);
  const [settleAmount, setSettleAmount] = useState("");
  const { toast } = useToast();

  const fetchPartners = async () => {
    setLoading(true);
    const [profilesRes, productsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_type", "selling_partner"),
      supabase.from("seller_products").select("seller_id"),
    ]);

    const productCounts: Record<string, number> = {};
    (productsRes.data ?? []).forEach((p) => {
      productCounts[p.seller_id] = (productCounts[p.seller_id] || 0) + 1;
    });

    const enriched = ((profilesRes.data ?? []) as unknown as SellingPartner[]).map((p) => ({
      ...p,
      product_count: productCounts[p.user_id] || 0,
    }));

    setPartners(enriched);
    setLoading(false);
  };

  const fetchGodowns = async () => {
    const { data } = await supabase.from("godowns").select("id, name, godown_type").eq("godown_type", "area").eq("is_active", true);
    if (data) setGodowns(data);
  };

  useEffect(() => { fetchPartners(); fetchGodowns(); }, []);

  const toggleApproval = async (userId: string, current: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_approved: !current }).eq("user_id", userId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: !current ? "Partner approved" : "Partner unapproved" });
      fetchPartners();
    }
  };

  const toggleProductApproval = async (productId: string, current: boolean) => {
    const { error } = await supabase.from("seller_products").update({ is_approved: !current }).eq("id", productId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: !current ? "Product approved" : "Product unapproved" });
      viewProducts(selectedPartner!);
    }
  };

  const viewProducts = async (partner: SellingPartner) => {
    setSelectedPartner(partner);
    setProductsLoading(true);
    const { data } = await supabase.from("seller_products").select("*").eq("seller_id", partner.user_id);
    setPartnerProducts((data ?? []) as SellerProduct[]);
    setProductsLoading(false);
  };

  const openGodownAssignment = async (partner: SellingPartner) => {
    setGodownPartner(partner);
    const { data } = await supabase.from("seller_godown_assignments").select("godown_id").eq("seller_id", partner.user_id);
    setAssignedGodowns((data ?? []).map(d => d.godown_id));
  };

  const toggleGodownAssignment = async (godownId: string, assigned: boolean) => {
    if (!godownPartner) return;
    if (assigned) {
      await supabase.from("seller_godown_assignments").delete().eq("seller_id", godownPartner.user_id).eq("godown_id", godownId);
      setAssignedGodowns(prev => prev.filter(id => id !== godownId));
    } else {
      await supabase.from("seller_godown_assignments").insert({ seller_id: godownPartner.user_id, godown_id: godownId });
      setAssignedGodowns(prev => [...prev, godownId]);
    }
    toast({ title: assigned ? "Godown removed" : "Godown assigned" });
  };

  const openWallet = async (partner: SellingPartner) => {
    setWalletPartner(partner);
    setSettleAmount("");
    const { data: wallet } = await supabase.from("seller_wallets").select("*").eq("seller_id", partner.user_id).maybeSingle();
    if (!wallet) {
      setWalletInfo({ balance: 0, transactions: [] });
      return;
    }
    const { data: txns } = await supabase.from("seller_wallet_transactions").select("*").eq("wallet_id", wallet.id).order("created_at", { ascending: false }).limit(50);
    setWalletInfo({ balance: wallet.balance, transactions: (txns ?? []) as any[] });
  };

  const handleSettle = async () => {
    if (!walletPartner || !settleAmount) return;
    const amount = parseFloat(settleAmount);
    if (isNaN(amount) || amount <= 0) return;
    
    const { data: wallet } = await supabase.from("seller_wallets").select("*").eq("seller_id", walletPartner.user_id).maybeSingle();
    if (!wallet || wallet.balance < amount) {
      toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }

    const { error: txnError } = await supabase.from("seller_wallet_transactions").insert({
      wallet_id: wallet.id,
      seller_id: walletPartner.user_id,
      type: "settlement",
      amount: -amount,
      description: `Settlement of ₹${amount}`,
    });
    if (txnError) { toast({ title: "Error", description: txnError.message, variant: "destructive" }); return; }

    await supabase.from("seller_wallets").update({ balance: wallet.balance - amount }).eq("id", wallet.id);
    toast({ title: `₹${amount} settled successfully` });
    openWallet(walletPartner);
  };

  const filtered = partners.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.full_name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q) || p.mobile_number?.includes(q);
  });

  const approvedCount = partners.filter((p) => p.is_approved).length;
  const pendingCount = partners.filter((p) => !p.is_approved).length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Store className="h-6 w-6 text-primary" /> Selling Partners Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Manage partners, assign godowns, and settle payments</p>
          </div>
          <div className="flex gap-3">
            <Badge variant="default" className="text-sm px-3 py-1">{approvedCount} Approved</Badge>
            <Badge variant="secondary" className="text-sm px-3 py-1">{pendingCount} Pending</Badge>
            <Badge variant="outline" className="text-sm px-3 py-1">{partners.length} Total</Badge>
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
                <TableHead>Products</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Approved</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No selling partners found</TableCell></TableRow>
              ) : filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name ?? "—"}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {p.email && <div className="flex items-center gap-1.5 text-sm"><Mail className="h-3.5 w-3.5 text-muted-foreground" />{p.email}</div>}
                      {p.mobile_number && <div className="flex items-center gap-1.5 text-sm"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{p.mobile_number}</div>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1"><Package className="h-3 w-3" />{p.product_count}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant={p.is_approved ? "default" : "secondary"}>{p.is_approved ? "Active" : "Pending"}</Badge></TableCell>
                  <TableCell><Switch checked={p.is_approved} onCheckedChange={() => toggleApproval(p.user_id, p.is_approved)} /></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => viewProducts(p)} title="Products"><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => openGodownAssignment(p)} title="Assign Godowns"><MapPin className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => openWallet(p)} title="Wallet"><Wallet className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Products Dialog */}
      <Dialog open={!!selectedPartner} onOpenChange={() => setSelectedPartner(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Products by {selectedPartner?.full_name ?? "Partner"}</DialogTitle></DialogHeader>
          {productsLoading ? (
            <p className="text-center py-4 text-muted-foreground">Loading...</p>
          ) : partnerProducts.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">No products listed</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Approved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partnerProducts.map((prod) => (
                  <TableRow key={prod.id}>
                    <TableCell className="font-medium">{prod.name}</TableCell>
                    <TableCell>₹{prod.price}</TableCell>
                    <TableCell>{prod.stock}</TableCell>
                    <TableCell><Switch checked={prod.is_approved} onCheckedChange={() => toggleProductApproval(prod.id, prod.is_approved)} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* Godown Assignment Dialog */}
      <Dialog open={!!godownPartner} onOpenChange={() => setGodownPartner(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Godowns — {godownPartner?.full_name}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">Select which area godowns this partner can deliver to</p>
          {godowns.length === 0 ? (
            <p className="text-muted-foreground">No area godowns available</p>
          ) : (
            <div className="space-y-3">
              {godowns.map(g => {
                const assigned = assignedGodowns.includes(g.id);
                return (
                  <div key={g.id} className="flex items-center gap-3 p-2 rounded-lg border">
                    <Checkbox checked={assigned} onCheckedChange={() => toggleGodownAssignment(g.id, assigned)} />
                    <span className="font-medium">{g.name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Wallet Dialog */}
      <Dialog open={!!walletPartner} onOpenChange={() => setWalletPartner(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Wallet — {walletPartner?.full_name}</DialogTitle></DialogHeader>
          {walletInfo && (
            <div className="space-y-4">
              <div className="text-center p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Balance</p>
                <p className="text-3xl font-bold">₹{walletInfo.balance.toFixed(2)}</p>
              </div>
              <div className="flex gap-2">
                <Input type="number" placeholder="Amount to settle" value={settleAmount} onChange={e => setSettleAmount(e.target.value)} />
                <Button onClick={handleSettle} disabled={!settleAmount || parseFloat(settleAmount) <= 0}>Settle</Button>
              </div>
              {walletInfo.transactions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Recent Transactions</h4>
                  {walletInfo.transactions.map(t => (
                    <div key={t.id} className="flex justify-between items-center text-sm p-2 border rounded">
                      <div>
                        <p className="font-medium">{t.description || t.type}</p>
                        <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</p>
                      </div>
                      <span className={t.amount >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                        {t.amount >= 0 ? "+" : ""}₹{Math.abs(t.amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default SellingPartnersPage;

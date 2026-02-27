import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { Zap, Plus, Trash2, Clock, Package, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

interface FlashSale {
  id: string;
  title: string;
  description: string | null;
  banner_color: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
}

interface FlashSaleProduct {
  id: string;
  flash_sale_id: string;
  product_id: string | null;
  seller_product_id: string | null;
  flash_price: number;
  flash_mrp: number;
  sort_order: number;
  product_name?: string;
  product_image?: string | null;
  source?: string;
}

interface ProductOption {
  id: string;
  name: string;
  price: number;
  mrp: number;
  image_url: string | null;
  source: "admin" | "seller";
}

const FlashSaleManager = () => {
  const [sales, setSales] = useState<FlashSale[]>([]);
  const [saleProducts, setSaleProducts] = useState<Record<string, FlashSaleProduct[]>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [addProductSaleId, setAddProductSaleId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [allProducts, setAllProducts] = useState<ProductOption[]>([]);
  const [form, setForm] = useState({ title: "", description: "", banner_color: "#ef4444", start_time: "", end_time: "" });
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission("update_products");

  const fetchSales = async () => {
    const { data } = await supabase.from("flash_sales").select("*").order("created_at", { ascending: false });
    setSales((data as FlashSale[]) ?? []);
    if (data) {
      for (const sale of data) {
        fetchSaleProducts(sale.id);
      }
    }
  };

  const fetchSaleProducts = async (saleId: string) => {
    const { data } = await supabase.from("flash_sale_products").select("*").eq("flash_sale_id", saleId).order("sort_order");
    if (!data) return;

    const enriched: FlashSaleProduct[] = [];
    for (const item of data as FlashSaleProduct[]) {
      if (item.product_id) {
        const { data: p } = await supabase.from("products").select("name, image_url").eq("id", item.product_id).single();
        enriched.push({ ...item, product_name: p?.name, product_image: p?.image_url, source: "Admin" });
      } else if (item.seller_product_id) {
        const { data: p } = await supabase.from("seller_products").select("name, image_url").eq("id", item.seller_product_id).single();
        enriched.push({ ...item, product_name: p?.name, product_image: p?.image_url, source: "Seller" });
      }
    }
    setSaleProducts(prev => ({ ...prev, [saleId]: enriched }));
  };

  const fetchAllProducts = async () => {
    const [{ data: adminP }, { data: sellerP }] = await Promise.all([
      supabase.from("products").select("id, name, price, mrp, image_url").eq("is_active", true).order("name"),
      supabase.from("seller_products").select("id, name, price, mrp, image_url").eq("is_active", true).eq("is_approved", true).order("name"),
    ]);
    const combined: ProductOption[] = [
      ...(adminP ?? []).map(p => ({ ...p, source: "admin" as const })),
      ...(sellerP ?? []).map(p => ({ ...p, source: "seller" as const })),
    ];
    setAllProducts(combined);
  };

  useEffect(() => { fetchSales(); }, []);

  const handleCreate = async () => {
    if (!form.title || !form.start_time || !form.end_time) {
      toast({ title: "Fill all required fields", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("flash_sales").insert({
      title: form.title,
      description: form.description || null,
      banner_color: form.banner_color,
      start_time: new Date(form.start_time).toISOString(),
      end_time: new Date(form.end_time).toISOString(),
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Flash Sale created!" });
    setShowCreate(false);
    setForm({ title: "", description: "", banner_color: "#ef4444", start_time: "", end_time: "" });
    fetchSales();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("flash_sales").delete().eq("id", id);
    toast({ title: "Flash Sale deleted" });
    fetchSales();
  };

  const handleToggle = async (id: string, active: boolean) => {
    await supabase.from("flash_sales").update({ is_active: !active }).eq("id", id);
    fetchSales();
  };

  const handleAddProduct = async (product: ProductOption) => {
    if (!addProductSaleId) return;
    const insert = {
      flash_sale_id: addProductSaleId,
      flash_price: product.price,
      flash_mrp: product.mrp,
      product_id: product.source === "admin" ? product.id : undefined,
      seller_product_id: product.source === "seller" ? product.id : undefined,
    };

    const { error } = await supabase.from("flash_sale_products").insert(insert as any);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Product added to flash sale" });
    fetchSaleProducts(addProductSaleId);
    fetchAllProducts();
  };

  const handleRemoveProduct = async (itemId: string, saleId: string) => {
    await supabase.from("flash_sale_products").delete().eq("id", itemId);
    toast({ title: "Removed" });
    fetchSaleProducts(saleId);
  };

  const openAddProduct = (saleId: string) => {
    setAddProductSaleId(saleId);
    setSearch("");
    fetchAllProducts();
  };

  const getStatus = (sale: FlashSale) => {
    const now = new Date();
    const start = new Date(sale.start_time);
    const end = new Date(sale.end_time);
    if (!sale.is_active) return { label: "Inactive", variant: "secondary" as const };
    if (now < start) return { label: "Scheduled", variant: "outline" as const };
    if (now >= start && now <= end) return { label: "LIVE", variant: "destructive" as const };
    return { label: "Ended", variant: "secondary" as const };
  };

  const filteredProducts = allProducts.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-destructive" />
          <h2 className="text-xl font-bold">Flash Sales</h2>
        </div>
        {canEdit && (
          <Button onClick={() => setShowCreate(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> New Flash Sale
          </Button>
        )}
      </div>

      {sales.length === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No flash sales yet. Create your first one!</CardContent></Card>
      )}

      {sales.map(sale => {
        const status = getStatus(sale);
        const items = saleProducts[sale.id] || [];
        return (
          <Card key={sale.id} className="border-l-4" style={{ borderLeftColor: sale.banner_color }}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4" style={{ color: sale.banner_color }} />
                  <CardTitle className="text-base">{sale.title}</CardTitle>
                  <Badge variant={status.variant}>{status.label}</Badge>
                  <Badge variant="secondary">{items.length} products</Badge>
                </div>
                <div className="flex items-center gap-1">
                  {canEdit && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => openAddProduct(sale.id)}>
                        <Plus className="h-3 w-3 mr-1" /> Add
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleToggle(sale.id, sale.is_active)}>
                        {sale.is_active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(sale.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Start: {format(new Date(sale.start_time), "MMM dd, yyyy hh:mm a")}</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> End: {format(new Date(sale.end_time), "MMM dd, yyyy hh:mm a")}</span>
              </div>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">No products added yet</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center gap-2 rounded-lg border p-2 bg-background">
                      {item.product_image ? (
                        <img src={item.product_image} alt="" className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center"><Package className="h-4 w-4 text-muted-foreground" /></div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{item.product_name}</p>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <span>₹{item.flash_price}</span>
                          {item.flash_mrp > item.flash_price && <span className="line-through">₹{item.flash_mrp}</span>}
                          <Badge variant="outline" className="text-[9px] ml-1">{item.source}</Badge>
                        </div>
                      </div>
                      {canEdit && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveProduct(item.id, sale.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Flash Sale</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Super Flash Sale!" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Limited time offer..." />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label>Start Date & Time *</Label>
                <Input type="datetime-local" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
              </div>
              <div className="flex-1">
                <Label>End Date & Time *</Label>
                <Input type="datetime-local" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Banner Color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.banner_color} onChange={e => setForm(f => ({ ...f, banner_color: e.target.value }))} className="h-9 w-12 rounded cursor-pointer" />
                <Input value={form.banner_color} onChange={e => setForm(f => ({ ...f, banner_color: e.target.value }))} className="w-28" />
              </div>
            </div>
            <Button onClick={handleCreate} className="w-full">Create Flash Sale</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Product Dialog */}
      <Dialog open={!!addProductSaleId} onOpenChange={v => { if (!v) setAddProductSaleId(null); }}>
        <DialogContent className="max-h-[80vh] flex flex-col">
          <DialogHeader><DialogTitle>Add Products to Flash Sale</DialogTitle></DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search admin & seller products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="overflow-y-auto flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="w-16">Add</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No products found</TableCell></TableRow>
                ) : filteredProducts.map(p => (
                  <TableRow key={`${p.source}-${p.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {p.image_url ? <img src={p.image_url} alt="" className="h-8 w-8 rounded object-cover" /> : <div className="h-8 w-8 rounded bg-muted" />}
                        <span className="text-sm truncate max-w-[150px]">{p.name}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant={p.source === "admin" ? "default" : "secondary"} className="text-[10px]">{p.source}</Badge></TableCell>
                    <TableCell>₹{p.price}</TableCell>
                    <TableCell><Button size="sm" onClick={() => handleAddProduct(p)}>Add</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FlashSaleManager;

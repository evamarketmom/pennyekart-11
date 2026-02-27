import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { Star, TrendingUp, Sparkles, Wallet, Megaphone, X, Plus, Package, Wand2 } from "lucide-react";
import FlashSaleManager from "@/components/admin/FlashSaleManager";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

interface Product {
  id: string;
  name: string;
  price: number;
  mrp: number;
  image_url: string | null;
  section: string | null;
  is_active: boolean;
  category: string | null;
}

const sectionConfig = [
  { key: "featured", label: "Featured Products", icon: Star, color: "text-yellow-500", autoAssign: false },
  { key: "most_ordered", label: "Most Ordered Items", icon: TrendingUp, color: "text-blue-500", autoAssign: true },
  { key: "new_arrivals", label: "New Arrivals", icon: Sparkles, color: "text-green-500", autoAssign: true },
  { key: "low_budget", label: "Low Budget Picks", icon: Wallet, color: "text-orange-500", autoAssign: true },
  { key: "sponsors", label: "Sponsors", icon: Megaphone, color: "text-purple-500", autoAssign: false },
];

const AUTO_ASSIGN_LIMIT = 10;

const OffersPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [addDialogSection, setAddDialogSection] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [autoAssigning, setAutoAssigning] = useState<string | null>(null);
  const { hasPermission } = usePermissions();
  const { toast } = useToast();

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, name, price, mrp, image_url, section, is_active, category")
      .eq("is_active", true)
      .order("name");
    setProducts((data as Product[]) ?? []);
  };

  const fetchAllProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, name, price, mrp, image_url, section, is_active, category")
      .eq("is_active", true)
      .order("name");
    setAllProducts((data as Product[]) ?? []);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const grouped = sectionConfig.map((sec) => ({
    ...sec,
    items: products.filter((p) => p.section === sec.key),
  }));

  const handleRemoveFromSection = async (productId: string) => {
    const { error } = await supabase.from("products").update({ section: null }).eq("id", productId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    fetchProducts();
    toast({ title: "Removed from section" });
  };

  const handleAddToSection = async (productId: string, section: string) => {
    const { error } = await supabase.from("products").update({ section }).eq("id", productId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    fetchProducts();
    fetchAllProducts();
    toast({ title: "Added to section" });
  };

  const handleAutoAssign = async (sectionKey: string) => {
    setAutoAssigning(sectionKey);
    try {
      // First, clear existing products in this section
      const { error: clearError } = await supabase
        .from("products")
        .update({ section: null })
        .eq("section", sectionKey);
      if (clearError) throw clearError;

      let productIds: string[] = [];

      if (sectionKey === "low_budget") {
        // Get cheapest active products
        const { data } = await supabase
          .from("products")
          .select("id")
          .eq("is_active", true)
          .is("section", null)
          .order("price", { ascending: true })
          .limit(AUTO_ASSIGN_LIMIT);
        productIds = (data ?? []).map((p) => p.id);
      } else if (sectionKey === "new_arrivals") {
        // Get most recently created products
        const { data } = await supabase
          .from("products")
          .select("id")
          .eq("is_active", true)
          .is("section", null)
          .order("created_at", { ascending: false })
          .limit(AUTO_ASSIGN_LIMIT);
        productIds = (data ?? []).map((p) => p.id);
      } else if (sectionKey === "most_ordered") {
        // Count product occurrences in orders
        const { data: orders } = await supabase
          .from("orders")
          .select("items");
        const countMap: Record<string, number> = {};
        (orders ?? []).forEach((order) => {
          const items = order.items as any[];
          if (Array.isArray(items)) {
            items.forEach((item) => {
              const pid = item.product_id || item.id;
              if (pid) countMap[pid] = (countMap[pid] || 0) + (item.quantity || 1);
            });
          }
        });
        // Sort by count descending, take top N
        const sorted = Object.entries(countMap)
          .sort(([, a], [, b]) => b - a)
          .slice(0, AUTO_ASSIGN_LIMIT)
          .map(([id]) => id);
        productIds = sorted;
      }

      // Assign section to selected products
      if (productIds.length > 0) {
        for (const id of productIds) {
          await supabase.from("products").update({ section: sectionKey }).eq("id", id).eq("is_active", true);
        }
      }

      await fetchProducts();
      toast({
        title: "Auto-assigned",
        description: `${productIds.length} products added to ${sectionConfig.find((s) => s.key === sectionKey)?.label}`,
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAutoAssigning(null);
    }
  };

  const openAddDialog = (sectionKey: string) => {
    setAddDialogSection(sectionKey);
    setSearch("");
    fetchAllProducts();
  };

  const availableProducts = allProducts.filter(
    (p) => (!p.section || p.section === "") && p.name.toLowerCase().includes(search.toLowerCase())
  );

  const canEdit = hasPermission("update_products");

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Offers & Feature Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage which products appear in each section on the storefront</p>
      </div>

      <FlashSaleManager />

      <div className="space-y-6 mt-6">
        {grouped.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.key}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${section.color}`} />
                    <CardTitle className="text-lg">{section.label}</CardTitle>
                    <Badge variant="secondary" className="ml-2">{section.items.length}</Badge>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      {section.autoAssign && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleAutoAssign(section.key)}
                          disabled={autoAssigning === section.key}
                        >
                          <Wand2 className="h-4 w-4 mr-1" />
                          {autoAssigning === section.key ? "Assigning..." : "Auto Assign"}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => openAddDialog(section.key)}>
                        <Plus className="h-4 w-4 mr-1" /> Add Product
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {section.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No products in this section</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {section.items.map((product) => (
                      <div key={product.id} className="flex items-center gap-3 rounded-lg border p-3 bg-background">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="h-12 w-12 rounded-md object-cover" />
                        ) : (
                          <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{product.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>₹{product.price}</span>
                            {product.mrp > product.price && (
                              <span className="line-through">₹{product.mrp}</span>
                            )}
                          </div>
                          {product.category && (
                            <Badge variant="outline" className="text-[10px] mt-1">{product.category}</Badge>
                          )}
                        </div>
                        {canEdit && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleRemoveFromSection(product.id)}>
                            <X className="h-4 w-4" />
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
      </div>

      <Dialog open={!!addDialogSection} onOpenChange={(v) => { if (!v) setAddDialogSection(null); }}>
        <DialogContent className="max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Add Product to {sectionConfig.find((s) => s.key === addDialogSection)?.label}
            </DialogTitle>
          </DialogHeader>
          <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3" />
          <div className="overflow-y-auto flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="w-20">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {availableProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">No available products</TableCell>
                  </TableRow>
                ) : (
                  availableProducts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="h-8 w-8 rounded object-cover" />
                          ) : (
                            <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                              <Package className="h-3 w-3" />
                            </div>
                          )}
                          <span className="text-sm">{p.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>₹{p.price}</TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => handleAddToSection(p.id, addDialogSection!)}>
                          Add
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default OffersPage;

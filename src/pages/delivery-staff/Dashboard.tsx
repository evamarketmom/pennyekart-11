import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Truck, Wallet, Package } from "lucide-react";
import logo from "@/assets/logo.png";
import DeliveryStats from "@/components/delivery/DeliveryStats";
import DeliveryOrders from "@/components/delivery/DeliveryOrders";
import DeliveryWallet from "@/components/delivery/DeliveryWallet";
import DeliveryStock from "@/components/delivery/DeliveryStock";

interface Order {
  id: string;
  status: string;
  total: number;
  shipping_address: string | null;
  created_at: string;
  items: any;
  user_id: string | null;
}

const DeliveryStaffDashboard = () => {
  const { user, profile, signOut } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [earningBalance, setEarningBalance] = useState<number>(0);
  const [totalCollections, setTotalCollections] = useState<number>(0);
  const [deliveryType, setDeliveryType] = useState<"fixed" | "part_time">("fixed");
  const [assignedWards, setAssignedWards] = useState<{ local_body_name: string; ward_number: number; local_body_id?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const [ordersRes, walletRes, wardsRes, lbRes, profileRes, txRes] = await Promise.all([
      supabase.from("orders").select("*").eq("assigned_delivery_staff_id", user.id).order("created_at", { ascending: false }),
      supabase.from("delivery_staff_wallets").select("*").eq("staff_user_id", user.id).maybeSingle(),
      supabase.from("delivery_staff_ward_assignments").select("*").eq("staff_user_id", user.id),
      supabase.from("locations_local_bodies").select("id, name"),
      supabase.from("profiles").select("delivery_type").eq("user_id", user.id).maybeSingle(),
      supabase.from("delivery_staff_wallet_transactions").select("amount, type").eq("staff_user_id", user.id),
    ]);

    setOrders((ordersRes.data as Order[]) ?? []);
    setWalletBalance(walletRes.data?.balance ?? 0);
    setEarningBalance((walletRes.data as any)?.earning_balance ?? 0);

    // Determine delivery type from profile
    const dtype = (profileRes.data as any)?.delivery_type ?? "fixed";
    setDeliveryType(dtype === "part_time" ? "part_time" : "fixed");

    // Compute total collections from credit transactions
    const txs = txRes.data ?? [];
    const collections = txs
      .filter((t: any) => t.type === "credit")
      .reduce((sum: number, t: any) => sum + (t.amount ?? 0), 0);
    setTotalCollections(collections);

    const lbs = lbRes.data ?? [];
    setAssignedWards((wardsRes.data ?? []).map((w: any) => {
      const lb = lbs.find((l) => l.id === w.local_body_id);
      return { local_body_name: lb?.name ?? "", ward_number: w.ward_number, local_body_id: w.local_body_id };
    }));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const pendingCount = orders.filter((o) => !["delivered", "cancelled", "return_requested", "return_confirmed"].includes(o.status)).length;
  const deliveredToday = orders.filter((o) => o.status === "delivered" && new Date(o.created_at).toDateString() === new Date().toDateString()).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Pennyekart" className="h-8" />
          <div>
            <span className="font-semibold text-foreground">Delivery Dashboard</span>
            {deliveryType === "part_time" && (
              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Part-time</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{profile?.full_name}</span>
          <Button variant="outline" size="sm" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4 space-y-6">
        <DeliveryStats
          pendingCount={pendingCount}
          deliveredToday={deliveredToday}
          walletBalance={walletBalance}
          totalCollections={totalCollections}
          earningBalance={earningBalance}
          deliveryType={deliveryType}
          assignedWards={assignedWards}
        />

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : user ? (
          <Tabs defaultValue="orders">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="orders"><Truck className="h-4 w-4 mr-1" /> Orders</TabsTrigger>
              <TabsTrigger value="wallet"><Wallet className="h-4 w-4 mr-1" /> Wallet</TabsTrigger>
              <TabsTrigger value="stock"><Package className="h-4 w-4 mr-1" /> Stock</TabsTrigger>
            </TabsList>
            <TabsContent value="orders">
              <DeliveryOrders orders={orders} userId={user.id} onRefresh={fetchData} />
            </TabsContent>
            <TabsContent value="wallet">
              <DeliveryWallet
                userId={user.id}
                walletBalance={walletBalance}
                earningBalance={earningBalance}
                deliveryType={deliveryType}
              />
            </TabsContent>
            <TabsContent value="stock">
              <DeliveryStock userId={user.id} assignedWards={assignedWards} />
            </TabsContent>
          </Tabs>
        ) : null}
      </main>
    </div>
  );
};

export default DeliveryStaffDashboard;

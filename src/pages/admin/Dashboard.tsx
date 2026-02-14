import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Package, ShoppingCart, Image } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";

const Dashboard = () => {
  const [stats, setStats] = useState({ users: 0, products: 0, orders: 0, banners: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const [users, products, orders, banners] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("id", { count: "exact", head: true }),
        supabase.from("banners").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        users: users.count ?? 0,
        products: products.count ?? 0,
        orders: orders.count ?? 0,
        banners: banners.count ?? 0,
      });
    };
    fetchStats();
  }, []);

  const cards = [
    { label: "Users", value: stats.users, icon: Users, color: "text-blue-600" },
    { label: "Products", value: stats.products, icon: Package, color: "text-green-600" },
    { label: "Orders", value: stats.orders, icon: ShoppingCart, color: "text-amber-600" },
    { label: "Banners", value: stats.banners, icon: Image, color: "text-purple-600" },
  ];

  return (
    <AdminLayout>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminLayout>
  );
};

export default Dashboard;

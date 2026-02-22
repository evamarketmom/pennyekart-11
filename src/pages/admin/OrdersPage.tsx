import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { Truck } from "lucide-react";

interface Order {
  id: string; user_id: string | null; status: string; total: number;
  shipping_address: string | null; created_at: string; is_self_delivery: boolean;
}

const statuses = ["pending", "confirmed", "processing", "shipped", "self_delivery_pickup", "self_delivery_shipped", "delivered", "cancelled"];

const OrdersPage = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const { hasPermission } = usePermissions();
  const { toast } = useToast();

  const fetchOrders = async () => {
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    setOrders((data as Order[]) ?? []);
  };

  useEffect(() => { fetchOrders(); }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else fetchOrders();
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "delivered": return "default";
      case "cancelled": return "destructive";
      case "pending": return "secondary";
      default: return "outline";
    }
  };

  return (
    <AdminLayout>
      <h1 className="mb-6 text-2xl font-bold">Orders</h1>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-xs">{o.id.slice(0, 8)}…</TableCell>
                <TableCell>₹{o.total}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    {hasPermission("update_orders") ? (
                      <Select value={o.status} onValueChange={(v) => updateStatus(o.id, v)}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant={statusColor(o.status) as any}>{o.status}</Badge>
                    )}
                    {o.is_self_delivery && <Badge variant="outline" className="text-xs w-fit"><Truck className="h-3 w-3 mr-1" />Self Delivery</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-xs">{new Date(o.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
            {orders.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No orders yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  );
};

export default OrdersPage;

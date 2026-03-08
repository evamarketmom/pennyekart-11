import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MapPin, ShoppingCart, Wallet, TrendingUp, CalendarDays } from "lucide-react";
import { format } from "date-fns";

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  mobile_number: string | null;
  local_body_id: string | null;
  ward_number: number | null;
  local_body_name?: string | null;
  local_body_type?: string | null;
  district_name?: string | null;
  created_at?: string;
}

interface OrderSummary {
  user_id: string;
  order_count: number;
  total_spent: number;
  last_order_date: string | null;
}

interface WalletSummary {
  user_id: string;
  balance: number;
}

interface CustomerListProps {
  customers: Profile[];
  orderSummaries?: Map<string, OrderSummary>;
  walletSummaries?: Map<string, WalletSummary>;
}

const CustomerList = ({ customers, orderSummaries, walletSummaries }: CustomerListProps) => {
  const [filterPanchayath, setFilterPanchayath] = useState("all");
  const [filterWard, setFilterWard] = useState("all");
  const [sortBy, setSortBy] = useState<string>("newest");

  // Get unique panchayaths with counts
  const panchayathStats = useMemo(() => {
    const map = new Map<string, { name: string; type: string; count: number }>();
    customers.forEach((c) => {
      const key = c.local_body_id ?? "__none";
      const existing = map.get(key);
      if (existing) {
        existing.count++;
      } else {
        map.set(key, {
          name: c.local_body_name ?? "Unknown",
          type: c.local_body_type ?? "",
          count: 1,
        });
      }
    });
    return map;
  }, [customers]);

  const panchayathOptions = useMemo(() => {
    const opts: { id: string; name: string; type: string }[] = [];
    const seen = new Set<string>();
    customers.forEach((c) => {
      if (c.local_body_id && !seen.has(c.local_body_id)) {
        seen.add(c.local_body_id);
        opts.push({ id: c.local_body_id, name: c.local_body_name ?? "Unknown", type: c.local_body_type ?? "" });
      }
    });
    return opts.sort((a, b) => a.name.localeCompare(b.name));
  }, [customers]);

  const wardOptions = useMemo(() => {
    const wards = new Set<number>();
    customers.forEach((c) => {
      if (c.ward_number != null) {
        if (filterPanchayath === "all" || c.local_body_id === filterPanchayath) {
          wards.add(c.ward_number);
        }
      }
    });
    return Array.from(wards).sort((a, b) => a - b);
  }, [customers, filterPanchayath]);

  // Filter and sort
  const filtered = useMemo(() => {
    let result = customers.filter((c) => {
      if (filterPanchayath !== "all" && c.local_body_id !== filterPanchayath) return false;
      if (filterWard !== "all" && String(c.ward_number) !== filterWard) return false;
      return true;
    });

    result.sort((a, b) => {
      const oA = orderSummaries?.get(a.user_id);
      const oB = orderSummaries?.get(b.user_id);
      const wA = walletSummaries?.get(a.user_id);
      const wB = walletSummaries?.get(b.user_id);

      switch (sortBy) {
        case "newest":
          return (b.created_at ?? "").localeCompare(a.created_at ?? "");
        case "oldest":
          return (a.created_at ?? "").localeCompare(b.created_at ?? "");
        case "most_orders":
          return (oB?.order_count ?? 0) - (oA?.order_count ?? 0);
        case "highest_spent":
          return (oB?.total_spent ?? 0) - (oA?.total_spent ?? 0);
        case "highest_wallet":
          return (wB?.balance ?? 0) - (wA?.balance ?? 0);
        default:
          return 0;
      }
    });

    return result;
  }, [customers, filterPanchayath, filterWard, sortBy, orderSummaries, walletSummaries]);

  // Aggregate stats
  const stats = useMemo(() => {
    let totalOrders = 0;
    let totalRevenue = 0;
    let activeCustomers = 0;
    let totalWalletBalance = 0;

    customers.forEach((c) => {
      const o = orderSummaries?.get(c.user_id);
      const w = walletSummaries?.get(c.user_id);
      if (o) {
        totalOrders += o.order_count;
        totalRevenue += o.total_spent;
        if (o.order_count > 0) activeCustomers++;
      }
      if (w) totalWalletBalance += w.balance;
    });

    return { totalOrders, totalRevenue, activeCustomers, totalWalletBalance };
  }, [customers, orderSummaries, walletSummaries]);

  const topPanchayaths = useMemo(() => {
    return Array.from(panchayathStats.entries())
      .filter(([key]) => key !== "__none")
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6);
  }, [panchayathStats]);

  const fmt = (n: number) => n >= 1000 ? `₹${(n / 1000).toFixed(1)}K` : `₹${n.toFixed(0)}`;

  return (
    <div className="space-y-4">
      {/* Analytics Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Total Customers
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{customers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <ShoppingCart className="h-3.5 w-3.5" /> Total Orders
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{fmt(stats.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Active Buyers
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{stats.activeCustomers}</p>
            <p className="text-[10px] text-muted-foreground">
              {customers.length > 0 ? ((stats.activeCustomers / customers.length) * 100).toFixed(0) : 0}% of total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5" /> Wallet Balance
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{fmt(stats.totalWalletBalance)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Panchayaths */}
      {topPanchayaths.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {topPanchayaths.map(([key, val]) => (
            <Card key={key} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => { setFilterPanchayath(key); setFilterWard("all"); }}>
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-[10px] font-medium text-muted-foreground flex items-center gap-1 truncate">
                  <MapPin className="h-3 w-3 shrink-0" /> {val.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                <p className="text-lg font-bold">{val.count}</p>
                <p className="text-[10px] text-muted-foreground">{val.type}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Panchayath:</span>
          <Select value={filterPanchayath} onValueChange={(v) => { setFilterPanchayath(v); setFilterWard("all"); }}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Panchayaths</SelectItem>
              {panchayathOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name} ({p.type})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Ward:</span>
          <Select value={filterWard} onValueChange={setFilterWard}>
            <SelectTrigger className="w-32"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Wards</SelectItem>
              {wardOptions.map((w) => (
                <SelectItem key={w} value={String(w)}>Ward {w}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Sort:</span>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="most_orders">Most Orders</SelectItem>
              <SelectItem value="highest_spent">Highest Spent</SelectItem>
              <SelectItem value="highest_wallet">Highest Wallet</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(filterPanchayath !== "all" || filterWard !== "all") && (
          <Badge variant="secondary" className="cursor-pointer" onClick={() => { setFilterPanchayath("all"); setFilterWard("all"); }}>
            Clear filters ✕
          </Badge>
        )}
        <Badge variant="outline" className="ml-auto">{filtered.length} customers</Badge>
      </div>

      {/* Table */}
      <div className="admin-table-wrap">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-center">Orders</TableHead>
              <TableHead className="text-right">Total Spent</TableHead>
              <TableHead>Last Order</TableHead>
              <TableHead className="text-right">Wallet</TableHead>
              <TableHead>Panchayath</TableHead>
              <TableHead>Ward</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c, i) => {
              const o = orderSummaries?.get(c.user_id);
              const w = walletSummaries?.get(c.user_id);
              return (
                <TableRow key={c.id}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{c.full_name ?? "—"}</TableCell>
                  <TableCell>{c.mobile_number ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {c.created_at ? (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {format(new Date(c.created_at), "dd MMM yyyy")}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {o && o.order_count > 0 ? (
                      <Badge variant="secondary">{o.order_count}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {o && o.total_spent > 0 ? `₹${o.total_spent.toFixed(0)}` : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {o?.last_order_date
                      ? format(new Date(o.last_order_date), "dd MMM yyyy")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {w && w.balance > 0 ? (
                      <Badge variant="outline" className="font-mono">₹{w.balance.toFixed(0)}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">₹0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {c.local_body_name ? (
                      <span className="text-xs">{c.local_body_name} <span className="text-muted-foreground">({c.local_body_type})</span></span>
                    ) : "—"}
                  </TableCell>
                  <TableCell>{c.ward_number ?? "—"}</TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">No customers found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default CustomerList;

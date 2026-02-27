import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Package, Clock, CheckCircle, Truck, MapPin, User, Phone, Mail, ChevronRight, ShoppingBag, Heart, Bell, Wallet, XCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Order {
  id: string;
  items: any[];
  total: number;
  status: string;
  created_at: string;
  shipping_address: string | null;
}

const statusSteps = ["pending", "accepted", "confirmed", "packed", "shipped", "delivered"];
const statusIcons: Record<string, any> = {
  pending: Clock,
  accepted: CheckCircle,
  confirmed: CheckCircle,
  packed: Package,
  shipped: Truck,
  delivered: MapPin,
  cancelled: XCircle,
  return_requested: RotateCcw,
  return_confirmed: CheckCircle,
};
const statusLabels: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  confirmed: "Confirmed",
  packed: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  return_requested: "Return Requested",
  return_confirmed: "Return Confirmed",
};

const Profile = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "profile";
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [activeSection, setActiveSection] = useState(initialTab);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/customer/login");
      return;
    }
    if (user) fetchOrders();
  }, [user, authLoading]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setMobile(profile.mobile_number || "");
    }
  }, [profile]);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });
    if (!error && data) setOrders(data as Order[]);
    setLoading(false);
  };

  const activeOrders = orders.filter(o => !["delivered", "cancelled", "return_requested", "return_confirmed"].includes(o.status));
  const pastOrders = orders.filter(o => ["delivered", "cancelled", "return_requested", "return_confirmed"].includes(o.status));

  const canCancel = (status: string) => ["pending", "accepted", "confirmed", "packed", "shipped"].includes(status);
  const canRequestReturn = (status: string) => status === "delivered";

  const handleCancelOrder = async (orderId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", orderId)
      .eq("user_id", user!.id);
    if (error) toast.error("Failed to cancel order");
    else { toast.success("Order cancelled"); fetchOrders(); }
  };

  const handleRequestReturn = async (orderId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: "return_requested" })
      .eq("id", orderId)
      .eq("user_id", user!.id);
    if (error) toast.error("Failed to request return");
    else { toast.success("Return requested. Awaiting confirmation from delivery/selling partner."); fetchOrders(); }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, mobile_number: mobile })
      .eq("user_id", user!.id);
    if (error) toast.error("Failed to update profile");
    else { toast.success("Profile updated"); setEditMode(false); }
    setSaving(false);
  };

  const getStatusIndex = (status: string) => statusSteps.indexOf(status);

  const OrderCard = ({ order, showTracking }: { order: Order; showTracking?: boolean }) => {
    const items = Array.isArray(order.items) ? order.items : [];
    const currentStep = getStatusIndex(order.status);

    return (
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-4 bg-muted/30">
            <div>
              <p className="text-xs text-muted-foreground">Order #{order.id.slice(0, 8)}</p>
              <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
            </div>
            <Badge variant={order.status === "delivered" ? "default" : order.status === "cancelled" ? "destructive" : order.status === "return_requested" ? "secondary" : order.status === "return_confirmed" ? "default" : "secondary"}>
              {statusLabels[order.status] || order.status}
            </Badge>
          </div>

          <div className="p-4 space-y-3">
            {items.slice(0, 2).map((item: any, idx: number) => (
              <div key={idx} className="flex items-center gap-3">
                {item.image && <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover border" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">Qty: {item.quantity} × ₹{item.price}</p>
                </div>
              </div>
            ))}
            {items.length > 2 && <p className="text-xs text-muted-foreground">+{items.length - 2} more items</p>}
          </div>

          <Separator />

          <div className="flex items-center justify-between p-4">
            <p className="text-sm font-bold">₹{order.total.toFixed(2)}</p>
            <div className="flex gap-2">
              {canCancel(order.status) && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive">
                      <XCircle className="h-4 w-4 mr-1" /> Cancel
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel Order?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to cancel this order? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>No, keep it</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleCancelOrder(order.id)}>Yes, cancel</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {canRequestReturn(order.status) && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <RotateCcw className="h-4 w-4 mr-1" /> Return
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Request Return?</AlertDialogTitle>
                      <AlertDialogDescription>
                        A delivery/selling partner will need to confirm the return before stock is restored. Are you sure?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>No, keep it</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleRequestReturn(order.id)}>Yes, request return</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {showTracking && order.status !== "cancelled" && (
                <Button size="sm" variant="outline" onClick={() => setSelectedOrder(order)}>
                  Track <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>

          {/* Inline tracking for selected order */}
          {selectedOrder?.id === order.id && order.status !== "cancelled" && (
            <>
              <Separator />
              <div className="p-4">
                <p className="text-sm font-semibold mb-4">Order Tracking</p>
                <div className="space-y-0">
                  {statusSteps.map((step, idx) => {
                    const Icon = statusIcons[step];
                    const isCompleted = idx <= currentStep;
                    const isCurrent = idx === currentStep;
                    return (
                      <div key={step} className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${isCompleted ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30 text-muted-foreground/30"}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          {idx < statusSteps.length - 1 && (
                            <div className={`w-0.5 h-6 ${idx < currentStep ? "bg-primary" : "bg-muted-foreground/20"}`} />
                          )}
                        </div>
                        <div className="pt-1">
                          <p className={`text-sm font-medium ${isCompleted ? "text-foreground" : "text-muted-foreground/40"}`}>
                            {statusLabels[step]}
                          </p>
                          {isCurrent && <p className="text-xs text-primary">Current status</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Button size="sm" variant="ghost" className="mt-2" onClick={() => setSelectedOrder(null)}>Close</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  if (authLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Skeleton className="h-10 w-40" />
    </div>
  );
  if (!user) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-card border-b">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">My Account</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Section Navigation */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            { key: "profile", label: "My Profile", icon: User },
            { key: "orders", label: "Orders", icon: Package },
            { key: "wallet", label: "Wallet", icon: Wallet },
            { key: "addresses", label: "Addresses", icon: MapPin },
            { key: "wishlist", label: "Wishlist", icon: Heart },
            { key: "notifications", label: "Notifications", icon: Bell },
          ].map(sec => (
            <Button
              key={sec.key}
              size="sm"
              variant={activeSection === sec.key ? "default" : "outline"}
              className="flex items-center gap-1.5 whitespace-nowrap"
              onClick={() => {
                if (sec.key === "wallet") {
                  navigate("/customer/wallet");
                } else {
                  setActiveSection(sec.key);
                }
              }}
            >
              <sec.icon className="h-3.5 w-3.5" />
              {sec.label}
            </Button>
          ))}
        </div>

        {/* Profile Section */}
        {activeSection === "profile" && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-lg">{profile?.full_name || "Customer"}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> {user.email}</p>
                  {profile?.mobile_number && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {profile.mobile_number}</p>
                  )}
                </div>
                {!editMode && <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>Edit</Button>}
              </div>

              {editMode && (
                <div className="space-y-3 pt-2 border-t">
                  <div>
                    <Label>Full Name</Label>
                    <Input value={fullName} onChange={e => setFullName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Mobile Number</Label>
                    <Input value={mobile} onChange={e => setMobile(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveProfile} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Orders Section */}
        {activeSection === "orders" && (
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="active" className="flex-1 gap-1">
                <Truck className="h-4 w-4" /> Active ({activeOrders.length})
              </TabsTrigger>
              <TabsTrigger value="history" className="flex-1 gap-1">
                <ShoppingBag className="h-4 w-4" /> History ({pastOrders.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-3 mt-3">
              {loading ? (
                <p className="text-center text-muted-foreground py-8">Loading...</p>
              ) : activeOrders.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">
                  <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p>No active orders</p>
                </CardContent></Card>
              ) : (
                activeOrders.map(o => <OrderCard key={o.id} order={o} showTracking />)
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-3 mt-3">
              {loading ? (
                <p className="text-center text-muted-foreground py-8">Loading...</p>
              ) : pastOrders.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">
                  <ShoppingBag className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p>No past orders</p>
                </CardContent></Card>
              ) : (
                pastOrders.map(o => <OrderCard key={o.id} order={o} />)
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Addresses Section */}
        {activeSection === "addresses" && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <MapPin className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="font-medium">Saved Addresses</p>
              <p className="text-sm mt-1">No saved addresses yet</p>
              <Button size="sm" className="mt-4">Add Address</Button>
            </CardContent>
          </Card>
        )}

        {/* Wishlist Section */}
        {activeSection === "wishlist" && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Heart className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="font-medium">Your Wishlist</p>
              <p className="text-sm mt-1">No items in your wishlist</p>
              <Button size="sm" className="mt-4" onClick={() => navigate("/")}>Browse Products</Button>
            </CardContent>
          </Card>
        )}

        {/* Notifications Section */}
        {activeSection === "notifications" && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="font-medium">Notifications</p>
              <p className="text-sm mt-1">No notifications yet</p>
            </CardContent>
          </Card>
        )}

        {/* Login Links */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-semibold text-muted-foreground mb-2">Switch Account</p>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate("/auth")}>
              <User className="h-4 w-4" /> Admin Login
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate("/selling-partner/login")}>
              <ShoppingBag className="h-4 w-4" /> Selling Partner Login
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate("/delivery-staff/login")}>
              <Truck className="h-4 w-4" /> Delivery Partner Login
            </Button>
          </CardContent>
        </Card>

        {/* Logout */}
        <Button variant="destructive" className="w-full" onClick={async () => { await signOut(); navigate("/"); }}>
          Logout
        </Button>
      </div>
    </div>
  );
};

export default Profile;

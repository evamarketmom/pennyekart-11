import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import CustomerList from "@/components/admin/CustomerList";
import { Search, ChevronLeft, ChevronRight, MoreHorizontal, Pencil, Trash2, KeyRound } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  mobile_number: string | null;
  role_id: string | null;
  is_super_admin: boolean;
  is_approved: boolean;
  is_blocked: boolean;
  user_type: string;
  local_body_id: string | null;
  ward_number: number | null;
  local_body_name?: string | null;
  local_body_type?: string | null;
  district_name?: string | null;
  created_at?: string;
  last_login_at?: string | null;
}

interface Role {
  id: string;
  name: string;
}

interface LocalBody {
  id: string;
  name: string;
  body_type: string;
  district_id: string;
}

interface District {
  id: string;
  name: string;
}

const USER_TYPE_LABELS: Record<string, string> = {
  all: "All Users",
  customer: "Customers",
  delivery_staff: "Delivery Staff",
  selling_partner: "Selling Partners",
};

const UsersPage = () => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [filterType, setFilterType] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { isSuperAdmin } = usePermissions();
  const { toast } = useToast();

  const [orderSummaries, setOrderSummaries] = useState<Map<string, { user_id: string; order_count: number; total_spent: number; last_order_date: string | null }>>(new Map());
  const [walletSummaries, setWalletSummaries] = useState<Map<string, { user_id: string; balance: number }>>(new Map());

  // Edit dialog state
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({ full_name: "", email: "", mobile_number: "" });
  const [editSaving, setEditSaving] = useState(false);

  // Delete dialog state
  const [deleteUser, setDeleteUser] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Reset password dialog state
  const [resetUser, setResetUser] = useState<Profile | null>(null);
  const [resetForm, setResetForm] = useState({ new_password: "", confirm_password: "" });
  const [resetting, setResetting] = useState(false);

  const fetchData = async () => {
    const [usersRes, rolesRes, localBodiesRes, districtsRes, ordersRes, walletsRes] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("roles").select("*"),
      supabase.from("locations_local_bodies").select("id, name, body_type, district_id"),
      supabase.from("locations_districts").select("id, name"),
      supabase.from("orders").select("user_id, total, status, created_at"),
      supabase.from("customer_wallets").select("customer_user_id, balance"),
    ]);

    const localBodies = (localBodiesRes.data ?? []) as LocalBody[];
    const districts = (districtsRes.data ?? []) as District[];

    const allProfiles = (usersRes.data ?? []) as unknown as Profile[];
    
    const profileIdToMobile = new Map<string, string>();
    allProfiles.forEach((p) => {
      if (p.id && p.mobile_number) profileIdToMobile.set(p.id, p.mobile_number);
    });

    const enrichedUsers = allProfiles.map((u) => {
      const enriched: any = { ...u };
      if (u.local_body_id) {
        const lb = localBodies.find((l) => l.id === u.local_body_id);
        if (lb) {
          const dist = districts.find((d) => d.id === lb.district_id);
          enriched.local_body_name = lb.name;
          enriched.local_body_type = lb.body_type;
          enriched.district_name = dist?.name ?? null;
        }
      }
      if ((u as any).referred_by) {
        enriched.referrer_name = profileIdToMobile.get((u as any).referred_by) || null;
      }
      return enriched;
    });

    const oMap = new Map<string, { user_id: string; order_count: number; total_spent: number; last_order_date: string | null }>();
    (ordersRes.data ?? []).forEach((o: any) => {
      if (!o.user_id) return;
      const existing = oMap.get(o.user_id);
      if (existing) {
        existing.order_count++;
        if (o.status === "delivered") existing.total_spent += Number(o.total ?? 0);
        if (!existing.last_order_date || o.created_at > existing.last_order_date) existing.last_order_date = o.created_at;
      } else {
        oMap.set(o.user_id, {
          user_id: o.user_id,
          order_count: 1,
          total_spent: o.status === "delivered" ? Number(o.total ?? 0) : 0,
          last_order_date: o.created_at,
        });
      }
    });
    setOrderSummaries(oMap);

    const wMap = new Map<string, { user_id: string; balance: number }>();
    (walletsRes.data ?? []).forEach((w: any) => {
      wMap.set(w.customer_user_id, { user_id: w.customer_user_id, balance: Number(w.balance ?? 0) });
    });
    setWalletSummaries(wMap);

    setUsers(enrichedUsers);
    setRoles((rolesRes.data as Role[]) ?? []);
  };

  useEffect(() => { fetchData(); }, []);

  const filteredUsers = useMemo(() => {
    let result = filterType === "all" ? users : users.filter(u => u.user_type === filterType);
    if (filterRole !== "all") {
      result = filterRole === "none"
        ? result.filter(u => !u.role_id)
        : result.filter(u => u.role_id === filterRole);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u =>
        (u.full_name?.toLowerCase().includes(q)) ||
        (u.email?.toLowerCase().includes(q)) ||
        (u.mobile_number?.includes(q))
      );
    }
    return result;
  }, [users, filterType, filterRole, searchQuery]);

  useMemo(() => { setCurrentPage(1); }, [filterType, filterRole, searchQuery]);

  const isCustomerTab = filterType === "customer";
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const updateRole = async (userId: string, roleId: string) => {
    const { error } = await supabase.from("profiles").update({ role_id: roleId === "none" ? null : roleId }).eq("user_id", userId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Role updated" }); fetchData(); }
  };

  const toggleSuperAdmin = async (userId: string, current: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_super_admin: !current }).eq("user_id", userId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Super admin toggled" }); fetchData(); }
  };

  const toggleApproval = async (userId: string, current: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_approved: !current }).eq("user_id", userId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: !current ? "User approved" : "User unapproved" }); fetchData(); }
  };

  const openEditDialog = (user: Profile) => {
    setEditUser(user);
    setEditForm({
      full_name: user.full_name ?? "",
      email: user.email ?? "",
      mobile_number: user.mobile_number ?? "",
    });
  };

  const handleEditSave = async () => {
    if (!editUser) return;
    setEditSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: editForm.full_name || null,
      email: editForm.email || null,
      mobile_number: editForm.mobile_number || null,
    }).eq("user_id", editUser.user_id);
    setEditSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "User updated" });
      setEditUser(null);
      fetchData();
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    setDeleting(true);
    const { error } = await supabase.from("profiles").delete().eq("user_id", deleteUser.user_id);
    setDeleting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "User deleted" });
      setDeleteUser(null);
      fetchData();
    }
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    if (resetForm.new_password !== resetForm.confirm_password) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (resetForm.new_password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setResetting(true);
    const { data, error } = await supabase.functions.invoke("reset-password", {
      body: {
        action: "reset_by_admin",
        user_id: resetUser.user_id,
        new_password: resetForm.new_password,
      },
    });
    setResetting(false);
    if (error || !data?.success) {
      toast({ title: "Reset failed", description: data?.message || "Could not reset password.", variant: "destructive" });
    } else {
      toast({ title: "Password reset successful!" });
      setResetUser(null);
      setResetForm({ new_password: "", confirm_password: "" });
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case "delivery_staff": return "default";
      case "selling_partner": return "secondary";
      default: return "outline";
    }
  };

  const otherColSpan = isSuperAdmin ? 7 : 6;

  return (
    <AdminLayout>
      <h1 className="mb-4 text-2xl font-bold">Users Management</h1>

      <Tabs value={filterType} onValueChange={setFilterType} className="mb-4">
        <TabsList>
          {Object.entries(USER_TYPE_LABELS).map(([key, label]) => (
            <TabsTrigger key={key} value={key}>
              {label}
              <Badge variant="outline" className="ml-2 text-xs">
                {key === "all" ? users.length : users.filter(u => u.user_type === key).length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email or mobile..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="none">No Role</SelectItem>
            {roles.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isCustomerTab ? (
        <CustomerList customers={filteredUsers} orderSummaries={orderSummaries} walletSummaries={walletSummaries} onRefresh={fetchData} />
      ) : (
        <>
          <div className="admin-table-wrap">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email / Mobile</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Approved</TableHead>
                  <TableHead>Role</TableHead>
                  {isSuperAdmin && <TableHead>Super Admin</TableHead>}
                  <TableHead className="w-12">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.full_name ?? "—"}</TableCell>
                    <TableCell>
                      <div>{u.email ?? "—"}</div>
                      {u.mobile_number && <div className="text-xs text-muted-foreground">{u.mobile_number}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getTypeBadgeVariant(u.user_type)}>
                        {USER_TYPE_LABELS[u.user_type] ?? u.user_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch checked={u.is_approved} onCheckedChange={() => toggleApproval(u.user_id, u.is_approved)} />
                    </TableCell>
                    <TableCell>
                      {isSuperAdmin ? (
                        <Select value={u.role_id ?? "none"} onValueChange={(v) => updateRole(u.user_id, v)}>
                          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No role</SelectItem>
                            {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary">{roles.find((r) => r.id === u.role_id)?.name ?? "No role"}</Badge>
                      )}
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell>
                        <Switch checked={u.is_super_admin} onCheckedChange={() => toggleSuperAdmin(u.user_id, u.is_super_admin)} />
                      </TableCell>
                    )}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(u)}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          {u.user_type !== "customer" && (
                            <DropdownMenuItem onClick={() => { setResetUser(u); setResetForm({ new_password: "", confirm_password: "" }); }}>
                              <KeyRound className="h-4 w-4 mr-2" /> Reset Password
                            </DropdownMenuItem>
                          )}
                          {isSuperAdmin && (
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteUser(u)}>
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={otherColSpan} className="text-center text-muted-foreground py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {filteredUsers.length > 0 && (
             <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let page: number;
                  if (totalPages <= 5) page = i + 1;
                  else if (currentPage <= 3) page = i + 1;
                  else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
                  else page = currentPage - 2 + i;
                  return (
                    <Button key={page} variant={currentPage === page ? "default" : "outline"} size="sm" className="w-8 h-8 p-0" onClick={() => setCurrentPage(page)}>
                      {page}
                    </Button>
                  );
                })}
                <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Show</span>
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                  <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[10, 25, 50, 100].map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <span>of {filteredUsers.length} users</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={editForm.full_name} onChange={(e) => setEditForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Mobile Number</Label>
              <Input value={editForm.mobile_number} onChange={(e) => setEditForm(f => ({ ...f, mobile_number: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={editSaving}>
              {editSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteUser?.full_name ?? deleteUser?.email ?? "this user"}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetUser} onOpenChange={(open) => !open && setResetUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Reset password for <strong>{resetUser?.full_name ?? resetUser?.mobile_number ?? "this user"}</strong>
          </p>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input type="password" value={resetForm.new_password} onChange={(e) => setResetForm(f => ({ ...f, new_password: e.target.value }))} minLength={6} placeholder="Min 6 characters" />
            </div>
            <div className="space-y-2">
              <Label>Repeat Password</Label>
              <Input type="password" value={resetForm.confirm_password} onChange={(e) => setResetForm(f => ({ ...f, confirm_password: e.target.value }))} minLength={6} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetUser(null)}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={resetting || !resetForm.new_password || !resetForm.confirm_password}>
              {resetting ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default UsersPage;

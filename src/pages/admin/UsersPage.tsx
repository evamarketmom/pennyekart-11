import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  mobile_number: string | null;
  role_id: string | null;
  is_super_admin: boolean;
  is_approved: boolean;
  user_type: string;
  local_body_id: string | null;
  ward_number: number | null;
  local_body_name?: string | null;
  local_body_type?: string | null;
  district_name?: string | null;
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
  const { isSuperAdmin } = usePermissions();
  const { toast } = useToast();

  const fetchData = async () => {
    const [usersRes, rolesRes, localBodiesRes, districtsRes] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("roles").select("*"),
      supabase.from("locations_local_bodies").select("id, name, body_type, district_id"),
      supabase.from("locations_districts").select("id, name"),
    ]);

    const localBodies = (localBodiesRes.data ?? []) as LocalBody[];
    const districts = (districtsRes.data ?? []) as District[];

    const enrichedUsers = ((usersRes.data ?? []) as unknown as Profile[]).map((u) => {
      if (u.local_body_id) {
        const lb = localBodies.find((l) => l.id === u.local_body_id);
        if (lb) {
          const dist = districts.find((d) => d.id === lb.district_id);
          return {
            ...u,
            local_body_name: lb.name,
            local_body_type: lb.body_type,
            district_name: dist?.name ?? null,
          };
        }
      }
      return u;
    });

    setUsers(enrichedUsers);
    setRoles((rolesRes.data as Role[]) ?? []);
  };

  useEffect(() => { fetchData(); }, []);

  const filteredUsers = filterType === "all" ? users : users.filter(u => u.user_type === filterType);
  const isCustomerTab = filterType === "customer";

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

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case "delivery_staff": return "default";
      case "selling_partner": return "secondary";
      default: return "outline";
    }
  };

  const customerColSpan = isSuperAdmin ? 8 : 7;
  const otherColSpan = isSuperAdmin ? 6 : 5;

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

      <div className="admin-table-wrap">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              {isCustomerTab ? (
                <>
                  <TableHead>Mobile</TableHead>
                  <TableHead>District</TableHead>
                  <TableHead>Panchayath</TableHead>
                  <TableHead>Ward</TableHead>
                </>
              ) : (
                <>
                  <TableHead>Email / Mobile</TableHead>
                  <TableHead>Type</TableHead>
                </>
              )}
              <TableHead>Approved</TableHead>
              <TableHead>Role</TableHead>
              {isSuperAdmin && <TableHead>Super Admin</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.full_name ?? "—"}</TableCell>
                {isCustomerTab ? (
                  <>
                    <TableCell>{u.mobile_number ?? "—"}</TableCell>
                    <TableCell>{u.district_name ?? "—"}</TableCell>
                    <TableCell>
                      {u.local_body_name ? (
                        <span>{u.local_body_name} <span className="text-xs text-muted-foreground">({u.local_body_type})</span></span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{u.ward_number ?? "—"}</TableCell>
                  </>
                ) : (
                  <>
                    <TableCell>
                      <div>{u.email ?? "—"}</div>
                      {u.mobile_number && <div className="text-xs text-muted-foreground">{u.mobile_number}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getTypeBadgeVariant(u.user_type)}>
                        {USER_TYPE_LABELS[u.user_type] ?? u.user_type}
                      </Badge>
                    </TableCell>
                  </>
                )}
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
              </TableRow>
            ))}
            {filteredUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={isCustomerTab ? customerColSpan : otherColSpan} className="text-center text-muted-foreground py-8">
                  No users found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AdminLayout>
  );
};

export default UsersPage;

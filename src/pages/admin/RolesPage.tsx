import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

interface Role { id: string; name: string; description: string | null; }
interface Permission { id: string; name: string; description: string | null; feature: string; action: string; }
interface RolePermission { role_id: string; permission_id: string; }

const RolesPage = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePerms, setRolePerms] = useState<RolePermission[]>([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    const [r, p, rp] = await Promise.all([
      supabase.from("roles").select("*").order("name"),
      supabase.from("permissions").select("*").order("feature,action"),
      supabase.from("role_permissions").select("role_id, permission_id"),
    ]);
    setRoles((r.data as Role[]) ?? []);
    setPermissions((p.data as Permission[]) ?? []);
    setRolePerms((rp.data as RolePermission[]) ?? []);
  };

  useEffect(() => { fetchData(); }, []);

  const addRole = async () => {
    if (!newRoleName.trim()) return;
    const { error } = await supabase.from("roles").insert({ name: newRoleName.trim().toLowerCase() });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { setNewRoleName(""); fetchData(); }
  };

  const deleteRole = async (id: string) => {
    const { error } = await supabase.from("roles").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { if (selectedRole === id) setSelectedRole(null); fetchData(); }
  };

  const togglePermission = async (roleId: string, permId: string, has: boolean) => {
    if (has) {
      await supabase.from("role_permissions").delete().eq("role_id", roleId).eq("permission_id", permId);
    } else {
      await supabase.from("role_permissions").insert({ role_id: roleId, permission_id: permId });
    }
    fetchData();
  };

  const hasPermission = (roleId: string, permId: string) =>
    rolePerms.some((rp) => rp.role_id === roleId && rp.permission_id === permId);

  const features = [...new Set(permissions.map((p) => p.feature))];

  return (
    <AdminLayout>
      <h1 className="mb-6 text-2xl font-bold">Roles & Permissions</h1>
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Roles list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Roles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="New role name" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} />
              <Button size="sm" onClick={addRole}><Plus className="h-4 w-4" /></Button>
            </div>
            {roles.map((r) => (
              <div
                key={r.id}
                className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                  selectedRole === r.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
                onClick={() => setSelectedRole(r.id)}
              >
                <span className="capitalize">{r.name}</span>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deleteRole(r.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Permissions matrix */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedRole ? `Permissions for "${roles.find((r) => r.id === selectedRole)?.name}"` : "Select a role"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedRole ? (
              <div className="space-y-6">
                {features.map((feat) => (
                  <div key={feat}>
                    <h3 className="mb-2 text-sm font-semibold capitalize">{feat}</h3>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {permissions
                        .filter((p) => p.feature === feat)
                        .map((p) => {
                          const has = hasPermission(selectedRole, p.id);
                          return (
                            <label key={p.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                              <Checkbox checked={has} onCheckedChange={() => togglePermission(selectedRole, p.id, has)} />
                              <span className="capitalize">{p.action}</span>
                            </label>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Click a role to manage its permissions.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default RolesPage;

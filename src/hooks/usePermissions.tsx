import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const usePermissions = () => {
  const { profile } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!profile?.role_id) {
        setPermissions([]);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("role_permissions")
        .select("permission_id, permissions(name)")
        .eq("role_id", profile.role_id);

      const permNames = (data ?? []).map((rp: any) => rp.permissions?.name).filter(Boolean);
      setPermissions(permNames);
      setLoading(false);
    };

    fetchPermissions();
  }, [profile?.role_id]);

  const hasPermission = (permName: string) => {
    if (profile?.is_super_admin) return true;
    return permissions.includes(permName);
  };

  const isSuperAdmin = profile?.is_super_admin ?? false;

  return { permissions, hasPermission, isSuperAdmin, loading };
};

import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";

interface Props {
  children: ReactNode;
  requireSuperAdmin?: boolean;
  requirePermission?: string;
}

const ProtectedRoute = ({ children, requireSuperAdmin, requirePermission }: Props) => {
  const { user, loading } = useAuth();
  const { isSuperAdmin, hasPermission } = usePermissions();

  if (loading) return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (requireSuperAdmin && !isSuperAdmin) return <Navigate to="/" replace />;
  if (requirePermission && !hasPermission(requirePermission)) return <Navigate to="/" replace />;

  return <>{children}</>;
};

export default ProtectedRoute;

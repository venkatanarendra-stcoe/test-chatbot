import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";

export function ProtectedRoute({ role }: { role?: "customer" | "admin" }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (role && user.role !== role) return <Navigate to={user.role === "admin" ? "/admin" : "/"} replace />;
  return <Outlet />;
}

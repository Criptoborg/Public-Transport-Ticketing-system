import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  return isAuthenticated ? (
    <Outlet />
  ) : (
    <Navigate to="/login" replace state={{ from: location }} />
  );
}

export function AdminRoute() {
  const { user } = useAuth();
  return user?.role === "admin" ? (
    <Outlet />
  ) : (
    <Navigate to="/dashboard" replace />
  );
}

export function BoardingStaffRoute() {
  const { user } = useAuth();
  return ['admin', 'conductor'].includes(user?.role) ? (
    <Outlet />
  ) : (
    <Navigate to="/dashboard" replace />
  );
}

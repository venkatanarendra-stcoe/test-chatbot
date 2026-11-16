import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import LoginPage from "@/features/auth/LoginPage";
import CustomerDashboard from "@/features/dashboard/CustomerDashboard";
import PoliciesPage from "@/features/policies/PoliciesPage";
import PolicyDetailPage from "@/features/policies/PolicyDetailPage";
import ClaimsPage from "@/features/claims/ClaimsPage";
import PaymentsPage from "@/features/payments/PaymentsPage";
import ProfilePage from "@/features/profile/ProfilePage";
import { AdminLayout } from "@/features/admin/GuardrailBanner";
import AdminOverview from "@/features/admin/AdminOverview";
import CustomersPage from "@/features/admin/CustomersPage";
import CustomerDetailPage from "@/features/admin/CustomerDetailPage";
import AdminPoliciesPage from "@/features/admin/AdminPoliciesPage";
import AdminClaimsPage from "@/features/admin/AdminClaimsPage";
import AgentLogsPage from "@/features/admin/AgentLogsPage";
import LockoutsPage from "@/features/admin/LockoutsPage";
import SystemPage from "@/features/admin/SystemPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route element={<ProtectedRoute role="customer" />}>
            <Route path="/" element={<CustomerDashboard />} />
            <Route path="/policies" element={<PoliciesPage />} />
            <Route path="/policies/:policyNumber" element={<PolicyDetailPage />} />
            <Route path="/claims" element={<ClaimsPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
          <Route element={<ProtectedRoute role="admin" />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminOverview />} />
              <Route path="/admin/customers" element={<CustomersPage />} />
              <Route path="/admin/customers/:customerId" element={<CustomerDetailPage />} />
              <Route path="/admin/policies" element={<AdminPoliciesPage />} />
              <Route path="/admin/claims" element={<AdminClaimsPage />} />
              <Route path="/admin/logs" element={<AgentLogsPage />} />
              <Route path="/admin/lockouts" element={<LockoutsPage />} />
              <Route path="/admin/system" element={<SystemPage />} />
            </Route>
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

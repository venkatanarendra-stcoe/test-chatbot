import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/common/DataTable";
import { ListPage, PageHeader } from "@/components/common/PageHeader";
import { opts, useFacets } from "@/hooks/useFacets";
import { api } from "@/services/api";
import { policyColumns, renderPolicyMobile } from "./columns";
import { POLICY_STATUSES, POLICY_TYPES } from "./product";

export default function PoliciesPage() {
  const nav = useNavigate();
  const f = useFacets(["status", "type"] as const);
  const q = useQuery({ queryKey: ["policies"], queryFn: () => api.policies() });
  const columns = useMemo(policyColumns, []);
  const rows = useMemo(() => q.data?.policies.filter((p) => f.match("status", p.status) && f.match("type", p.policy_type)), [q.data, f.values]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <ListPage>
      <PageHeader title="My Policies" description="All the policies you hold with us." />
      <DataTable fill columns={columns} data={rows} loading={q.isLoading} error={q.isError} onRetry={() => q.refetch()} searchPlaceholder="Search policies…"
        onRowClick={(p) => nav(`/policies/${p.policy_number}`)} rowLabel={(p) => `Open policy ${p.policy_number}`} renderMobile={renderPolicyMobile} onReset={f.reset}
        empty={{ title: "No policies found", message: "Your policies will appear here once they are issued." }}
        filters={[
          { id: "status", label: "Status", options: opts(POLICY_STATUSES), value: f.values.status, onChange: f.set("status") },
          { id: "type", label: "Type", options: opts(POLICY_TYPES), value: f.values.type, onChange: f.set("type") },
        ]} />
    </ListPage>
  );
}

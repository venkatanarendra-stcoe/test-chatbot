import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/common/DataTable";
import { ListPage, PageHeader } from "@/components/common/PageHeader";
import { useDebounced } from "@/hooks/useDebounced";
import { opts } from "@/hooks/useFacets";
import { policyColumns, renderPolicyMobile } from "@/features/policies/columns";
import { POLICY_STATUSES, POLICY_TYPES } from "@/features/policies/product";
import { api, type Policy } from "@/services/api";

export default function AdminPoliciesPage() {
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string[]>([]);
  const [type, setType] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const q = useDebounced(search);
  const res = useQuery({
    queryKey: ["admin-policies", q, status[0], type[0], page, size],
    queryFn: () => api.adminPolicies({ q: q || undefined, status: status[0], type: type[0], page, page_size: size }), placeholderData: (p) => p,
  });
  const columns = useMemo<ColumnDef<Policy, any>[]>(() => [ // eslint-disable-line @typescript-eslint/no-explicit-any
    ...policyColumns().slice(0, 1), { accessorKey: "customer_id", header: "Customer", cell: (c) => <span className="tabular-nums">{c.getValue()}</span> }, ...policyColumns().slice(1)], []);
  const on = (set: (v: string[]) => void) => (v: string[]) => { set(v); setPage(1); };
  return (
    <ListPage>
      <PageHeader title="Policies" description="Every policy across all customers." />
      <DataTable fill columns={columns} data={res.data?.items} loading={res.isLoading} error={res.isError} onRetry={() => res.refetch()} searchPlaceholder="Search policies…"
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(1); } }} onReset={() => { setStatus([]); setType([]); setPage(1); }}
        onRowClick={(p) => nav(`/admin/customers/${p.customer_id}`)} rowLabel={(p) => `Open customer for ${p.policy_number}`} renderMobile={renderPolicyMobile}
        server={{ page, pageSize: size, total: res.data?.total ?? 0, onPageChange: setPage, onPageSizeChange: setSize }}
        filters={[
          { id: "status", label: "Status", single: true, options: opts(POLICY_STATUSES), value: status, onChange: on(setStatus) },
          { id: "type", label: "Type", single: true, options: opts(POLICY_TYPES), value: type, onChange: on(setType) },
        ]} empty={{ title: "No policies", message: "No policy matches your filters." }} />
    </ListPage>
  );
}

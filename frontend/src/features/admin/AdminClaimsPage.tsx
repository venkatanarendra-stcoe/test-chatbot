import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/common/DataTable";
import { ListPage, PageHeader } from "@/components/common/PageHeader";
import { claimColumns, renderClaimMobile } from "@/features/claims/columns";
import { CLAIM_STATUSES } from "@/features/policies/product";
import { useDebounced } from "@/hooks/useDebounced";
import { opts } from "@/hooks/useFacets";
import { api, type Claim } from "@/services/api";

export default function AdminClaimsPage() {
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const q = useDebounced(search);
  const res = useQuery({
    queryKey: ["admin-claims", q, status[0], page, size],
    queryFn: () => api.adminClaims({ q: q || undefined, status: status[0], page, page_size: size }), placeholderData: (p) => p,
  });
  const columns = useMemo<ColumnDef<Claim, any>[]>(() => [ // eslint-disable-line @typescript-eslint/no-explicit-any
    ...claimColumns().slice(0, 1), { accessorKey: "customer_id", header: "Customer", cell: (c) => <span className="tabular-nums">{c.getValue()}</span> }, ...claimColumns().slice(1)], []);
  return (
    <ListPage>
      <PageHeader title="Claims" description="Every claim across all customers." />
      <DataTable fill columns={columns} data={res.data?.items} loading={res.isLoading} error={res.isError} onRetry={() => res.refetch()} searchPlaceholder="Search claims…"
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(1); } }} onReset={() => { setStatus([]); setPage(1); }}
        onRowClick={(c) => nav(`/admin/customers/${c.customer_id}`)} rowLabel={(c) => `Open customer for ${c.claim_number}`} renderMobile={renderClaimMobile}
        server={{ page, pageSize: size, total: res.data?.total ?? 0, onPageChange: setPage, onPageSizeChange: setSize }}
        filters={[{ id: "status", label: "Status", single: true, options: opts(CLAIM_STATUSES), value: status, onChange: (v) => { setStatus(v); setPage(1); } }]}
        empty={{ title: "No claims", message: "No claim matches your filters." }} />
    </ListPage>
  );
}

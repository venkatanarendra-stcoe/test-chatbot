import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, MobileItem, Truncate } from "@/components/common/DataTable";
import { ListPage, PageHeader } from "@/components/common/PageHeader";
import { useDebounced } from "@/hooks/useDebounced";
import { api, type Profile } from "@/services/api";

export const customerColumns = (): ColumnDef<Profile, any>[] => [ // eslint-disable-line @typescript-eslint/no-explicit-any
  { accessorKey: "customer_id", header: "ID", cell: (c) => <span className="font-medium tabular-nums">{c.getValue()}</span> },
  { accessorKey: "full_name", header: "Name", cell: (c) => <Truncate className="font-medium">{c.getValue()}</Truncate> },
  { accessorKey: "email", header: "Email", cell: (c) => <Truncate>{c.getValue()}</Truncate> },
  { accessorKey: "phone", header: "Phone", cell: (c) => <span className="tabular-nums">{c.getValue()}</span> },
  { id: "location", header: "Location", accessorFn: (r) => `${r.city}, ${r.state}` },
  { accessorKey: "pan_masked", header: "PAN", cell: (c) => <span className="tabular-nums">{c.getValue()}</span> },
];

export default function CustomersPage() {
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const q = useDebounced(search);
  const res = useQuery({ queryKey: ["admin-customers", q, page, size], queryFn: () => api.adminCustomers({ q: q || undefined, page, page_size: size }), placeholderData: (p) => p });
  const columns = useMemo(customerColumns, []);
  return (
    <ListPage>
      <PageHeader title="Customers" description="All customers. PAN is always masked." />
      <DataTable fill columns={columns} data={res.data?.items} loading={res.isLoading} error={res.isError} onRetry={() => res.refetch()} searchPlaceholder="Search customers…"
        search={{ value: search, onChange: (v) => { setSearch(v); setPage(1); } }} onRowClick={(c) => nav(`/admin/customers/${c.customer_id}`)} rowLabel={(c) => `Open customer ${c.full_name}`}
        server={{ page, pageSize: size, total: res.data?.total ?? 0, onPageChange: setPage, onPageSizeChange: setSize }}
        renderMobile={(c) => <MobileItem title={c.customer_id} fields={[c.full_name, `${c.city}`]} />} empty={{ title: "No customers", message: "No customer matches your search." }} />
    </ListPage>
  );
}

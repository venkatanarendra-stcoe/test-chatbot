import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/common/DataTable";
import { ListPage, PageHeader } from "@/components/common/PageHeader";
import { opts, useFacets } from "@/hooks/useFacets";
import { CLAIM_STATUSES } from "@/features/policies/product";
import { api, type Claim } from "@/services/api";
import { ClaimDetailSheet } from "./ClaimDetailSheet";
import { claimColumns, renderClaimMobile } from "./columns";

/** Claims table, optionally scoped to one policy (policy detail tab, embedded) or filling the page. */
export function ClaimsTable({ policyNumber, embedded }: { policyNumber?: string; embedded?: boolean }) {
  const [open, setOpen] = useState<Claim | null>(null);
  const f = useFacets(["status"] as const);
  const q = useQuery({ queryKey: ["claims"], queryFn: () => api.claims() });
  const columns = useMemo(claimColumns, []);
  const rows = useMemo(() => q.data?.claims.filter((c) => (!policyNumber || c.policy_number === policyNumber) && f.match("status", c.status)), [q.data, policyNumber, f.values]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <DataTable fill={!embedded} columns={columns} data={rows} loading={q.isLoading} error={q.isError} onRetry={() => q.refetch()} searchPlaceholder="Search claims…" onRowClick={setOpen}
        rowLabel={(c) => `Open claim ${c.claim_number}`} renderMobile={renderClaimMobile} onReset={f.reset}
        filters={[{ id: "status", label: "Status", options: opts(CLAIM_STATUSES), value: f.values.status, onChange: f.set("status") }]}
        empty={{ title: "No claims", message: "You have not filed any claims." }} />
      <ClaimDetailSheet claim={open} onClose={() => setOpen(null)} />
    </>
  );
}

export default function ClaimsPage() {
  return (
    <ListPage>
      <PageHeader title="Claims" description="Track the progress of your claims." />
      <ClaimsTable />
    </ListPage>
  );
}

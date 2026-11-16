import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/common/DataTable";
import { ListPage, PageHeader } from "@/components/common/PageHeader";
import { opts, useFacets } from "@/hooks/useFacets";
import { PAYMENT_STATUSES } from "@/features/policies/product";
import { api } from "@/services/api";
import { paymentColumns, renderPaymentMobile } from "./columns";

const MODES = ["UPI", "Net Banking", "Credit Card", "Auto-debit"];

export function PaymentsTable({ policyNumber, embedded }: { policyNumber?: string; embedded?: boolean }) {
  const f = useFacets(["mode", "status"] as const);
  const q = useQuery({ queryKey: ["payments"], queryFn: api.payments });
  const columns = useMemo(paymentColumns, []);
  const rows = useMemo(() => q.data?.payments.filter((p) => (!policyNumber || p.policy_number === policyNumber) && f.match("mode", p.mode) && f.match("status", p.status)), [q.data, policyNumber, f.values]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <DataTable fill={!embedded} columns={columns} data={rows} loading={q.isLoading} error={q.isError} onRetry={() => q.refetch()} searchPlaceholder="Search payments…"
      renderMobile={renderPaymentMobile} onReset={f.reset} empty={{ title: "No payments", message: "Premium payments will be listed here." }}
      filters={[
        { id: "mode", label: "Mode", options: opts(MODES), value: f.values.mode, onChange: f.set("mode") },
        { id: "status", label: "Status", options: opts(PAYMENT_STATUSES), value: f.values.status, onChange: f.set("status") },
      ]} />
  );
}

export default function PaymentsPage() {
  return (
    <ListPage>
      <PageHeader title="Payments" description="Your premium payment history." />
      <PaymentsTable />
    </ListPage>
  );
}

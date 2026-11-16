import type { ColumnDef } from "@tanstack/react-table";
import { MobileItem } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import type { Payment } from "@/services/api";

type Col = ColumnDef<Payment, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const paymentColumns = (): Col[] => [
  { accessorKey: "payment_id", header: "Payment", cell: (c) => <span className="font-medium tabular-nums">{c.getValue()}</span> },
  { accessorKey: "policy_number", header: "Policy", cell: (c) => <span className="tabular-nums">{c.getValue()}</span> },
  { accessorKey: "amount", header: "Amount", meta: { align: "right" }, cell: (c) => c.row.original.amount_display },
  { accessorKey: "mode", header: "Mode" },
  { accessorKey: "status", header: "Status", cell: (c) => <StatusBadge status={c.getValue()} /> },
  { accessorKey: "paid_on", header: "Date", cell: (c) => <span className="tabular-nums">{c.row.original.paid_on_display}</span> },
];

export const renderPaymentMobile = (p: Payment) => (
  <MobileItem title={p.payment_id} badge={<StatusBadge status={p.status} />} fields={[`${p.mode} · ${p.paid_on_display}`, p.amount_display]} />
);

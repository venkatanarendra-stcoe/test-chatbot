import type { ColumnDef } from "@tanstack/react-table";
import { ChevronRight } from "lucide-react";
import { MobileItem, Truncate } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import type { Policy } from "@/services/api";
import { productIcon } from "./product";

type Col = ColumnDef<Policy, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const number: Col = { accessorKey: "policy_number", header: "Policy", cell: (c) => <span className="font-medium tabular-nums">{c.getValue()}</span> };
const product: Col = {
  accessorKey: "product", header: "Product",
  cell: (c) => { const Icon = productIcon(c.row.original); return <span className="flex items-center gap-2"><Icon className="h-4 w-4 shrink-0 text-text-muted" strokeWidth={1.75} aria-hidden /><Truncate>{c.getValue()}</Truncate></span>; },
};
const status: Col = { accessorKey: "status", header: "Status", cell: (c) => <StatusBadge status={c.getValue()} /> };
const sum: Col = { accessorKey: "sum_insured", header: "Sum insured", meta: { align: "right" }, cell: (c) => c.row.original.sum_insured_display };

export const policyColumns = (): Col[] => [
  number, product, status, sum,
  { accessorKey: "annual_premium", header: "Premium", meta: { align: "right" }, cell: (c) => c.row.original.annual_premium_display },
  { accessorKey: "end_date", header: "Valid until", cell: (c) => <span className="tabular-nums">{c.row.original.end_date_display}</span> },
];

/** Compact variant for the dashboard card. */
export const dashboardPolicyColumns = (): Col[] => [
  number, product, status, sum,
  { accessorKey: "end_date", header: "Renewal", cell: (c) => <span className="tabular-nums">{c.row.original.end_date_display}</span> },
  { id: "go", header: () => <span className="sr-only">Open</span>, enableSorting: false, enableHiding: false, meta: { className: "w-10 pl-0" }, cell: () => <ChevronRight className="h-4 w-4 text-text-muted" aria-hidden /> },
];

export const renderPolicyMobile = (p: Policy) => (
  <MobileItem title={p.policy_number} badge={<StatusBadge status={p.status} />} fields={[p.product, p.sum_insured_display]} />
);

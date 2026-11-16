import type { ColumnDef } from "@tanstack/react-table";
import { MobileItem, Truncate } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import type { Claim } from "@/services/api";

type Col = ColumnDef<Claim, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const claimColumns = (): Col[] => [
  { accessorKey: "claim_number", header: "Claim", cell: (c) => <span className="font-medium tabular-nums">{c.getValue()}</span> },
  { accessorKey: "policy_number", header: "Policy", cell: (c) => <span className="tabular-nums">{c.getValue()}</span> },
  { accessorKey: "claim_type", header: "Type" },
  { accessorKey: "amount", header: "Amount", meta: { align: "right" }, cell: (c) => c.row.original.amount_display },
  { accessorKey: "status", header: "Status", cell: (c) => <StatusBadge status={c.getValue()} /> },
  { accessorKey: "filed_date", header: "Filed", cell: (c) => <span className="tabular-nums">{c.row.original.filed_date_display}</span> },
  { accessorKey: "description", header: "Description", cell: (c) => <Truncate className="max-w-[32ch]">{c.getValue() ?? ""}</Truncate> },
];

export const renderClaimMobile = (c: Claim) => (
  <MobileItem title={c.claim_number} badge={<StatusBadge status={c.status} />} fields={[`${c.claim_type} · ${c.filed_date_display}`, c.amount_display]} />
);

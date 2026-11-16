import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, MobileItem, Truncate } from "@/components/common/DataTable";
import { ListPage, PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useDebounced } from "@/hooks/useDebounced";
import { dateTimeIST } from "@/lib/format";
import { api, type AgentLog } from "@/services/api";
import { LogDetailSheet } from "./LogDetailSheet";

const startOfDay = (d: string) => (d ? `${d}T00:00:00+05:30` : undefined);
const endOfDay = (d: string) => (d ? `${d}T23:59:59+05:30` : undefined);

export const logColumns = (): ColumnDef<AgentLog, any>[] => [ // eslint-disable-line @typescript-eslint/no-explicit-any
  { id: "time", header: "Time (IST)", accessorFn: (r) => r.created_at, cell: (c) => <span className="whitespace-nowrap tabular-nums">{dateTimeIST(c.getValue()).replace(" IST", "")}</span> },
  { accessorKey: "user", header: "User", cell: (c) => <span className="font-medium">{c.getValue()}</span> },
  { accessorKey: "query", header: "Query", cell: (c) => <Truncate className="max-w-[32ch]">{c.getValue() ?? ""}</Truncate> },
  { id: "tools", header: "Tools", enableSorting: false, accessorFn: (r) => r.tool_calls.map((t) => t.tool).join(", "), cell: (c) => <span className="font-mono text-xs">{c.getValue() || "—"}</span> },
  { accessorKey: "authorization_result", header: "Auth", cell: (c) => <StatusBadge status={c.getValue()} /> },
  { id: "guardrail", header: "Guardrail", accessorFn: (r) => r.blocked_by ?? "", cell: (c) => (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      {c.getValue() ? <StatusBadge tone="danger" status={c.getValue()} className="font-mono" /> : <span className="text-text-muted">—</span>}
      {c.row.original.tainted && <StatusBadge status="tainted" tone="warning" />}
    </span>) },
];

export const renderLogMobile = (l: AgentLog) => (
  <MobileItem title={l.user ?? "—"} badge={<StatusBadge status={l.authorization_result} />} fields={[l.query, dateTimeIST(l.created_at).replace(" IST", "")]} />
);

export function AgentLogsTable({ fixedUser, embedded }: { fixedUser?: string; embedded?: boolean }) {
  const [user, setUser] = useState("");
  const [auth, setAuth] = useState<string[]>([]);
  const [rule, setRule] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(embedded ? 10 : 20);
  const [open, setOpen] = useState<AgentLog | null>(null);
  const dUser = useDebounced(user), dRule = useDebounced(rule);
  const effUser = fixedUser ?? (dUser.trim() || undefined);
  const q = useQuery({
    queryKey: ["admin-logs", effUser, auth[0], dRule, from, to, page, size],
    queryFn: () => api.adminLogs({ user: effUser, authorization: auth[0], blocked_by: dRule.trim() || undefined, from: startOfDay(from), to: endOfDay(to), page, page_size: size }),
    placeholderData: (prev) => prev,
  });
  const columns = useMemo(logColumns, []);
  const first = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  return (
    <>
      <DataTable fill={!embedded} columns={columns} data={q.data?.items} loading={q.isLoading} error={q.isError} onRetry={() => q.refetch()} onRowClick={setOpen} rowLabel={(l) => `Open log ${l.request_id}`}
        searchPlaceholder="Search by username" hideToolbar={false} renderMobile={renderLogMobile}
        search={fixedUser ? { value: "", onChange: () => {} } : { value: user, onChange: first(setUser) }}
        onReset={() => { setAuth([]); setRule(""); setFrom(""); setTo(""); setPage(1); }}
        server={{ page, pageSize: size, total: q.data?.total ?? 0, onPageChange: setPage, onPageSizeChange: setSize }}
        filters={[{ id: "auth", label: "Authorization", single: true, options: [{ value: "allowed", label: "Allowed" }, { value: "denied", label: "Denied" }, { value: "none", label: "None" }], value: auth, onChange: first(setAuth) }]}
        toolbarExtra={<>
          <Input aria-label="Filter by guardrail rule" placeholder="Rule (blocked_by)" className="w-44 shrink-0 font-mono text-xs" value={rule} onChange={(e) => first(setRule)(e.target.value)} />
          {!embedded && <><Input aria-label="From date" type="date" className="w-36 shrink-0" value={from} onChange={(e) => first(setFrom)(e.target.value)} /><Input aria-label="To date" type="date" className="w-36 shrink-0" value={to} onChange={(e) => first(setTo)(e.target.value)} /></>}
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => q.refetch()} aria-label="Refresh logs"><RefreshCw className={q.isFetching ? "animate-spin" : ""} /></Button>
        </>}
        empty={{ title: "No log entries", message: "No chat requests match these filters." }} />
      <LogDetailSheet log={open} onClose={() => setOpen(null)} />
    </>
  );
}

export default function AgentLogsPage() {
  return (
    <ListPage>
      <PageHeader title="Agent Logs" description="Every chat request with its tool calls and guardrail decisions." />
      <AgentLogsTable />
    </ListPage>
  );
}

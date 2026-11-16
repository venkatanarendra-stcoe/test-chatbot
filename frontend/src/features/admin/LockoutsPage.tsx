import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/common/DataTable";
import { ListPage, PageHeader } from "@/components/common/PageHeader";
import { api, type Lockout } from "@/services/api";

export default function LockoutsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin-lockouts"], queryFn: api.adminLockouts, refetchInterval: 15_000 });
  const clear = useMutation({
    mutationFn: api.clearLockout,
    onSuccess: (_, u) => { qc.invalidateQueries({ queryKey: ["admin-lockouts"] }); toast.success(`Lockout cleared for ${u}`); },
    onError: (e: Error) => toast.error(e.message),
  });
  const columns = useMemo<ColumnDef<Lockout, any>[]>(() => [ // eslint-disable-line @typescript-eslint/no-explicit-any
    { accessorKey: "username", header: "User", cell: (c) => <span className="flex items-center gap-2 font-medium"><Lock className="h-4 w-4 text-danger" strokeWidth={1.75} aria-hidden />{c.getValue()}</span> },
    { accessorKey: "seconds_left", header: "Time left", meta: { align: "right" }, cell: (c) => `${Math.floor(c.getValue() / 60)} min ${c.getValue() % 60} s` },
    { id: "actions", header: () => <span className="sr-only">Actions</span>, enableSorting: false, enableHiding: false, meta: { align: "right" },
      cell: (c) => <Button size="sm" variant="outline" disabled={clear.isPending} onClick={() => clear.mutate(c.row.original.username)}><Unlock /> Clear</Button> },
  ], [clear]);
  return (
    <ListPage>
      <PageHeader title="Lockouts" description="Users whose chat is locked after repeated blocked requests." />
      <DataTable fill columns={columns} data={q.data} loading={q.isLoading} error={q.isError} onRetry={() => q.refetch()} searchPlaceholder="Search users…" empty={{ title: "No active lockouts", message: "Nobody is currently locked out." }} />
    </ListPage>
  );
}

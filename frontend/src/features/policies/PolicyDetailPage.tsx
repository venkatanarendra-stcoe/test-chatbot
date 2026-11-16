import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dl, StatStrip } from "@/components/common/Dl";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Page, PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ClaimsTable } from "@/features/claims/ClaimsPage";
import { PaymentsTable } from "@/features/payments/PaymentsPage";
import { useState } from "react";
import { RENEWABLE, RenewDialog } from "./RenewDialog";
import { ApiError, api, type Policy } from "@/services/api";

const label = (k: string) => k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
function renderValue(k: string, v: unknown): React.ReactNode {
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x === "object" && x)) return (
      <ul className="space-y-1">{(v as Record<string, unknown>[]).map((m, i) => (
        <li key={i}>{String(m.name ?? "")} <span className="capitalize text-text-muted">({String(m.relation ?? "")}{m.age ? `, ${m.age}` : ""})</span></li>))}</ul>);
    return (v as unknown[]).join(", ");
  }
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (/percent/.test(k)) return `${v}%`;
  if (/months/.test(k)) return `${v} months`;
  return String(v);
}

export default function PolicyDetailPage() {
  const { policyNumber = "" } = useParams();
  const [renewing, setRenewing] = useState(false);
  const q = useQuery({ queryKey: ["policy", policyNumber], queryFn: () => api.policy(policyNumber) });
  const p: Policy | undefined = q.data;
  const notFound = q.error instanceof ApiError && q.error.status === 404;
  if (q.isLoading) return <Page><PageHeader title="Policy" /><Skeleton className="h-64 rounded-xl" /></Page>;
  if (notFound) return <Page><PageHeader title="Policy not found" /><Card><EmptyState title="Policy not found" message="We could not find that policy on your account." action={<Button asChild variant="outline"><Link to="/policies">Back to policies</Link></Button>} /></Card></Page>;
  if (q.isError || !p) return <Page><PageHeader title="Policy" /><Card><ErrorState onRetry={() => q.refetch()} /></Card></Page>;
  const det = Object.entries(p.details ?? {}).filter(([k]) => k !== "grace_until");

  return (
    <Page>
      <PageHeader title={<span className="tabular-nums">{p.policy_number}</span>} badge={<StatusBadge status={p.status} />} description={p.product}
        actions={RENEWABLE.includes(p.status) ? <Button onClick={() => setRenewing(true)}>Renew policy</Button> : undefined} />
      <RenewDialog policyNumber={p.policy_number} open={renewing} onOpenChange={setRenewing} />
      {p.grace_until_display && (
        <div role="alert" className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning-bg px-3 py-2.5 text-sm font-medium text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />This policy is in its grace period. Renew by {p.grace_until_display} to keep your cover.
        </div>
      )}
      <Card><StatStrip items={[["Sum insured / IDV", p.sum_insured_display], ["Annual premium", p.annual_premium_display], ["Deductible", p.deductible_display], ["Start date", p.start_date_display], ["End date", p.end_date_display], ["Nominee", p.nominee ?? "—"]]} /></Card>

      <Tabs defaultValue="overview" className="flex flex-col gap-4">
        <TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="coverage">Coverage</TabsTrigger><TabsTrigger value="claims">Claims</TabsTrigger><TabsTrigger value="payments">Payments</TabsTrigger></TabsList>
        <TabsContent value="overview"><Card><CardContent>
          <Dl items={[["Product", p.product], ["Policy type", p.policy_type], ["Status", <StatusBadge key="s" status={p.status} />], ["Nominee", p.nominee ?? "—"],
            ["Start date", p.start_date_display], ["End date", p.end_date_display], ["Sum insured / IDV", p.sum_insured_display], ["Annual premium", p.annual_premium_display], ["Deductible", p.deductible_display]]} />
        </CardContent></Card></TabsContent>
        <TabsContent value="coverage"><Card><CardContent>
          {det.length === 0 ? <EmptyState title="No additional coverage details" message="This policy has no extra details on file." /> : <Dl items={det.map(([k, v]) => [label(k), renderValue(k, v)])} />}
        </CardContent></Card></TabsContent>
        <TabsContent value="claims"><ClaimsTable embedded policyNumber={p.policy_number} /></TabsContent>
        <TabsContent value="payments"><PaymentsTable embedded policyNumber={p.policy_number} /></TabsContent>
      </Tabs>
    </Page>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/ErrorState";
import { Page, PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { api } from "@/services/api";

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex min-h-11 items-center justify-between gap-4 py-2 text-sm"><dt className="text-text-secondary">{label}</dt><dd className="font-medium text-text">{children}</dd></div>
);
const OnOff = ({ on }: { on: boolean }) => <StatusBadge status={on ? "On" : "Off"} tone={on ? "success" : "danger"} />;

export default function SystemPage() {
  const { data: s, isLoading, isError, refetch } = useQuery({ queryKey: ["admin-system"], queryFn: api.adminSystem });
  return (
    <Page>
      <PageHeader title="System" description="Read-only view of the assistant's runtime configuration." />
      {isError ? <Card><ErrorState onRetry={() => refetch()} /></Card> : isLoading || !s ? <Skeleton className="h-64 rounded-xl" /> : (
        <div className="grid gap-4 lg:grid-cols-2 xl:gap-6">
          <Card><CardHeader className="flex-col gap-1"><CardTitle>Language model</CardTitle><CardDescription>Used by the assistant. Never shown to customers.</CardDescription></CardHeader>
            <CardContent><dl className="divide-y divide-border"><Row label="Provider">{s.llm_provider}</Row><Row label="Model"><span className="font-mono text-xs">{s.llm_model}</span></Row>
              <Row label="Reachable"><OnOff on={s.llm.reachable} /></Row>{s.llm.model_available !== undefined && <Row label="Model available"><OnOff on={s.llm.model_available} /></Row>}</dl></CardContent></Card>
          <Card><CardHeader className="flex-col gap-1"><CardTitle>Guardrails</CardTitle><CardDescription>Identity, authorization, read-only tools with row-level security and fail-closed behaviour are always on.</CardDescription></CardHeader>
            <CardContent><dl className="divide-y divide-border"><Row label="Input guardrails"><OnOff on={s.guardrails.input} /></Row><Row label="Tool guardrails"><OnOff on={s.guardrails.tool} /></Row><Row label="Output guardrails"><OnOff on={s.guardrails.output} /></Row>
              <Row label="LLM classifier"><OnOff on={s.guardrails.llm_classifier} /></Row><Row label="Rate limit"><span className="tabular-nums">{s.rate_limit_per_minute} / minute</span></Row><Row label="Lockout"><OnOff on={s.lockout_enabled} /></Row></dl></CardContent></Card>
        </div>
      )}
    </Page>
  );
}

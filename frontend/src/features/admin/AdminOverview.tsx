import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts";
import { FileClock, MessageSquare, ShieldAlert, ShieldCheck, Users, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CHART_COLORS, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/common/DataTable";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { KpiCard } from "@/components/common/KpiCard";
import { Page, PageHeader } from "@/components/common/PageHeader";
import { inr, inrCompact } from "@/lib/format";
import { api, type Slice } from "@/services/api";
import { logColumns, renderLogMobile } from "./AgentLogsPage";

function ChartCard({ title, description, children, empty }: { title: string; description?: string; children: React.ReactElement; empty?: boolean }) {
  return (
    <Card className="flex h-[320px] flex-col">
      <CardHeader className="flex-col gap-0.5"><CardTitle>{title}</CardTitle>{description && <CardDescription className="text-xs">{description}</CardDescription>}</CardHeader>
      <CardContent className="min-h-0 flex-1 pt-3">{empty ? <EmptyState title="No data yet" message="Nothing to show for this period." className="min-h-0" /> : children}</CardContent>
    </Card>
  );
}

const Legend = ({ data }: { data: Slice[] }) => (
  <ul className="flex shrink-0 flex-wrap justify-center gap-x-4 gap-y-1 pt-2 text-xs text-text-secondary">
    {data.map((d, i) => <li key={d.name} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: CHART_COLORS[i % 6] }} />{d.name} <span className="tabular-nums text-text">{d.value}</span></li>)}
  </ul>
);

export default function AdminOverview() {
  const { data: s, isLoading, isError, refetch } = useQuery({ queryKey: ["admin-stats"], queryFn: api.adminStats, refetchInterval: 30_000 });
  const logs = useQuery({ queryKey: ["admin-logs-recent"], queryFn: () => api.adminLogs({ page: 1, page_size: 50 }), refetchInterval: 30_000 });
  const blocked = useMemo(() => logs.data?.items.filter((l) => l.blocked_by).slice(0, 20), [logs.data]);
  const cols = useMemo(logColumns, []);
  return (
    <Page>
      <PageHeader title="Overview" description="Portfolio and assistant activity at a glance." />
      {isError ? <Card><ErrorState onRetry={() => refetch()} /></Card> : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 xl:gap-6">
            <KpiCard label="Customers" icon={Users} loading={isLoading} value={s?.customers} hint="Registered accounts" />
            <KpiCard label="Active policies" icon={ShieldCheck} tone="success" loading={isLoading} value={s?.active_policies} hint="Active and in grace period" />
            <KpiCard label="Total sum insured" icon={Wallet} tone="info" loading={isLoading} value={s ? inrCompact(s.total_sum_insured) : ""} hint={s ? inr(s.total_sum_insured) : undefined} />
            <KpiCard label="Open claims" icon={FileClock} tone="warning" loading={isLoading} value={s?.open_claims} hint="Submitted or in review" />
            <KpiCard label="Chat requests (24h)" icon={MessageSquare} loading={isLoading} value={s?.chat_requests_24h} hint="Assistant messages" />
            <KpiCard label="Blocked requests (24h)" icon={ShieldAlert} tone="danger" loading={isLoading} value={s?.blocked_requests_24h} hint="Stopped by a guardrail" />
          </div>
          {isLoading || !s ? <div className="grid gap-4 lg:grid-cols-2 xl:gap-6">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[320px] rounded-xl" />)}</div> : (
            <div className="grid gap-4 lg:grid-cols-2 xl:gap-6">
              <ChartCard title="Policies by product" description="Number of policies" empty={!s.policies_by_product.length}>
                <ChartContainer>
                  <BarChart data={s.policies_by_product} margin={{ left: -16, top: 4 }}><CartesianGrid vertical={false} /><XAxis dataKey="name" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <ChartTooltip /><Bar dataKey="value" name="Policies" fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} maxBarSize={48} /></BarChart>
                </ChartContainer>
              </ChartCard>
              <ChartCard title="Claims by status" description="All claims" empty={!s.claims_by_status.length}>
                <div className="flex h-full flex-col">
                  <div className="min-h-0 flex-1"><ChartContainer><PieChart><ChartTooltip cursor={false} />
                    <Pie data={s.claims_by_status} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="none" isAnimationActive={false}>{s.claims_by_status.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % 6]} />)}</Pie></PieChart></ChartContainer></div>
                  <Legend data={s.claims_by_status} />
                </div>
              </ChartCard>
              <ChartCard title="Blocked requests" description="Last 7 days">
                <ChartContainer>
                  <LineChart data={s.blocked_last_7_days.map((d) => ({ ...d, day: d.date.slice(5) }))} margin={{ left: -16, top: 4, right: 8 }}><CartesianGrid vertical={false} /><XAxis dataKey="day" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <ChartTooltip cursor={false} /><Line type="monotone" dataKey="value" name="Blocked" stroke={CHART_COLORS[3]} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS[3] }} /></LineChart>
                </ChartContainer>
              </ChartCard>
              <ChartCard title="Top guardrail rules" description="By number of blocked requests" empty={!s.top_guardrail_rules.length}>
                <ChartContainer>
                  <BarChart data={s.top_guardrail_rules} layout="vertical" margin={{ left: 8, right: 8 }}><CartesianGrid horizontal={false} /><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} /><YAxis type="category" dataKey="name" width={140} tickLine={false} axisLine={false} />
                    <ChartTooltip /><Bar dataKey="value" name="Blocks" fill={CHART_COLORS[4]} radius={[0, 6, 6, 0]} maxBarSize={28} /></BarChart>
                </ChartContainer>
              </ChartCard>
            </div>
          )}
          <Card className="overflow-hidden">
            <CardHeader className="flex-col gap-0.5 pb-3 sm:pb-3"><CardTitle>Recent blocked requests</CardTitle><CardDescription className="text-xs">Most recent chat requests stopped by a guardrail</CardDescription></CardHeader>
            <DataTable columns={cols} data={blocked} loading={logs.isLoading} error={logs.isError} onRetry={() => logs.refetch()} hideToolbar renderMobile={renderLogMobile}
              className="rounded-none border-x-0 border-b-0 shadow-none" empty={{ title: "No blocked requests", message: "Nothing has been blocked recently." }} />
          </Card>
        </>
      )}
    </Page>
  );
}

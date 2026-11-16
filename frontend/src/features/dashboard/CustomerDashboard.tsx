import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, FileClock, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/common/DataTable";
import { ErrorState } from "@/components/common/ErrorState";
import { KpiCard } from "@/components/common/KpiCard";
import { PageHeader } from "@/components/common/PageHeader";
import { useAssistant } from "@/features/assistant/AssistantProvider";
import { useAuth } from "@/features/auth/useAuth";
import { claimColumns, renderClaimMobile } from "@/features/claims/columns";
import { paymentColumns, renderPaymentMobile } from "@/features/payments/columns";
import { RenewDialog } from "@/features/policies/RenewDialog";
import { dashboardPolicyColumns, renderPolicyMobile } from "@/features/policies/columns";
import { dateTimeIST, greeting, inrCompact, initials } from "@/lib/format";
import { api } from "@/services/api";
import { AlertsBanner } from "./AlertsBanner";

const LIMIT = 5; // dashboard cards show the latest few rows only; full lists live on their own pages
const bare = "flex-1 rounded-none border-0 shadow-none";

function ProfileCard() {
  const me = useQuery({ queryKey: ["me"], queryFn: api.me });
  const p = me.data?.profile;
  return (
    <Card className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
      {me.isLoading ? <Skeleton className="h-full min-h-32" /> : me.isError ? <ErrorState onRetry={() => me.refetch()} /> : p && (
        <>
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10"><AvatarFallback className="text-sm">{initials(p.full_name)}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-text">{p.full_name}</p><p className="truncate text-xs tabular-nums text-text-muted">{p.customer_id}</p></div>
            <Link to="/profile" className="inline-flex shrink-0 items-center rounded text-sm font-medium text-primary hover:underline max-md:min-h-10">Edit profile</Link>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div className="min-w-0"><dt className="text-xs text-text-muted">Email</dt><dd className="truncate text-text" title={p.email}>{p.email}</dd></div>
            <div className="min-w-0"><dt className="text-xs text-text-muted">Phone</dt><dd className="truncate tabular-nums text-text">{p.phone}</dd></div>
            <div className="min-w-0"><dt className="text-xs text-text-muted">City</dt><dd className="truncate text-text">{p.city}</dd></div>
            <div className="min-w-0"><dt className="text-xs text-text-muted">PAN</dt><dd className="tabular-nums text-text">{p.pan_masked}</dd></div>
          </dl>
        </>
      )}
    </Card>
  );
}

function RenewalCard() {
  const s = useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard }).data;
  const r = s?.next_renewal;
  const [renewing, setRenewing] = useState(false);
  return (
    <Card className="shrink-0 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-section">Next renewal</h2>
        {r && <Button size="sm" onClick={() => setRenewing(true)} aria-label={`Renew ${r.policy_number}`}>Renew</Button>}
      </div>
      {!s ? <Skeleton className="mt-3 h-14" /> : r ? (
        <>
          <p className="mt-2 text-sm text-text"><span className="font-medium tabular-nums">{r.policy_number}</span><span className="text-text-muted"> · </span><span className="tabular-nums text-text-secondary">{r.date_display}</span></p>
          <Progress className="mt-2" value={100 - Math.min(100, (r.days_left / 365) * 100)} label={`Days until renewal of ${r.policy_number}`} />
          <p className="mt-1.5 text-xs tabular-nums text-text-muted">{r.days_left} days left</p>
        </>
      ) : <p className="mt-2 text-sm text-text-secondary">No upcoming renewals.</p>}
      {r && <RenewDialog policyNumber={r.policy_number} open={renewing} onOpenChange={setRenewing} />}
    </Card>
  );
}

export default function CustomerDashboard() {
  const { user, lastLogin } = useAuth();
  const nav = useNavigate();
  const { setOpen } = useAssistant();
  const summary = useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard });
  const policies = useQuery({ queryKey: ["policies"], queryFn: () => api.policies() });
  const claims = useQuery({ queryKey: ["claims"], queryFn: () => api.claims() });
  const payments = useQuery({ queryKey: ["payments"], queryFn: api.payments });
  const s = summary.data;
  const pCols = useMemo(dashboardPolicyColumns, []);
  const cCols = useMemo(claimColumns, []);
  const payCols = useMemo(paymentColumns, []);

  return (
    <div className="flex shrink-0 flex-col gap-4 pb-16">
      <PageHeader title={`${greeting()}, ${user?.name.split(" ")[0] ?? ""}`} description="Here's an overview of your insurance portfolio" crumbs={false}
        actions={<>
          {lastLogin && <span className="hidden text-xs tabular-nums text-text-muted sm:inline">Last login {dateTimeIST(lastLogin)}</span>}
          <Button variant="secondary" onClick={() => setOpen(true)}><Sparkles /> Ask Assistant</Button>
        </>} />

      {s && <AlertsBanner alerts={s.alerts} />}
      {summary.isError && <ErrorState onRetry={() => summary.refetch()} />}

      <div className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Active policies" icon={ShieldCheck} loading={summary.isLoading} value={s?.active_policies} hint={policies.data ? `Across ${policies.data.policies.length} polic${policies.data.policies.length === 1 ? "y" : "ies"}` : undefined} />
        <KpiCard label="Total sum insured" icon={Wallet} tone="success" loading={summary.isLoading} value={s ? inrCompact(s.total_sum_insured) : ""} hint={s?.total_sum_insured_display} />
        <KpiCard label="Open claims" icon={FileClock} tone="warning" loading={summary.isLoading} value={s?.open_claims} hint="Submitted or in review" />
        <KpiCard label="Next renewal" icon={CalendarClock} tone="info" loading={summary.isLoading} value={s?.next_renewal ? s.next_renewal.date_display.replace(/ \d{4}$/, "") : "None"}
          hint={s?.next_renewal ? `Renews in ${s.next_renewal.days_left} days` : "No upcoming renewals"} />
      </div>

      <Card className="flex shrink-0 flex-col overflow-hidden">
          <CardHeader className="items-center p-4 pb-3 sm:p-5 sm:pb-3"><CardTitle>My policies</CardTitle><Link to="/policies" className="inline-flex items-center rounded text-sm font-medium text-primary hover:underline max-md:min-h-10">View all</Link></CardHeader>
          <DataTable columns={pCols} data={policies.data?.policies.slice(0, LIMIT)} loading={policies.isLoading} error={policies.isError} onRetry={() => policies.refetch()} hideToolbar noPagination
            className={`${bare} border-t`} onRowClick={(p) => nav(`/policies/${p.policy_number}`)} rowLabel={(p) => `Open policy ${p.policy_number}`}
            renderMobile={renderPolicyMobile} empty={{ title: "No policies yet", message: "Your policies will appear here once they are issued." }} />
        </Card>
        <div className="grid shrink-0 grid-cols-1 gap-4 md:grid-cols-2 [&>*]:h-full">
          <ProfileCard />
          <RenewalCard />
        </div>

      <Card className="flex min-h-[240px] shrink-0 flex-col overflow-hidden">
        <Tabs defaultValue="claims" className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-3 px-4 sm:px-5">
            <TabsList className="border-b-0"><TabsTrigger value="claims">Recent claims</TabsTrigger><TabsTrigger value="payments">Recent payments</TabsTrigger></TabsList>
            <Link to="/claims" className="hidden rounded text-sm font-medium text-primary hover:underline sm:inline">View all</Link>
          </div>
          <TabsContent value="claims" className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
            <DataTable columns={cCols} data={claims.data?.claims.slice(0, LIMIT)} loading={claims.isLoading} error={claims.isError} onRetry={() => claims.refetch()} hideToolbar noPagination
              className={`${bare} border-t`} renderMobile={renderClaimMobile} empty={{ title: "No claims", message: "You have not filed any claims." }} />
          </TabsContent>
          <TabsContent value="payments" className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
            <DataTable columns={payCols} data={payments.data?.payments.slice(0, LIMIT)} loading={payments.isLoading} error={payments.isError} onRetry={() => payments.refetch()} hideToolbar noPagination
              className={`${bare} border-t`} renderMobile={renderPaymentMobile} empty={{ title: "No payments", message: "Premium payments will be listed here." }} />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

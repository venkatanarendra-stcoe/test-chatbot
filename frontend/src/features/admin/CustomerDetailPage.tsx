import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/common/DataTable";
import { Dl, StatStrip } from "@/components/common/Dl";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Page, PageHeader } from "@/components/common/PageHeader";
import { claimColumns, renderClaimMobile } from "@/features/claims/columns";
import { paymentColumns, renderPaymentMobile } from "@/features/payments/columns";
import { policyColumns, renderPolicyMobile } from "@/features/policies/columns";
import { ApiError, api } from "@/services/api";
import { AgentLogsTable } from "./AgentLogsPage";

export default function CustomerDetailPage() {
  const { customerId = "" } = useParams();
  const q = useQuery({ queryKey: ["admin-customer", customerId], queryFn: () => api.adminCustomer(customerId) });
  const pc = useMemo(policyColumns, []), cc = useMemo(claimColumns, []), yc = useMemo(paymentColumns, []);
  if (q.isLoading) return <Page><PageHeader title="Customer" /><Skeleton className="h-64 rounded-xl" /></Page>;
  if (q.error instanceof ApiError && q.error.status === 404) return <Page><PageHeader title="Customer not found" /><Card><EmptyState title="Customer not found" action={<Button asChild variant="outline"><Link to="/admin/customers">Back to customers</Link></Button>} /></Card></Page>;
  if (q.isError || !q.data) return <Page><PageHeader title="Customer" /><Card><ErrorState onRetry={() => q.refetch()} /></Card></Page>;
  const { profile: p, policies, claims, payments, username } = q.data;

  return (
    <Page>
      <PageHeader title={p.full_name} description={<span className="tabular-nums">{p.customer_id}</span>} />
      <Card><StatStrip items={[["Policies", policies.length], ["Claims", claims.length], ["Payments", payments.length], ["Location", `${p.city}, ${p.state}`], ["PAN (masked)", p.pan_masked]]} /></Card>
      <Tabs defaultValue="profile" className="flex flex-col gap-4">
        <TabsList><TabsTrigger value="profile">Profile</TabsTrigger><TabsTrigger value="policies">Policies ({policies.length})</TabsTrigger><TabsTrigger value="claims">Claims ({claims.length})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger><TabsTrigger value="activity">Agent activity</TabsTrigger></TabsList>
        <TabsContent value="profile"><Card><CardContent>
          <Dl items={[["Email", p.email], ["Phone", p.phone], ["Date of birth", p.date_of_birth_display], ["Location", `${p.city}, ${p.state}`], ["PAN (masked)", p.pan_masked], ["Account reference", p.account_reference], ["Username", username ?? "—"]]} />
        </CardContent></Card></TabsContent>
        <TabsContent value="policies"><DataTable columns={pc} data={policies} searchPlaceholder="Search policies…" renderMobile={renderPolicyMobile} empty={{ title: "No policies" }} /></TabsContent>
        <TabsContent value="claims"><DataTable columns={cc} data={claims} searchPlaceholder="Search claims…" renderMobile={renderClaimMobile} empty={{ title: "No claims" }} /></TabsContent>
        <TabsContent value="payments"><DataTable columns={yc} data={payments} searchPlaceholder="Search payments…" renderMobile={renderPaymentMobile} empty={{ title: "No payments" }} /></TabsContent>
        <TabsContent value="activity">{username ? <AgentLogsTable fixedUser={username} embedded /> : <Card><EmptyState title="No user account" message="This customer has no portal login." /></Card>}</TabsContent>
      </Tabs>
    </Page>
  );
}

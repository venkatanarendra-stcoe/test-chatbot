import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dl } from "@/components/common/Dl";
import { ErrorState } from "@/components/common/ErrorState";
import { Page, PageHeader } from "@/components/common/PageHeader";
import { api } from "@/services/api";

const schema = z.object({
  phone: z.string().trim().regex(/^\+91[ -]?\d{5}[ -]?\d{5}$/, "Use the format +91 98765 43210"),
  email: z.string().trim().email("Enter a valid email address").max(128),
  city: z.string().trim().min(1, "City is required").max(64),
  state: z.string().trim().min(1, "State is required").max(64),
});
type Values = z.infer<typeof schema>;

function Field({ id, label, error, ...rest }: { id: keyof Values; label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (<div className="space-y-1.5"><Label htmlFor={id}>{label}</Label><Input id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} {...rest} />{error && <p id={`${id}-err`} className="text-xs text-danger">{error}</p>}</div>);
}

export default function ProfilePage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["me"], queryFn: api.me });
  const p = data?.profile;
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { phone: "", email: "", city: "", state: "" } });
  useEffect(() => { if (p) form.reset({ phone: p.phone, email: p.email, city: p.city, state: p.state }); }, [p, form]);
  const save = useMutation({
    mutationFn: api.updateMe,
    onSuccess: (me) => { qc.setQueryData(["me"], me); toast.success("Profile updated"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const e = form.formState.errors;

  return (
    <Page>
      <PageHeader title="Profile" description="Your personal details and contact information." />
      {isLoading ? <Skeleton className="h-80 rounded-xl" /> : isError ? <Card><ErrorState onRetry={() => refetch()} /></Card> : !p ? <p className="text-sm text-text-secondary">Administrator accounts have no customer profile.</p> : (
        <div className="grid gap-4 lg:grid-cols-2 xl:gap-6">
          <Card className="h-full"><CardHeader className="flex-col gap-1"><CardTitle>Personal details</CardTitle><CardDescription>These details cannot be changed here.</CardDescription></CardHeader>
            <CardContent><Dl cols={1} className="divide-y divide-border [&>div]:pt-4 [&>div:first-child]:pt-0"
              items={[["Name", p.full_name], ["Customer ID", p.customer_id], ["Date of birth", p.date_of_birth_display], ["PAN", p.pan_masked], ["Account reference", p.account_reference]]} /></CardContent></Card>
          <Card className="h-full"><CardHeader className="flex-col gap-1"><CardTitle>Contact details</CardTitle><CardDescription>Keep these up to date so we can reach you.</CardDescription></CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-4" noValidate>
                <Field id="phone" label="Phone" error={e.phone?.message} autoComplete="tel" {...form.register("phone")} />
                <Field id="email" label="Email" error={e.email?.message} type="email" autoComplete="email" {...form.register("email")} />
                <div className="grid gap-4 sm:grid-cols-2"><Field id="city" label="City" error={e.city?.message} {...form.register("city")} /><Field id="state" label="State" error={e.state?.message} {...form.register("state")} /></div>
                <Button type="submit" disabled={save.isPending || !form.formState.isDirty}>{save.isPending && <Loader2 className="animate-spin" />} Save changes</Button>
              </form>
            </CardContent></Card>
        </div>
      )}
    </Page>
  );
}

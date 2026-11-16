import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dl } from "@/components/common/Dl";
import { StatusBadge } from "@/components/common/StatusBadge";
import { api } from "@/services/api";

export const RENEWABLE = ["Active", "Grace Period", "Lapsed"];
const MODES = ["UPI", "Net Banking", "Credit Card", "Auto-debit"];

export function RenewDialog({ policyNumber, open, onOpenChange }: { policyNumber: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState("UPI");
  const q = useQuery({ queryKey: ["policy", policyNumber], queryFn: () => api.policy(policyNumber), enabled: open });
  const p = q.data;
  const renew = useMutation({
    mutationFn: () => api.renewPolicy(policyNumber, mode),
    onSuccess: (r) => {
      for (const k of ["dashboard", "policies", "policy", "payments"]) void qc.invalidateQueries({ queryKey: [k] });
      toast.success(`${policyNumber} renewed until ${r.policy.end_date_display}`);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Renew policy</DialogTitle><DialogDescription>Renewing extends your cover by one year from the current end date.</DialogDescription></DialogHeader>
        {!p ? <Skeleton className="h-32" /> : (
          <div className="space-y-4">
            <Dl items={[["Policy", <span key="n" className="font-medium">{p.policy_number}</span>], ["Product", p.product], ["Status", <StatusBadge key="s" status={p.status} />],
              ["Current end date", p.end_date_display], ["Premium to pay", <span key="a" className="font-medium">{p.annual_premium_display}</span>]]} />
            <div className="space-y-1.5">
              <Label htmlFor="renew-mode">Payment mode</Label>
              <Select id="renew-mode" className="w-full" wrapperClassName="block" value={mode} onChange={(e) => setMode(e.target.value)}>{MODES.map((m) => <option key={m}>{m}</option>)}</Select>
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={renew.isPending}>Cancel</Button>
          <Button onClick={() => renew.mutate()} disabled={!p || renew.isPending}>{renew.isPending && <Loader2 className="animate-spin" />}{p ? `Pay ${p.annual_premium_display} and renew` : "Renew"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dl } from "@/components/common/Dl";
import { StatusBadge } from "@/components/common/StatusBadge";
import type { Claim } from "@/services/api";
import { ClaimTimeline } from "./ClaimTimeline";

export function ClaimDetailSheet({ claim, onClose }: { claim: Claim | null; onClose: () => void }) {
  return (
    <Sheet open={!!claim} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-[480px]">
        {claim && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3 tabular-nums">{claim.claim_number}<StatusBadge status={claim.status} /></SheetTitle>
              <SheetDescription>{claim.claim_type} claim</SheetDescription>
            </SheetHeader>
            <SheetBody className="space-y-6">
              <Dl cols={2} items={[["Claim amount", claim.amount_display], ["Filed on", claim.filed_date_display], ["Policy", claim.policy_number], ["Type", claim.claim_type]]} />
              <div><p className="text-xs font-medium text-text-muted">Description</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-text">{claim.description}</p></div>
              <div className="border-t border-border pt-5"><h3 className="mb-4 text-section">Status timeline</h3><ClaimTimeline status={claim.status} /></div>
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

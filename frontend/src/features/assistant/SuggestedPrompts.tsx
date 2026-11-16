import { useMatch } from "react-router-dom";
import { useAuth } from "@/features/auth/useAuth";

/** Context-aware starters by page: dashboard, policies, claims, payments, a specific policy, or generic. */
export function usePrompts(): string[] {
  const { user } = useAuth();
  const policy = useMatch("/policies/:policyNumber");
  const dash = useMatch({ path: "/", end: true });
  const claims = useMatch("/claims");
  const payments = useMatch("/payments");
  const policies = useMatch("/policies");
  if (user?.role === "admin") return ["List customers", "Show customer CUST-1001", "What is a grace period?"];
  if (policy?.params.policyNumber) {
    const n = decodeURIComponent(policy.params.policyNumber);
    return [`Explain the coverage of ${n}`, "What documents do I need to file a claim?", "Show my payments"];
  }
  if (claims) return ["Show my claims", "What documents do I need to file a claim?", "How long does claim settlement take?"];
  if (payments) return ["Show my payments", "Did any of my payments fail?", "When is my next premium due?"];
  if (policies) return ["List my policies", "Is any of my policies in grace period?", "What is a deductible?"];
  if (dash) return ["What is my policy number?", "Show my recent claims", "When is my next renewal?", "What is a no-claim bonus?"];
  return ["What is my policy number?", "Show my claims", "What is a deductible?"];
}

export function SuggestedPrompts({ onPick, disabled }: { onPick: (p: string) => void; disabled?: boolean }) {
  const prompts = usePrompts();
  return (
    <div className="flex flex-wrap gap-2">
      {prompts.map((s) => (
        <button key={s} type="button" disabled={disabled} onClick={() => onPick(s)}
          className="inline-flex h-8 items-center rounded-full border border-border bg-surface px-3 text-[13px] text-text-secondary transition-colors hover:bg-surface-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">{s}</button>
      ))}
    </div>
  );
}

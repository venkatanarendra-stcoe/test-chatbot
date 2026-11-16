import { useQuery } from "@tanstack/react-query";
import { Outlet } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { api } from "@/services/api";

/** Banner shown on every admin page when any guardrail layer is switched off. */
export function AdminLayout() {
  const { data } = useQuery({ queryKey: ["admin-system"], queryFn: api.adminSystem });
  const g = data?.guardrails;
  const off = g ? (["input", "tool", "output"] as const).filter((k) => !g[k]) : [];
  return (
    <>
      {g?.degraded && (
        <div role="alert" className="mb-4 flex shrink-0 items-start gap-3 rounded-lg border border-danger/30 bg-danger-bg px-3 py-2.5 text-sm text-danger">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
          <p><strong className="font-semibold">Guardrails degraded:</strong> the {off.join(", ")} layer{off.length > 1 ? "s are" : " is"} disabled. Identity, authorization, the read-only tools role with row-level security, and fail-closed behaviour remain active.</p>
        </div>
      )}
      <Outlet />
    </>
  );
}

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dl } from "@/components/common/Dl";
import { StatusBadge } from "@/components/common/StatusBadge";
import { dateTimeIST } from "@/lib/format";
import type { AgentLog } from "@/services/api";

const ACTION_TONE = { block: "danger", flag: "warning", redact: "neutral" } as const;

function JsonBlock({ value }: { value: unknown }) {
  const [done, setDone] = useState(false);
  const text = JSON.stringify(value, null, 2);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { toast.error("Could not copy"); }
  };
  return (
    <div className="relative rounded-lg border border-border bg-surface-muted">
      <Button variant="outline" size="sm" className="absolute right-2 top-2 z-10 h-7" onClick={copy} aria-label="Copy JSON">{done ? <Check /> : <Copy />}{done ? "Copied" : "Copy"}</Button>
      <pre className="max-h-[360px] overflow-auto p-3 pr-24 font-mono text-xs leading-4 text-text scrollbar-thin" tabIndex={0}>{text}</pre>
    </div>
  );
}

export function LogDetailSheet({ log, onClose }: { log: AgentLog | null; onClose: () => void }) {
  return (
    <Sheet open={!!log} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-[640px]">
        {log && (
          <>
            <SheetHeader>
              <SheetTitle>Agent log</SheetTitle>
              <SheetDescription className="break-all font-mono text-xs">{log.request_id} · {dateTimeIST(log.created_at)}</SheetDescription>
            </SheetHeader>
            <SheetBody className="space-y-6">
              <Dl cols={2} items={[["User", log.user ?? "—"], ["Latency", `${log.latency_ms} ms`], ["Provider / model", `${log.llm_provider ?? "—"} / ${log.llm_model ?? "—"}`],
                ["Result", <span key="r" className="flex flex-wrap gap-1.5"><StatusBadge status={log.authorization_result} />{log.blocked_by && <StatusBadge status={log.blocked_by} tone="danger" />}{log.tainted && <StatusBadge status="tainted" tone="warning" />}{log.guardrails_degraded && <StatusBadge status="guardrails degraded" tone="danger" />}</span>]]} />
              <section className="space-y-2"><h3 className="text-section">Guardrail events ({log.guardrail_events.length})</h3>
                {log.guardrail_events.length === 0 ? <p className="text-sm text-text-secondary">None.</p> : (
                  <ul className="space-y-1.5 text-xs">{log.guardrail_events.map((e, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-2.5 py-2"><StatusBadge status={e.action} tone={ACTION_TONE[e.action]} />
                      <span className="uppercase text-text-muted">{e.stage}</span><code className="font-mono text-text">{e.rule_id}</code><span className="text-text-muted">{e.severity}</span>{e.detail && <span className="break-all text-text-secondary">— {e.detail}</span>}</li>))}</ul>)}
              </section>
              <section className="space-y-2"><h3 className="text-section">Tool calls ({log.tool_calls.length})</h3>
                {log.tool_calls.length === 0 ? <p className="text-sm text-text-secondary">None.</p> : (
                  <ul className="space-y-1.5 text-xs">{log.tool_calls.map((t, i) => (
                    <li key={i} className="rounded-lg border border-border px-2.5 py-2"><div className="flex flex-wrap items-center gap-2"><code className="font-mono font-medium text-text">{t.tool}</code><StatusBadge status={t.authorization} />
                      <span className="text-text-muted">{t.result_status}{t.reason ? ` · ${t.reason}` : ""}</span></div><pre className="mt-1 overflow-x-auto font-mono text-text-secondary">{JSON.stringify(t.arguments)}</pre></li>))}</ul>)}
              </section>
              <section className="space-y-2"><h3 className="text-section">Full log (JSON)</h3><JsonBlock value={log} /></section>
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

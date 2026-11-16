import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { groupOf, relativeTime, type Group } from "@/lib/format";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import { useAssistant } from "./AssistantProvider";

const ORDER: Group[] = ["Today", "Previous 7 days", "Older"];

export function ConversationList() {
  const { openConversation, removeConversation, conversationId } = useAssistant();
  const [confirm, setConfirm] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["conversations"], queryFn: api.conversations });
  const groups = useMemo(() => {
    const g = new Map<Group, NonNullable<typeof data>>();
    for (const c of data ?? []) g.set(groupOf(c.updated_at), [...(g.get(groupOf(c.updated_at)) ?? []), c]);
    return ORDER.filter((k) => g.has(k)).map((k) => [k, g.get(k)!] as const);
  }, [data]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3 scrollbar-thin">
      {isLoading && <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-11" />)}</div>}
      {isError && <ErrorState message="Could not load your conversations." onRetry={() => refetch()} />}
      {data && data.length === 0 && <EmptyState icon={MessageSquare} title="No conversations yet" message="Start a new chat to ask the assistant a question." />}
      {groups.map(([label, items]) => (
        <section key={label} className="mb-4" aria-label={label}>
          <h3 className="px-2 pb-1 text-xs font-medium uppercase tracking-[0.04em] text-text-muted">{label}</h3>
          <ul>
            {items.map((c) => (
              <li key={c.id} className="group relative">
                {confirm === c.id ? (
                  <div className="flex h-11 items-center justify-between gap-2 rounded-lg bg-danger-bg px-2 text-sm text-danger" role="alertdialog" aria-label={`Delete ${c.title}?`}>
                    <span className="truncate font-medium">Delete this chat?</span>
                    <span className="flex shrink-0 gap-1">
                      <Button size="sm" variant="outline" className="h-7" onClick={() => setConfirm(null)}>Cancel</Button>
                      <Button size="sm" variant="destructive" className="h-7" onClick={() => { setConfirm(null); void removeConversation(c.id); }}>Delete</Button>
                    </span>
                  </div>
                ) : (
                  <>
                    <button type="button" onClick={() => openConversation(c.id)}
                      className={cn("flex h-11 w-full items-center gap-2 rounded-lg px-2 pr-10 text-left text-sm hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", c.id === conversationId && "bg-primary-soft")}>
                      <MessageSquare className="h-4 w-4 shrink-0 text-text-muted" strokeWidth={1.75} /><span className="min-w-0 flex-1 truncate text-text">{c.title}</span>
                      <span className="shrink-0 text-xs tabular-nums text-text-muted group-hover:invisible group-focus-within:invisible [@media(hover:none)]:hidden">{relativeTime(c.updated_at)}</span>
                    </button>
                    <button type="button" aria-label={`Delete conversation ${c.title}`} onClick={() => setConfirm(c.id)}
                      className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-text-muted opacity-0 hover:bg-danger-bg hover:text-danger focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 [@media(hover:none)]:opacity-100"><Trash2 className="h-4 w-4" strokeWidth={1.75} /></button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

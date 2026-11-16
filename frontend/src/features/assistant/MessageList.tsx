import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/useAuth";
import { dayLabel, sameDay } from "@/lib/format";
import { AssistantAvatar, Message } from "./Message";
import { useAssistant } from "./AssistantProvider";
import { SuggestedPrompts } from "./SuggestedPrompts";
import { TypingIndicator } from "./TypingIndicator";

const GROUP_MS = 2 * 60 * 1000;

export function MessageList() {
  const { user } = useAuth();
  const { messages, sending, loadingConversation, send } = useAssistant();
  const scroller = useRef<HTMLDivElement>(null);
  const [away, setAway] = useState(false);
  const first = user?.name.split(" ")[0] ?? "";

  const toBottom = useCallback((smooth = true) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);
  const onScroll = () => {
    const el = scroller.current;
    if (el) setAway(el.scrollHeight - el.scrollTop - el.clientHeight > 80);
  };
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!away || last?.role === "user") toBottom();
  }, [messages, sending]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scroller} onScroll={onScroll} className="h-full overflow-y-auto scrollbar-thin" role="log" aria-live="polite" aria-label="Conversation">
        <div className="flex min-h-full flex-col gap-4 p-4">
          {loadingConversation ? <div className="space-y-4"><Skeleton className="h-14" /><Skeleton className="h-10 w-2/3" /><Skeleton className="h-20" /></div>
            : messages.length === 0 ? (
              <div className="space-y-4">
                <div className="flex gap-2.5">
                  <AssistantAvatar />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="mb-1 flex h-4 items-center text-xs font-medium leading-4 text-text">Insurance Assistant</p>
                    <p className="text-text">Hi {first}, how can I help? Ask me about your policies, claims, payments or insurance terms.</p>
                  </div>
                </div>
                <div className="pl-[38px]"><SuggestedPrompts onPick={send} disabled={sending} /></div>
              </div>
            ) : messages.map((m, i) => {
              const prev = messages[i - 1];
              const newDay = !prev || !sameDay(prev.created_at, m.created_at);
              const continued = !newDay && !!prev && prev.role === m.role && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_MS;
              return (
                <Fragment key={m.id}>
                  {newDay && <div className="flex items-center gap-3 text-xs text-text-muted" role="separator"><span className="h-px flex-1 bg-border" />{dayLabel(m.created_at)}<span className="h-px flex-1 bg-border" /></div>}
                  <Message message={m} userName={user?.name ?? ""} continued={continued} />
                </Fragment>
              );
            })}
          {sending && <TypingIndicator />}
        </div>
      </div>
      {away && (
        <button type="button" onClick={() => toBottom()} className="absolute bottom-3 left-1/2 flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-xs font-medium text-text shadow-lg hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ArrowDown className="h-3.5 w-3.5" aria-hidden />Jump to latest
        </button>
      )}
    </div>
  );
}

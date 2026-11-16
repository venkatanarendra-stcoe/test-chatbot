import { useEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAssistant } from "./AssistantProvider";

const MAX = 2000;
const LINE = 20;

export function Composer() {
  const { send, sending, open, view } = useAssistant();
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, LINE * 5)}px`;
  }, [text]);
  useEffect(() => { if (open && view === "chat" && !sending) ref.current?.focus(); }, [open, view, sending]);

  const submit = () => {
    const t = text.trim();
    if (!t || sending || t.length > MAX) return;
    setText("");
    void send(t);
  };

  return (
    <div className="shrink-0 border-t border-border bg-surface px-3 pb-2 pt-3">
      <div className="flex items-end gap-2 rounded-xl border border-border bg-surface p-2 shadow-xs focus-within:ring-2 focus-within:ring-ring">
        <label htmlFor="assistant-composer" className="sr-only">Message</label>
        <textarea id="assistant-composer" data-testid="chat-input" ref={ref} rows={1} value={text} disabled={sending} maxLength={MAX} placeholder="Ask about your insurance…"
          className="max-h-[100px] min-h-[32px] flex-1 resize-none bg-transparent px-1 py-1.5 text-sm leading-5 text-text outline-none focus-visible:ring-0 placeholder:text-text-muted disabled:opacity-60"
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }} />
        <button type="button" data-testid="chat-send" onClick={submit} disabled={sending || !text.trim()} aria-label="Send message"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
          <SendHorizontal className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-text-muted">
        <span className="truncate">Enter to send · Shift+Enter for new line</span>
        <span className={cn("shrink-0 tabular-nums", text.length > MAX * 0.9 && "text-warning")} aria-live="polite">{text.length}/{MAX}</span>
      </div>
      <p className="mt-1 text-micro text-text-muted">AI responses may be inaccurate. Verify important details in your policy documents.</p>
    </div>
  );
}

import { AssistantAvatar } from "./Message";

export function TypingIndicator() {
  return (
    <div className="flex gap-2.5" role="status" aria-label="Assistant is typing">
      <AssistantAvatar />
      <div className="flex h-7 items-center gap-1 pt-1">
        {[0, 150, 300].map((d) => <span key={d} className="h-1.5 w-1.5 animate-dot-bounce rounded-full bg-text-muted" style={{ animationDelay: `${d}ms` }} />)}
      </div>
    </div>
  );
}

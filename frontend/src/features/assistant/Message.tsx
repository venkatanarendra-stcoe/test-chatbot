import { useState } from "react";
import { Check, Copy, Hash, ShieldAlert, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { initials, timeIST } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/services/api";

async function copy(text: string, what: string) {
  try { await navigator.clipboard.writeText(text); toast.success(`${what} copied`); return true; }
  catch { toast.error("Could not copy to clipboard"); return false; }
}

export function AssistantAvatar() {
  return <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary" aria-hidden><Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} /></span>;
}

const mdComponents = {
  a: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  table: ({ children }: { children?: React.ReactNode }) => <div className="table-scroll"><table>{children}</table></div>,
};

function ActionButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={label} onClick={onClick} className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:h-3.5 [&_svg]:w-3.5">{children}</button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Thread-style message row: everything is left-aligned. `continued` hides the avatar and meta line for grouped messages. */
export function Message({ message, userName, continued }: { message: ChatMessage; userName: string; continued: boolean }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const blocked = !isUser && !!message.blocked;

  return (
    <div data-testid="chat-message" data-role={message.role} data-request-id={message.request_id ?? undefined} className={cn("group relative flex gap-2.5", continued ? "-mt-2" : "")}>
      {continued ? <span className="w-7 shrink-0" aria-hidden /> : isUser
        ? <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-medium text-text-secondary" aria-hidden>{initials(userName)}</span>
        : <AssistantAvatar />}
      <div className="min-w-0 flex-1">
        {!continued && (
          <p className="mb-1 flex h-4 items-center gap-1.5 text-xs leading-4"><span className="font-medium text-text">{isUser ? "You" : "Insurance Assistant"}</span><span className="text-text-muted">·</span><time dateTime={message.created_at} className="tabular-nums text-text-muted">{timeIST(message.created_at)}</time></p>
        )}
        {isUser ? (
          <div className="whitespace-pre-wrap break-words rounded-lg bg-surface-muted px-3 py-2.5 text-sm text-text">{message.content}</div>
        ) : (
          <div className={cn("flex items-start gap-2", blocked && "text-text-secondary")}>
            {blocked && <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={1.75} aria-label="Request blocked" />}
            {/* untrusted model output: no raw HTML, no images, links rendered as plain text */}
            <div className={cn("prose-chat min-w-0 flex-1", blocked && "text-text-secondary")}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml disallowedElements={["img"]} components={mdComponents}>{message.content}</ReactMarkdown>
            </div>
          </div>
        )}
        {!isUser && message.request_id && <p className="mt-1 break-all font-mono text-micro text-text-muted">{message.request_id}</p>}
      </div>
      <div className="absolute right-0 top-0 flex rounded-lg border border-border bg-surface opacity-0 shadow-xs transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
        <ActionButton label="Copy message" onClick={async () => { if (await copy(message.content, "Message")) { setCopied(true); setTimeout(() => setCopied(false), 1500); } }}>{copied ? <Check /> : <Copy />}</ActionButton>
        {!isUser && message.request_id && <ActionButton label="Copy request ID" onClick={() => void copy(message.request_id!, "Request ID")}><Hash /></ActionButton>}
      </div>
    </div>
  );
}

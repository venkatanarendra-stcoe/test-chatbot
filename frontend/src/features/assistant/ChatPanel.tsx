import { ArrowLeft, History, Maximize2, Minimize2, SquarePen, Sparkles, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { useAssistant } from "./AssistantProvider";
import { Composer } from "./Composer";
import { ConversationList } from "./ConversationList";
import { MessageList } from "./MessageList";

function IconBtn({ label, onClick, pressed, testId, className, children }: { label: string; onClick: () => void; pressed?: boolean; testId?: string; className?: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={label} aria-pressed={pressed} data-testid={testId} onClick={onClick}
          className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:h-10 max-md:w-10 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:stroke-[1.75]", pressed && "bg-surface-muted text-text", className)}>{children}</button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function ChatPanel() {
  const { open, setOpen, expanded, setExpanded, view, setView, newChat, online } = useAssistant();
  const mobile = useIsMobile();
  if (!open) return null;
  const isOnline = online !== false;
  return (
    <section role="dialog" aria-label="Insurance Assistant" aria-modal="false" data-testid="chat-panel"
      className={cn("fixed z-[60] flex flex-col overflow-hidden border border-border bg-surface shadow-lg animate-panel-in",
        mobile ? "inset-0 rounded-none border-0" : expanded ? "inset-y-0 right-0 w-[560px] max-w-full rounded-none border-y-0 border-r-0" : "bottom-6 right-6 h-[min(640px,calc(100dvh-96px))] w-[420px] rounded-2xl")}>
      <header className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary" aria-hidden><Sparkles className="h-4 w-4" strokeWidth={1.75} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold leading-5 text-text"><span className="truncate">Insurance Assistant</span><span className="rounded bg-primary-soft px-1.5 text-micro font-medium text-primary">AI</span></h2>
          <p className="flex items-center gap-1.5 text-xs leading-4 text-text-muted" role="status">
            <span className={cn("h-1.5 w-1.5 rounded-full", isOnline ? "bg-success" : "bg-danger")} aria-hidden />{isOnline ? "Online" : "Offline"}
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          <IconBtn label="New chat" testId="chat-new" onClick={newChat}><SquarePen /></IconBtn>
          <IconBtn label="Conversation history" testId="chat-history" pressed={view === "history"} onClick={() => setView(view === "history" ? "chat" : "history")}><History /></IconBtn>
          {!mobile && <IconBtn label={expanded ? "Collapse panel" : "Expand panel"} onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize2 /> : <Maximize2 />}</IconBtn>}
          <IconBtn label="Close assistant" testId="chat-close" onClick={() => setOpen(false)}><X /></IconBtn>
        </div>
      </header>
      {view === "history" ? (
        <>
          <div className="flex h-11 shrink-0 items-center gap-1 border-b border-border px-2">
            <IconBtn label="Back to chat" onClick={() => setView("chat")}><ArrowLeft /></IconBtn>
            <h3 className="text-sm font-medium text-text">History</h3>
          </div>
          <ConversationList />
        </>
      ) : <><MessageList /><Composer /></>}
    </section>
  );
}

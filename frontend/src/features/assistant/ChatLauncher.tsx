import { Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAssistant } from "./AssistantProvider";

export function ChatLauncher() {
  const { open, setOpen } = useAssistant();
  if (open) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" data-testid="chat-launcher" onClick={() => setOpen(true)} aria-label="Ask Insurance Assistant (Ctrl+/)" aria-keyshortcuts="Control+/ Meta+/"
          className="fixed bottom-[calc(64px+env(safe-area-inset-bottom)+16px)] right-4 z-40 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-[background-color,transform] hover:bg-primary-hover active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:bottom-6 md:right-6">
          <Sparkles className="h-6 w-6" strokeWidth={1.75} aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">Ask Insurance Assistant</TooltipContent>
    </Tooltip>
  );
}

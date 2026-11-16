import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ErrorState({ message = "Something went wrong while loading this data.", onRetry, className }: { message?: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-2 px-6 py-10 text-center", className)}>
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-danger-bg"><AlertTriangle className="h-5 w-5 text-danger" strokeWidth={1.75} aria-hidden /></div>
      <p className="text-sm text-text-secondary">{message}</p>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}><RefreshCw /> Retry</Button>}
    </div>
  );
}

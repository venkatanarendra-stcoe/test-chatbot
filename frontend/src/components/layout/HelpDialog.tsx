import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const KEYS: [string, string][] = [["Ctrl / Cmd + /", "Open or close the assistant"], ["Enter", "Send a message"], ["Shift + Enter", "New line in a message"], ["Esc", "Close dialogs, sheets and the assistant"]];

export function HelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Help</DialogTitle><DialogDescription>Ask the assistant about your policies, claims and payments.</DialogDescription></DialogHeader>
        <dl className="divide-y divide-border rounded-lg border border-border">
          {KEYS.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 px-3 py-2.5">
              <dt className="text-sm text-text-secondary">{v}</dt>
              <dd><kbd className="rounded-md border border-border bg-surface-muted px-1.5 py-0.5 font-mono text-xs text-text">{k}</kbd></dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}

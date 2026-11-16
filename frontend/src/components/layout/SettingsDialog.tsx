import { usePrefs } from "@/app/theme";
import { Segmented } from "@/components/common/Segmented";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ThemeSwitcher } from "./ThemeSwitcher";

function Row({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-border py-4 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0"><p className="text-sm font-medium">{title}</p><p className="text-xs text-text-muted">{hint}</p></div>
      <div className="w-full shrink-0 sm:w-64">{children}</div>
    </div>
  );
}

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { density, setDensity, sidebar, setSidebar } = usePrefs();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Settings</DialogTitle><DialogDescription>Preferences are stored in this browser only.</DialogDescription></DialogHeader>
        <div>
          <Row title="Theme" hint="Light, dark, or follow your system."><ThemeSwitcher /></Row>
          <Row title="Table density" hint="Row height in data tables.">
            <Segmented label="Table density" value={density} onChange={setDensity} options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} />
          </Row>
          <Row title="Sidebar default" hint="Auto collapses below 1280px.">
            <Segmented label="Sidebar default" value={sidebar} onChange={setSidebar} options={[{ value: "auto", label: "Auto" }, { value: "expanded", label: "Expanded" }, { value: "collapsed", label: "Collapsed" }]} />
          </Row>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { APP_VERSION, APP_VERSION_DATE, CHANGELOG, formatCzechDate } from "@/lib/changelog";

export default function AppVersionLink() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground hover:text-foreground hover:underline underline-offset-2"
      >
        Verze aplikace: {APP_VERSION} ({formatCzechDate(APP_VERSION_DATE)})
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Log změn</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
            {CHANGELOG.map((e, i) => (
              <section key={e.version} className={i > 0 ? "border-t pt-4" : ""}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums">{e.version}</span>
                  <span className="text-xs text-muted-foreground">{formatCzechDate(e.date)}</span>
                  {i === 0 && (
                    <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Aktuální</span>
                  )}
                </div>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-foreground/90">
                  {e.changes.map((c) => <li key={c}>{c}</li>)}
                </ul>
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

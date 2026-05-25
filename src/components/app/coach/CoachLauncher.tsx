import { useMemo, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { MessageSquare, X } from "lucide-react";
import { CoachPanel } from "./CoachPanel";
import type { CoachSurface } from "@/lib/coach/build-coach-context";

function surfaceFromPath(path: string): CoachSurface {
  if (path.startsWith("/app/plan") || path.startsWith("/app/tasks")) return "plan";
  if (path.startsWith("/app/portfolio") || path.startsWith("/app/reflect")) return "portfolio";
  if (path.startsWith("/app/path") || path.startsWith("/app/mission")) return "path";
  if (path.startsWith("/app/forge")) return "forge";
  if (path.startsWith("/app/rescue")) return "rescue";
  if (path.startsWith("/app/chat")) return "coach";
  return "today";
}

export function CoachLauncher() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const surface = useMemo(() => surfaceFromPath(pathname), [pathname]);

  // Don't show launcher on the dedicated Coach page (it IS the Coach)
  if (pathname.startsWith("/app/chat")) return null;
  // Don't show on auth / onboarding / landing
  if (!pathname.startsWith("/app")) return null;

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 md:bottom-6 md:right-6"
          aria-label="Open Coach"
          title="Talk to Moment"
        >
          <MessageSquare className="h-5 w-5" />
        </button>
      )}

      {/* Slide-over panel */}
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute inset-0"
            aria-label="Close Coach"
          />
          <aside className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-background p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  / coach · {surface}
                </div>
                <h2 className="mt-0.5 text-base font-semibold tracking-tight">Moment is with you</h2>
              </div>
              <div className="flex items-center gap-1">
                <Link
                  to="/app/chat"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-border px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground"
                >
                  Full view
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <CoachPanel surface={surface} compact />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

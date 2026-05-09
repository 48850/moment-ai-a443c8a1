import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { Home, Calendar, Target, ArrowLeft, MessageSquare, Heart, LifeBuoy, ListChecks, Hammer, BarChart3 } from "lucide-react";

type SubTab = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; end?: boolean };

const tabs: { to: string; label: string; icon: React.ComponentType<{ className?: string }>; end?: boolean; match: string[]; sub: SubTab[] }[] = [
  {
    to: "/app",
    label: "Today",
    icon: Home,
    end: true,
    match: ["/app", "/app/chat", "/app/reflect", "/app/rescue"],
    sub: [
      { to: "/app", label: "Today", icon: Home, end: true },
      { to: "/app/chat", label: "Chat", icon: MessageSquare },
      { to: "/app/reflect", label: "Reflect", icon: Heart },
      { to: "/app/rescue", label: "Rescue", icon: LifeBuoy },
    ],
  },
  {
    to: "/app/plan",
    label: "Plan",
    icon: Calendar,
    match: ["/app/plan", "/app/tasks", "/app/forge"],
    sub: [
      { to: "/app/plan", label: "Plan", icon: Calendar },
      { to: "/app/tasks", label: "Tasks", icon: ListChecks },
      { to: "/app/forge", label: "Forge", icon: Hammer },
    ],
  },
  {
    to: "/app/mission",
    label: "Mission",
    icon: Target,
    match: ["/app/mission", "/app/audit"],
    sub: [
      { to: "/app/mission", label: "Mission", icon: Target },
      { to: "/app/audit", label: "Audit", icon: BarChart3 },
    ],
  },
];

export const AppShell = () => {
  const { pathname } = useLocation();
  // forge/:featureId routes should keep the Plan group (Forge sub-tab) active
  const normalizedPath = pathname.startsWith("/app/forge/") ? "/app/forge" : pathname;
  const activeGroup =
    tabs.find((t) => t.match.includes(normalizedPath)) ??
    tabs.find((t) => normalizedPath.startsWith(t.to) && t.to !== "/app") ??
    tabs[0];

  return (
    <div className="app-zone min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:px-8">
        <Link to="/" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="inline-flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full border border-primary/40 bg-primary/10">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            <span className="font-display text-base font-medium tracking-tight text-foreground">Moment</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">/ai</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (!confirm("Reset onboarding? This wipes local state.")) return;
              try {
                Object.keys(localStorage)
                  .filter((k) => k.startsWith("moment_"))
                  .forEach((k) => localStorage.removeItem(k));
              } catch {}
              window.location.assign("/onboarding");
            }}
            className="rounded-md border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Reset onboarding
          </button>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">your moment</div>
        </div>
      </header>


      <div className="flex">
        {/* Desktop sidebar — three primary tabs */}
        <aside className="sticky top-[52px] hidden h-[calc(100vh-52px)] w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border/60 px-3 py-6 md:flex">
          {tabs.map((t) => {
            const isActive = activeGroup.to === t.to;
            return (
              <div key={t.to}>
                <NavLink
                  to={t.to}
                  end={t.end}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </NavLink>
                {isActive && t.sub.length > 1 && (
                  <div className="ml-3 mt-1 flex flex-col gap-0.5 border-l border-border/60 pl-3">
                    {t.sub.map((s) => (
                      <NavLink
                        key={s.to}
                        to={s.to}
                        end={s.end}
                        className={({ isActive: subActive }) =>
                          `flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors ${
                            subActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                          }`
                        }
                      >
                        <s.icon className="h-3 w-3" />
                        {s.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </aside>

        <main className="min-h-[calc(100vh-52px)] flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-12">
          {/* Contextual sub-nav (mobile + desktop) */}
          {activeGroup.sub.length > 1 && (
            <div className="mb-6 flex flex-wrap gap-1.5">
              {activeGroup.sub.map((s) => (
                <NavLink
                  key={s.to}
                  to={s.to}
                  end={s.end}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                      isActive
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`
                  }
                >
                  <s.icon className="h-3 w-3" />
                  {s.label}
                </NavLink>
              ))}
            </div>
          )}
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav — three tabs only */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border/60 bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur md:hidden"
        aria-label="Primary"
      >
        {tabs.map((t) => {
          const isActive = activeGroup.to === t.to;
          return (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={`flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-md py-1 text-[10px] ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <t.icon className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
              {t.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
};

import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { Home, Calendar, Target, ArrowLeft, MessageSquare, Heart, LifeBuoy, ListChecks, Hammer, Sun, Moon, Settings, BookOpenText } from "lucide-react";
import { MomentStar } from "@/components/app/Mote";
import { useTheme } from "@/hooks/use-theme";
import { FlameBurstOverlay } from "@/components/app/FlameBurstOverlay";
import { AppTutorial } from "@/components/app/AppTutorial";

type SubTab = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; end?: boolean };

// 5 primary worlds: Today · Plan · Coach · Portfolio · Path
const tabs: { to: string; label: string; icon: React.ComponentType<{ className?: string }>; end?: boolean; match: string[]; sub: SubTab[] }[] = [
  {
    to: "/app",
    label: "Today",
    icon: Home,
    end: true,
    match: ["/app", "/app/rescue"],
    sub: [
      { to: "/app", label: "Today", icon: Home, end: true },
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
    to: "/app/chat",
    label: "Coach",
    icon: MessageSquare,
    match: ["/app/chat"],
    sub: [
      { to: "/app/chat", label: "Coach", icon: MessageSquare },
    ],
  },
  {
    to: "/app/portfolio",
    label: "Portfolio",
    icon: BookOpenText,
    match: ["/app/portfolio", "/app/reflect"],
    sub: [
      { to: "/app/portfolio", label: "Portfolio", icon: BookOpenText },
      { to: "/app/reflect", label: "Reflect", icon: Heart },
    ],
  },
  {
    to: "/app/path",
    label: "Path",
    icon: Target,
    match: ["/app/path", "/app/mission", "/app/mission/summary"],
    sub: [
      { to: "/app/path", label: "Path", icon: Target },
      { to: "/app/mission/summary", label: "Recap", icon: Target },
    ],
  },
];

export const AppShell = () => {
  const { pathname } = useLocation();
  const { theme, toggle: toggleTheme } = useTheme();
  const normalizedPath = pathname.startsWith("/app/forge/")
    ? "/app/forge"
    : pathname.startsWith("/app/settings")
      ? "/app/settings"
      : pathname.startsWith("/app/mission/summary")
        ? "/app/mission/summary"
        : pathname.startsWith("/app/mission")
          ? "/app/path"
          : pathname.startsWith("/app/social")
            ? "/app/portfolio"
            : pathname;
  const activeGroup =
    tabs.find((t) => t.match.includes(normalizedPath)) ??
    tabs.find((t) => normalizedPath.startsWith(t.to) && t.to !== "/app") ??
    tabs[0];

  return (
    <div className="app-zone min-h-screen">
      <FlameBurstOverlay />
      <AppTutorial />
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:px-8">
        <Link to="/" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="inline-flex items-center gap-2">
            <MomentStar size={28} halo={false} className="-my-1" />
            <span className="font-display text-base font-medium tracking-tight text-foreground">Moment</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">/ai</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <NavLink
            to="/app/settings"
            aria-label="Settings"
            title="Settings"
            className={({ isActive }) =>
              `inline-flex h-7 w-7 items-center justify-center rounded-md border border-border ${
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`
            }
          >
            <Settings className="h-3.5 w-3.5" />
          </NavLink>
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={theme === "dark" ? "Switch to light" : "Switch to dark"}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">your moment</div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop sidebar — 5 primary tabs */}
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

      {/* Mobile bottom nav — 5 tabs */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border/60 bg-background/95 px-1 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur md:hidden"
        aria-label="Primary"
      >
        {tabs.map((t) => {
          const isActive = activeGroup.to === t.to;
          return (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-md py-1 text-[10px] ${
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

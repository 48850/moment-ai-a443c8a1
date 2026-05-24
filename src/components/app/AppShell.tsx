import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { Home, Calendar, Target, ArrowLeft, Sun, Moon, Settings } from "lucide-react";
import { MomentStar } from "@/components/app/Mote";
import { useTheme } from "@/hooks/use-theme";
import { FlameBurstOverlay } from "@/components/app/FlameBurstOverlay";
import { AppTutorial } from "@/components/app/AppTutorial";

/**
 * Moment Core v1 shell.
 *
 * Three flat tabs. No sub-tab strips. No drawers. No path peek.
 * Old surfaces (Chat, Reflect, Rescue, Social, Tasks, Forge, Summary Clips)
 * are intentionally not in the nav — their routes still exist for direct
 * links, but the cockpit is gone. Doctrine: one move now, signals preserved.
 */
const tabs = [
  { to: "/app", label: "Today", icon: Home, end: true, match: ["/app"] },
  { to: "/app/plan", label: "Plan", icon: Calendar, match: ["/app/plan"] },
  { to: "/app/mission", label: "Mission", icon: Target, match: ["/app/mission"] },
] as const;

export const AppShell = () => {
  const { pathname } = useLocation();
  const { theme, toggle: toggleTheme } = useTheme();

  const activeGroup =
    tabs.find((t) => t.match.includes(pathname)) ??
    tabs.find((t) => t.to !== "/app" && pathname.startsWith(t.to)) ??
    tabs[0];

  return (
    <div className="app-zone min-h-screen">
      <FlameBurstOverlay />
      <AppTutorial />
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:px-8">
        <Link to="/" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="inline-flex items-center gap-2">
            <MomentStar size={28} halo={false} className="-my-1" />
            <span className="font-display text-base font-medium tracking-tight text-foreground">Moment</span>
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
        </div>
      </header>

      <div className="flex">
        <aside className="sticky top-[52px] hidden h-[calc(100vh-52px)] w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border/60 px-3 py-6 md:flex">
          {tabs.map((t) => {
            const isActive = activeGroup.to === t.to;
            return (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </NavLink>
            );
          })}
        </aside>

        <main className="min-h-[calc(100vh-52px)] flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-12">
          <Outlet />
        </main>
      </div>

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


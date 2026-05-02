import { NavLink, Outlet, Link } from "react-router-dom";
import { Home, MessageSquare, Calendar, Target, ListChecks, ArrowLeft } from "lucide-react";

const tabs = [
  { to: "/app", label: "Home", icon: Home, end: true },
  { to: "/app/chat", label: "Chat", icon: MessageSquare },
  { to: "/app/plan", label: "Plan", icon: Calendar },
  { to: "/app/mission", label: "Mission", icon: Target },
  { to: "/app/tasks", label: "Tasks", icon: ListChecks },
];

export const AppShell = () => (
  <div className="app-zone min-h-screen">
    {/* Top bar */}
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur md:px-8">
      <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />
        <span className="font-semibold tracking-tight text-foreground">Moment</span>
      </Link>
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">dev preview</div>
    </header>

    {/* Desktop sidebar */}
    <div className="flex">
      <aside className="sticky top-[52px] hidden h-[calc(100vh-52px)] w-56 shrink-0 flex-col gap-1 border-r border-border/60 px-3 py-6 md:flex">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`
            }
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </NavLink>
        ))}
      </aside>

      <main className="min-h-[calc(100vh-52px)] flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-12">
        <Outlet />
      </main>
    </div>

    {/* Mobile bottom nav */}
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border/60 bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur md:hidden"
      aria-label="Primary"
    >
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            `flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-md py-1 text-[10px] ${
              isActive ? "text-primary" : "text-muted-foreground"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <t.icon className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
              <span className="sr-only md:not-sr-only">{t.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  </div>
);

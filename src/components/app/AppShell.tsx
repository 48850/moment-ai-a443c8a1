import { NavLink, Outlet, Link } from "react-router-dom";
import { LayoutDashboard, MessageSquare, Target, ArrowLeft } from "lucide-react";

const navItems = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/chat", label: "Chat", icon: MessageSquare },
  { to: "/app/plan", label: "Plan", icon: Target },
];

export const AppShell = () => (
  <div className="relative flex min-h-screen bg-background text-foreground">
    <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r border-border bg-background/60 px-4 py-6 md:flex">
      <Link to="/" className="mb-8 flex items-center gap-2 px-2">
        <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-full gradient-spark">
          <span className="absolute inset-1 rounded-full bg-background" />
          <span className="relative h-2 w-2 rounded-full gradient-spark" />
        </span>
        <span className="font-display text-lg font-semibold tracking-tight">Moment</span>
        <span className="ml-auto rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-accent">dev</span>
      </Link>

      <nav className="flex flex-col gap-1">
        {navItems.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                isActive ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`
            }
          >
            <it.icon className="h-4 w-4" />
            {it.label}
          </NavLink>
        ))}
      </nav>

      <Link to="/" className="mt-auto inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to landing
      </Link>
    </aside>

    <main className="relative z-10 flex-1 px-6 py-8 md:px-10 md:py-12">
      <Outlet />
    </main>
  </div>
);

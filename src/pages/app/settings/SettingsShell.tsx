import { NavLink, Outlet, useLocation, Navigate } from "react-router-dom";
import { User, Lock, Smartphone, Bell, Sparkles, ShieldCheck } from "lucide-react";

const sections = [
  { to: "/app/settings/profile", label: "Profile", icon: User },
  { to: "/app/settings/privacy", label: "Privacy", icon: Lock },
  { to: "/app/settings/device", label: "Device", icon: Smartphone },
  { to: "/app/settings/notifications", label: "Notifications", icon: Bell },
  { to: "/app/settings/plus", label: "Moment Plus", icon: Sparkles },
  { to: "/app/settings/safety", label: "Safety & support", icon: ShieldCheck },
];

export default function SettingsShell() {
  const { pathname } = useLocation();
  if (pathname === "/app/settings" || pathname === "/app/settings/") {
    return <Navigate to="/app/settings/profile" replace />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile, privacy, device, and safety controls.
        </p>
      </header>
      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <nav className="flex flex-row flex-wrap gap-1 md:flex-col">
          {sections.map((s) => (
            <NavLink
              key={s.to}
              to={s.to}
              className={({ isActive }) =>
                `inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`
              }
            >
              <s.icon className="h-4 w-4" />
              {s.label}
            </NavLink>
          ))}
        </nav>
        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </div>
  );
}

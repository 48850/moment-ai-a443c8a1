import { motion } from "motion/react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

const links = [
  { label: "The system", href: "#why" },
  { label: "A day in Moment", href: "#how" },
  { label: "Manifesto", href: "#manifesto" },
];

export const Nav = () => {
  const { user, uid, loading } = useAuth();
  const navigate = useNavigate();

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-30 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 md:px-10"
    >
      <a href="#" className="flex items-center gap-2">
        <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-full gradient-spark shadow-elevated">
          <span className="absolute inset-1 rounded-full bg-background" />
          <span className="relative h-2 w-2 rounded-full gradient-spark" />
        </span>
        <span className="font-display text-xl font-semibold tracking-tight">Moment</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">/ai</span>
      </a>

      <nav className="hidden items-center gap-8 md:flex">
        {links.map((l) => (
          <a key={l.href} href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            {l.label}
          </a>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        {!loading && uid ? (
          <Link
            to="/app"
            className="group inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition-transform hover:-translate-y-0.5"
          >
            Open Moment
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        ) : (
          <>
            <button
              onClick={() => navigate("/auth")}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Log in
            </button>
            <button
              onClick={() => navigate("/auth?mode=sign_up")}
              className="group inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition-transform hover:-translate-y-0.5"
            >
              Sign up
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </button>
          </>
        )}
      </div>
    </motion.header>
  );
};

import { motion } from "motion/react";

const links = [
  { label: "Why Moment", href: "#why" },
  { label: "How it works", href: "#how" },
  { label: "Manifesto", href: "#manifesto" },
];

export const Nav = () => (
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

    <a
      href="#cta"
      className="group inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition-transform hover:-translate-y-0.5"
    >
      Get early access
      <span className="transition-transform group-hover:translate-x-0.5">→</span>
    </a>
  </motion.header>
);

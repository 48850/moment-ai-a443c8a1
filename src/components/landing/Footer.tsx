export const Footer = () => (
  <footer className="border-t border-border">
    <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-6 px-6 py-10 text-sm text-muted-foreground md:flex-row md:items-center md:px-10">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full gradient-spark">
          <span className="h-1.5 w-1.5 rounded-full bg-background" />
        </span>
        <span className="font-display text-foreground">Moment</span>
        <span className="font-mono text-[10px] uppercase tracking-wider">/ai · 2026</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <a href="#" className="hover:text-foreground">Privacy</a>
        <a href="#" className="hover:text-foreground">Terms</a>
        <a href="#" className="hover:text-foreground">Contact</a>
        <a href="#" className="hover:text-foreground">Twitter</a>
      </div>
      <div className="font-mono text-xs">One goal. One plan. One move.</div>
    </div>
  </footer>
);

import { motion } from "motion/react";
import type { StarNode, StarTone } from "./ConstellationGraph";

const TONE_DOT: Record<StarTone, string> = {
  bright: "bg-blue-200 shadow-[0_0_18px_2px_rgba(191,219,254,0.55)]",
  warm: "bg-white shadow-[0_0_18px_2px_rgba(255,255,255,0.45)]",
  amber: "bg-amber-300 shadow-[0_0_22px_3px_rgba(252,211,77,0.55)]",
  emerald: "bg-emerald-300 shadow-[0_0_18px_2px_rgba(110,231,183,0.5)]",
  violet: "bg-violet-300 shadow-[0_0_18px_2px_rgba(196,181,253,0.5)]",
  rose: "bg-rose-300 shadow-[0_0_18px_2px_rgba(253,164,175,0.5)]",
  dim: "bg-white/35",
};

interface Props {
  nodes: StarNode[];
  focusedId: string | null;
  onFocusChange: (id: string | null) => void;
  hudLabel?: string;
  hudMeta?: string;
}

export function LinearConstellation({ nodes, focusedId, onFocusChange, hudLabel, hudMeta }: Props) {
  if (nodes.length === 0) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-slate-950 via-indigo-950/70 to-slate-900 p-5">
      {(hudLabel || hudMeta) && (
        <div className="mb-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
          <span>{hudLabel}</span>
          <span>{hudMeta}</span>
        </div>
      )}

      <ol className="relative flex flex-col gap-3">
        {/* spine line */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-white/5 via-white/20 to-white/5"
        />

        {nodes.map((n, i) => {
          const isActive = focusedId === n.id;
          const isFocus = n.isFocus;
          return (
            <li key={n.id} className="relative">
              <button
                type="button"
                onClick={() => onFocusChange(isActive ? null : n.id)}
                className={`group flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                  isActive
                    ? "border-amber-300/40 bg-white/[0.06]"
                    : "border-transparent hover:border-white/10 hover:bg-white/[0.03]"
                }`}
              >
                <span className="relative mt-1 flex h-[14px] w-[14px] shrink-0 items-center justify-center">
                  <motion.span
                    initial={false}
                    animate={isFocus ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                    transition={isFocus ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
                    className={`block h-2 w-2 rounded-full ${n.isLocked ? TONE_DOT.dim : TONE_DOT[n.tone ?? "bright"]}`}
                  />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className={`truncate text-sm leading-snug ${n.isLocked ? "text-white/45" : "text-white/90"}`}>
                      {n.title}
                    </span>
                    {isFocus && (
                      <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-amber-200/80">now</span>
                    )}
                  </div>
                  {(n.subtitle || n.meta) && (
                    <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">
                      {n.subtitle && <span>{n.subtitle}</span>}
                      {n.subtitle && n.meta && <span>·</span>}
                      {n.meta && <span className="truncate">{n.meta}</span>}
                    </div>
                  )}
                  {isActive && n.panelBody && (
                    <p className="mt-2 text-xs leading-relaxed text-white/70">{n.panelBody}</p>
                  )}
                </div>

                <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-white/30">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

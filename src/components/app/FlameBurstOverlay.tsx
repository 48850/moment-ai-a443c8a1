import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Flame } from "lucide-react";

/**
 * Fullscreen flame burst overlay. Mounts once in AppShell and listens to the
 * global `streak:burst` window event — so completing a task anywhere in the
 * app triggers the same celebratory animation.
 */
export function FlameBurstOverlay() {
  const [burst, setBurst] = useState<number>(0);

  useEffect(() => {
    const onBurst = () => setBurst((b) => b + 1);
    window.addEventListener("streak:burst", onBurst);
    return () => window.removeEventListener("streak:burst", onBurst);
  }, []);

  useEffect(() => {
    if (burst === 0) return;
    const t = setTimeout(() => setBurst(0), 1600);
    return () => clearTimeout(t);
  }, [burst]);

  if (typeof document === "undefined" || burst === 0) return null;

  const sparks = Array.from({ length: 14 });

  return createPortal(
    <div
      key={burst}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
    >
      {/* Soft radial glow */}
      <div className="absolute inset-0 animate-[fb-glow_1.5s_ease-out_forwards] bg-[radial-gradient(circle_at_center,rgba(251,146,60,0.28),transparent_55%)]" />

      {/* Central flame */}
      <div className="relative animate-[fb-flame_1.4s_cubic-bezier(0.2,0.7,0.2,1)_forwards]">
        <div className="absolute inset-0 -z-10 rounded-full bg-orange-500/40 blur-2xl" />
        <Flame
          className="h-32 w-32 text-orange-400 drop-shadow-[0_0_30px_rgba(251,146,60,0.9)]"
          fill="currentColor"
          strokeWidth={1.5}
        />
      </div>

      {/* Radial sparks */}
      {sparks.map((_, i) => {
        const angle = (i / sparks.length) * Math.PI * 2;
        const dx = Math.cos(angle) * 260;
        const dy = Math.sin(angle) * 260;
        return (
          <span
            key={i}
            className="absolute h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_8px_2px_rgba(252,211,77,0.8)] animate-[fb-spark_1.3s_ease-out_forwards]"
            style={{
              ["--dx" as string]: `${dx}px`,
              ["--dy" as string]: `${dy}px`,
              animationDelay: `${i * 25}ms`,
            }}
          />
        );
      })}

      <style>{`
        @keyframes fb-flame {
          0%   { transform: scale(0.2) rotate(-20deg); opacity: 0; }
          25%  { transform: scale(1.4) rotate(8deg);  opacity: 1; }
          55%  { transform: scale(1.05) rotate(-3deg); opacity: 1; }
          100% { transform: scale(1.4) rotate(0);     opacity: 0; }
        }
        @keyframes fb-glow {
          0%   { opacity: 0; }
          25%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes fb-spark {
          0%   { opacity: 0; transform: translate(0,0) scale(0.4); }
          15%  { opacity: 1; transform: translate(calc(var(--dx) * 0.15), calc(var(--dy) * 0.15)) scale(1.1); }
          100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(0.2); }
        }
      `}</style>
    </div>,
    document.body,
  );
}

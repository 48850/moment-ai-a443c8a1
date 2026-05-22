import { useEffect, useRef } from "react";

/**
 * Shared animated deep-space starfield. Renders twinkling stars, faint nebula
 * gradient, and occasional shooting stars onto a transparent canvas that fills
 * its parent (which should be relatively positioned with a dark background).
 */
export function Starfield({
  density = 2200,
  showShootingStars = true,
  nebulaHue = "indigo",
}: {
  density?: number; // lower = more stars
  showShootingStars?: boolean;
  nebulaHue?: "indigo" | "violet" | "teal";
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let stars: { x: number; y: number; r: number; a: number; s: number; tw: number; hue: number }[] = [];
    let shooting: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
    let w = 0, h = 0;

    const nebulaStops: Record<string, [string, string]> = {
      indigo: ["rgba(99,102,241,0.14)", "rgba(168,85,247,0.05)"],
      violet: ["rgba(168,85,247,0.16)", "rgba(99,102,241,0.05)"],
      teal:   ["rgba(45,212,168,0.12)", "rgba(99,102,241,0.05)"],
    };
    const [stop0, stop1] = nebulaStops[nebulaHue];

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.floor((w * h) / density);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.2,
        a: Math.random() * 0.8 + 0.2,
        s: Math.random() * 0.025 + 0.005,
        tw: Math.random() * Math.PI * 2,
        // hue: mostly white, occasional blue-white or warm
        hue: Math.random(),
      }));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      // Soft nebula
      const g = ctx.createRadialGradient(w * 0.7, h * 0.25, 0, w * 0.7, h * 0.25, Math.max(w, h) * 0.75);
      g.addColorStop(0, stop0);
      g.addColorStop(0.55, stop1);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

      for (const st of stars) {
        st.tw += st.s;
        const alpha = st.a * (0.55 + 0.45 * Math.sin(st.tw));
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        // Tint a few stars cool/warm for richness
        if (st.hue > 0.92) ctx.fillStyle = `rgba(255,220,170,${alpha})`;
        else if (st.hue > 0.78) ctx.fillStyle = `rgba(180,210,255,${alpha})`;
        else ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fill();
      }

      if (showShootingStars) {
        if (!shooting && Math.random() < 0.0028) {
          shooting = {
            x: Math.random() * w * 0.5,
            y: Math.random() * h * 0.5,
            vx: 6 + Math.random() * 4,
            vy: 2 + Math.random() * 2,
            life: 1,
          };
        }
        if (shooting) {
          const s = shooting;
          const tailX = s.x - s.vx * 12;
          const tailY = s.y - s.vy * 12;
          const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
          grad.addColorStop(0, "rgba(255,255,255,0)");
          grad.addColorStop(1, `rgba(255,255,255,${s.life})`);
          ctx.strokeStyle = grad; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(s.x, s.y); ctx.stroke();
          s.x += s.vx; s.y += s.vy; s.life -= 0.012;
          if (s.life <= 0 || s.x > w || s.y > h) shooting = null;
        }
      }

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [density, showShootingStars, nebulaHue]);

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" />;
}

/** Deep-space background gradient used by every constellation surface. */
export const DEEP_SPACE_BG =
  "radial-gradient(ellipse at 28% 18%, #1a1d3d 0%, #0a0e24 48%, #03051a 100%)";

/** Standardized HUD header for constellation panels. */
export function ConstellationHud({
  label,
  meta,
}: {
  label: string;
  meta?: React.ReactNode;
}) {
  return (
    <div className="relative z-10 flex items-center justify-between border-b border-white/10 bg-black/30 px-4 py-2 backdrop-blur">
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">
        {label}
      </span>
      {meta && (
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
          {meta}
        </span>
      )}
    </div>
  );
}

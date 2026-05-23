import { motion } from "motion/react";
import moteImg from "@/assets/mote-mascot.png";
import { cn } from "@/lib/utils";

export type MoteMood = "calm" | "focused" | "celebrate" | "repair" | "overloaded";

interface Props {
  size?: number;
  mood?: MoteMood;
  className?: string;
  /** Floats gently up and down. Defaults to true. */
  float?: boolean;
  /** Show the soft amber halo behind Mote. Defaults to true. */
  halo?: boolean;
  /** Lively bounce — bigger, springier vertical motion. */
  bounce?: boolean;
  alt?: string;
}

const MOOD_TILT: Record<MoteMood, number> = {
  calm: 0,
  focused: -4,
  celebrate: 8,
  repair: -8,
  overloaded: 0,
};

export function Mote({
  size = 48,
  mood = "calm",
  className,
  float = true,
  halo = true,
  bounce = false,
  alt = "Mote, your guide",
}: Props) {
  const tilt = MOOD_TILT[mood];
  const animateProps = bounce
    ? { y: [0, -10, 0, -4, 0], rotate: [tilt - 4, tilt + 4, tilt - 4] }
    : float
      ? mood === "overloaded"
        ? { y: [0, -1, 1, -1, 0], rotate: [tilt, tilt - 2, tilt + 2, tilt] }
        : { y: [0, -4, 0] }
      : undefined;
  const duration = bounce ? 1.6 : mood === "celebrate" ? 1.4 : mood === "overloaded" ? 0.6 : 3.6;
  return (
    <div
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {halo && (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(253,224,138,0.55) 0%, rgba(251,191,36,0.18) 45%, rgba(168,85,247,0) 75%)",
            filter: "blur(8px)",
          }}
          animate={{ opacity: [0.7, 1, 0.7], scale: [1, 1.08, 1] }}
          transition={{ duration: mood === "celebrate" ? 1.6 : 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <motion.img
        src={moteImg}
        alt={alt}
        loading="lazy"
        width={size}
        height={size}
        draggable={false}
        className="relative select-none"
        style={{ width: size, height: size, rotate: `${tilt}deg` }}
        animate={animateProps}
        transition={{
          duration,
          repeat: Infinity,
          ease: bounce ? [0.34, 1.56, 0.64, 1] : "easeInOut",
        }}
      />
    </div>
  );
}

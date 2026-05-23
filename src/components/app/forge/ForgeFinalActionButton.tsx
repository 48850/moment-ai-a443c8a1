import { motion } from "motion/react";
import type { ForgeFinalAction } from "@/lib/types/forge-episode";

interface Props {
  finalAction: ForgeFinalAction;
  onAction: () => void;
}

export function ForgeFinalActionButton({ finalAction, onAction }: Props) {
  return (
    <motion.button
      initial={{ scale: 0.92, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 18 }}
      onClick={onAction}
      className="w-full rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black shadow-lg transition hover:bg-white/90 active:scale-95"
    >
      {finalAction.label}
    </motion.button>
  );
}

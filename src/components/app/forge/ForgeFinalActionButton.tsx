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
      className="w-full rounded-lg bg-background px-5 py-3 text-sm font-semibold text-foreground shadow-soft transition hover:bg-background/90 active:scale-95"
    >
      {finalAction.label}
    </motion.button>
  );
}

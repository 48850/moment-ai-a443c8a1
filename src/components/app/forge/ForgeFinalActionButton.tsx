import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import type { ForgeFinalAction } from "@/lib/types/forge-episode";

export function ForgeFinalActionButton({
  action,
  onAction,
}: {
  action: ForgeFinalAction;
  onAction: (a: ForgeFinalAction) => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      onClick={() => onAction(action)}
      className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black shadow-lg hover:bg-white/90 active:scale-95 transition-transform"
    >
      {action.label}
      <ArrowRight className="h-4 w-4 shrink-0" />
    </motion.button>
  );
}

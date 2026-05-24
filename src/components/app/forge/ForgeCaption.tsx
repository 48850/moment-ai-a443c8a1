import { AnimatePresence, motion } from "motion/react";

interface Props {
  text: string | undefined;
}

export function ForgeCaption({ text }: Props) {
  return (
    <div className="min-h-[3rem] px-4">
      <AnimatePresence mode="wait">
        {text && (
          <motion.p
            key={text}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25, delay: 0.08 }}
            className="text-center text-sm font-medium leading-snug text-white/90"
          >
            {text}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

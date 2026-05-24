import { AnimatePresence, motion } from "motion/react";

interface Props {
  text: string | undefined;
}

export function ForgeCaption({ text }: Props) {
  return (
    <div className="min-h-[3rem] px-4 sm:px-8">
      <AnimatePresence mode="wait">
        {text && (
          <motion.p
            key={text}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25, delay: 0.08 }}
            className="mx-auto max-w-3xl rounded-lg border border-background/15 bg-foreground/60 px-4 py-3 text-center text-sm font-medium leading-snug text-background/90 shadow-soft backdrop-blur sm:text-base"
          >
            {text}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

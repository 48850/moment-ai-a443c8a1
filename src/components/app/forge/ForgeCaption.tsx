import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

export function ForgeCaption({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, [text]);

  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          key={text}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="px-4 py-2 text-center"
        >
          <p className="text-sm font-semibold leading-snug tracking-tight text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
            {text}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

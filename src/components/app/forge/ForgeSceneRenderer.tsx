import { motion, AnimatePresence } from "motion/react";
import type { ForgeScene } from "@/lib/types/forge-episode";
import { ForgeCharacterSprite } from "./ForgeCharacterSprite";
import { ForgeCaption } from "./ForgeCaption";

const TRANSITION_VARIANTS = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    duration: 0.4,
  },
  zoom: {
    initial: { opacity: 0, scale: 1.08 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.94 },
    duration: 0.35,
  },
  smash_cut: {
    initial: { opacity: 1 },
    animate: { opacity: 1 },
    exit: { opacity: 1 },
    duration: 0,
  },
  cut: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    duration: 0.1,
  },
  swipe: {
    initial: { opacity: 0, x: 40 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 },
    duration: 0.25,
  },
  glitch: {
    initial: { opacity: 0, filter: "blur(4px)" },
    animate: { opacity: 1, filter: "blur(0px)" },
    exit: { opacity: 0, filter: "blur(4px)" },
    duration: 0.2,
  },
};

export function ForgeSceneRenderer({
  scene,
  sceneIndex,
  elapsed,
}: {
  scene: ForgeScene;
  sceneIndex: number;
  elapsed: number; // seconds elapsed within this scene
}) {
  const transitionKey = scene.transition ?? "fade";
  const tv = TRANSITION_VARIANTS[transitionKey as keyof typeof TRANSITION_VARIANTS] ?? TRANSITION_VARIANTS.fade;

  // Determine which action is currently active based on elapsed time
  const progress = elapsed / scene.durationSeconds;
  const activeActions = scene.actions.filter((a) => {
    if (a.timing === "start") return progress < 0.4;
    if (a.timing === "middle") return progress >= 0.3 && progress < 0.75;
    if (a.timing === "end") return progress >= 0.65;
    return false;
  });

  const actionByCharacter: Record<string, (typeof scene.actions)[0]> = {};
  for (const a of activeActions) {
    actionByCharacter[a.actorId] = a;
  }

  // Find the most prominent speaking action for dialogue display
  const speakingAction = activeActions.find((a) => a.text);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${sceneIndex}-${scene.id}`}
        initial={tv.initial as Record<string, number | string>}
        animate={tv.animate as Record<string, number | string>}
        exit={tv.exit as Record<string, number | string>}
        transition={{ duration: tv.duration, ease: "easeInOut" }}
        className="absolute inset-0 flex flex-col"
      >
        {/* Setting label */}
        <div className="px-4 pt-10 pb-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/30">
            {scene.setting}
          </p>
        </div>

        {/* Character stage */}
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="relative flex items-end justify-center gap-6 flex-wrap">
            {scene.characters.map((char) => (
              <div key={char.id} className="relative">
                <ForgeCharacterSprite
                  character={char}
                  activeAction={
                    speakingAction?.actorId === char.id ? speakingAction : actionByCharacter[char.id]
                  }
                />
              </div>
            ))}
          </div>
        </div>

        {/* Sound cue badge */}
        {scene.soundCue && (
          <div className="px-4 pb-1">
            <span className="inline-block rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/30 border border-white/10">
              ♪ {scene.soundCue}
            </span>
          </div>
        )}

        {/* Caption */}
        {scene.caption && <ForgeCaption text={scene.caption} />}
      </motion.div>
    </AnimatePresence>
  );
}

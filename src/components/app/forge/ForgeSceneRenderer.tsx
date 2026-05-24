import { AnimatePresence, motion } from "motion/react";
import type { MotionProps } from "motion/react";
import type { ForgeScene, ForgeSceneTransition } from "@/lib/types/forge-episode";
import { ForgeCharacterSprite } from "./ForgeCharacterSprite";
import { ForgeCaption } from "./ForgeCaption";

const TRANSITION_VARIANTS: Record<
  ForgeSceneTransition,
  Pick<MotionProps, "initial" | "animate" | "exit" | "transition">
> = {
  fade:       { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.4 } },
  zoom:       { initial: { opacity: 0, scale: 0.88 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 1.08 }, transition: { duration: 0.35 } },
  smash_cut:  { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 }, transition: { duration: 0 } },
  cut:        { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 }, transition: { duration: 0.05 } },
  swipe:      { initial: { x: "100%" }, animate: { x: 0 }, exit: { x: "-100%" }, transition: { duration: 0.3 } },
  glitch:     { initial: { opacity: 0, x: 8 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -8 }, transition: { duration: 0.2 } },
};

const BG_STYLES: Record<string, string> = {
  courtroom: "from-foreground via-foreground to-muted-foreground",
  news_studio: "from-foreground via-primary to-foreground",
  lair: "from-foreground via-destructive to-foreground",
  mission_control: "from-foreground via-primary to-foreground",
  roast_stage: "from-foreground via-accent to-foreground",
  default: "from-foreground via-muted-foreground to-foreground",
};

function bgForSetting(setting: string): string {
  for (const [key, val] of Object.entries(BG_STYLES)) {
    if (setting.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return BG_STYLES.default;
}

interface Props {
  scene: ForgeScene;
  elapsed: number; // seconds elapsed in this scene
  sceneIndex: number;
}

export function ForgeSceneRenderer({ scene, elapsed, sceneIndex }: Props) {
  const progress = Math.min(1, elapsed / scene.durationSeconds);
  const variant = TRANSITION_VARIANTS[scene.transition ?? "fade"];
  const bg = bgForSetting(scene.setting);
  const activeCaption = scene.voiceover || scene.caption;

  // Determine active actions by timing bucket
  const activeActions = scene.actions.filter((a) => {
    if (a.timing === "start") return progress < 0.45;
    if (a.timing === "middle") return progress >= 0.3 && progress < 0.75;
    if (a.timing === "end") return progress >= 0.65;
    return false;
  });

  const actionMap = Object.fromEntries(activeActions.map((a) => [a.actorId, a]));

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={sceneIndex}
        initial={variant.initial}
        animate={variant.animate}
        exit={variant.exit}
        transition={variant.transition ?? { duration: 0.3 }}
        className={`absolute inset-0 flex flex-col bg-gradient-to-br ${bg}`}
      >
        <div className="pointer-events-none absolute inset-0 opacity-25 ring-grid" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-foreground/80 to-transparent" />

        <div className="relative z-10 flex flex-1 flex-col gap-6 px-5 pb-28 pt-16 sm:px-8 sm:pb-32 lg:px-12">
          <div className="flex items-center justify-between gap-4 text-[10px] font-mono uppercase tracking-[0.18em] text-background/50">
            <span>{scene.setting.replace(/_/g, " ")}</span>
            {scene.soundCue && <span className="hidden text-right sm:block">{scene.soundCue}</span>}
          </div>

          <div className="grid flex-1 items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,420px)]">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 }}
              className="min-w-0 space-y-5"
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-background/45">
                Scene {sceneIndex + 1}
              </p>
              <h2 className="max-w-4xl text-balance font-display text-4xl font-medium leading-[0.95] text-background sm:text-6xl lg:text-7xl">
                {activeCaption}
              </h2>
              {scene.visualStyle && (
                <p className="max-w-2xl text-sm leading-relaxed text-background/60 sm:text-base">
                  {scene.visualStyle}
                </p>
              )}
            </motion.div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {scene.characters.map((char) => {
                const act = actionMap[char.id];
                return (
                  <ForgeCharacterSprite
                    key={char.id}
                    character={char}
                    activeAction={act?.action}
                    speechText={act?.text}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Caption */}
        <div className="absolute inset-x-0 bottom-3 z-20 sm:bottom-4">
          <ForgeCaption text={scene.caption} />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

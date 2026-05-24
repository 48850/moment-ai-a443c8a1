import { AnimatePresence, motion } from "motion/react";
import type { ForgeScene, ForgeSceneTransition } from "@/lib/types/forge-episode";
import { ForgeCharacterSprite } from "./ForgeCharacterSprite";
import { ForgeCaption } from "./ForgeCaption";

const TRANSITION_VARIANTS: Record<
  ForgeSceneTransition,
  { initial: any; animate: any; exit: any; transition?: any }
> = {
  fade:       { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.4 } },
  zoom:       { initial: { opacity: 0, scale: 0.88 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 1.08 }, transition: { duration: 0.35 } },
  smash_cut:  { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 }, transition: { duration: 0 } },
  cut:        { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 }, transition: { duration: 0.05 } },
  swipe:      { initial: { x: "100%" }, animate: { x: 0 }, exit: { x: "-100%" }, transition: { duration: 0.3 } },
  glitch:     { initial: { opacity: 0, x: 8 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -8 }, transition: { duration: 0.2 } },
};

const BG_STYLES: Record<string, string> = {
  courtroom:    "from-slate-900 via-slate-800 to-slate-900",
  news_studio:  "from-blue-950 via-blue-900 to-slate-900",
  lair:         "from-red-950 via-zinc-900 to-black",
  mission_control: "from-zinc-900 via-indigo-950 to-black",
  roast_stage:  "from-amber-950 via-zinc-900 to-black",
  default:      "from-zinc-900 via-zinc-800 to-zinc-900",
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
        className={`absolute inset-0 flex flex-col bg-gradient-to-b ${bg}`}
      >
        {/* Setting label */}
        <div className="px-4 pt-3 text-[9px] font-mono uppercase tracking-[0.2em] text-white/30">
          {scene.setting.replace(/_/g, " ")}
        </div>

        {/* Characters */}
        <div className="flex flex-1 items-center justify-center gap-6 px-4">
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

        {/* Caption */}
        <div className="pb-3">
          <ForgeCaption text={scene.caption} />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

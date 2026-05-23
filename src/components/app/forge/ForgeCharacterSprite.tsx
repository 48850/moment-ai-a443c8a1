import { Scale, FileText, Sparkles, User, Skull, Monitor, Star } from "lucide-react";
import type { ForgeCharacter, ForgeCharacterRole, ForgeCharacterAction } from "@/lib/types/forge-episode";

const ROLE_VISUALS: Record<
  ForgeCharacterRole,
  { icon: React.ComponentType<{ className?: string }>; bg: string; border: string }
> = {
  judge:              { icon: Scale,     bg: "bg-slate-800",  border: "border-slate-500" },
  task:               { icon: FileText,  bg: "bg-zinc-800",   border: "border-zinc-500" },
  moment_ai:          { icon: Sparkles,  bg: "bg-indigo-900", border: "border-indigo-400" },
  future_self:        { icon: User,      bg: "bg-amber-900",  border: "border-amber-400" },
  villain:            { icon: Skull,     bg: "bg-red-950",    border: "border-red-500" },
  news_anchor:        { icon: Monitor,   bg: "bg-blue-900",   border: "border-blue-400" },
  constellation_node: { icon: Star,      bg: "bg-violet-900", border: "border-violet-400" },
  user_proxy:         { icon: User,      bg: "bg-stone-800",  border: "border-stone-500" },
};

const ACTION_CLASSES: Partial<Record<ForgeCharacterAction, string>> = {
  shake:          "animate-forge-shake",
  panic:          "animate-forge-panic",
  float:          "animate-forge-float",
  dramatic_turn:  "animate-forge-turn",
  collapse:       "animate-forge-collapse",
  look_at_camera: "animate-forge-zoom",
  point:          "animate-forge-point",
  enter:          "animate-forge-enter",
  react:          "animate-forge-react",
};

interface Props {
  character: ForgeCharacter;
  activeAction?: ForgeCharacterAction;
  speechText?: string;
}

export function ForgeCharacterSprite({ character, activeAction, speechText }: Props) {
  const visual = ROLE_VISUALS[character.role] ?? ROLE_VISUALS.user_proxy;
  const Icon = visual.icon;
  const animClass = (activeAction && ACTION_CLASSES[activeAction]) ?? "";
  const isAI = character.role === "moment_ai";

  return (
    <div className="relative flex flex-col items-center gap-1">
      {/* Speech bubble */}
      {speechText && (
        <div className="absolute -top-9 left-1/2 -translate-x-1/2 z-10 max-w-[140px] whitespace-nowrap rounded-lg bg-white/90 px-2 py-1 text-[10px] font-medium text-black shadow-md">
          {speechText}
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-white/90">▼</span>
        </div>
      )}

      {/* Character circle */}
      <div
        className={[
          "relative flex h-16 w-16 items-center justify-center rounded-full border-2",
          visual.bg,
          visual.border,
          animClass,
          isAI ? "shadow-[0_0_24px_rgba(129,140,248,0.7)]" : "",
        ].join(" ")}
      >
        {isAI && (
          <span className="absolute inset-0 animate-ping rounded-full border border-indigo-400/40" />
        )}
        <Icon className="h-7 w-7 text-white/80" />
      </div>

      {/* Name tag */}
      <span className="max-w-[80px] truncate text-center text-[9px] font-medium text-white/50">
        {character.name}
      </span>
    </div>
  );
}

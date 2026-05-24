import { Scale, FileText, Sparkles, User, Skull, Monitor, Star } from "lucide-react";
import type { ForgeCharacter, ForgeCharacterRole, ForgeCharacterAction } from "@/lib/types/forge-episode";

const ROLE_VISUALS: Record<
  ForgeCharacterRole,
  { icon: React.ComponentType<{ className?: string }>; bg: string; border: string; eyebrow: string }
> = {
  judge:              { icon: Scale,     bg: "bg-background/10", border: "border-background/30", eyebrow: "verdict" },
  task:               { icon: FileText,  bg: "bg-background/10", border: "border-background/25", eyebrow: "task" },
  moment_ai:          { icon: Sparkles,  bg: "bg-primary/30",    border: "border-primary-glow/60", eyebrow: "moment" },
  future_self:        { icon: User,      bg: "bg-accent/25",     border: "border-accent/60", eyebrow: "future" },
  villain:            { icon: Skull,     bg: "bg-destructive/25", border: "border-destructive/60", eyebrow: "friction" },
  news_anchor:        { icon: Monitor,   bg: "bg-primary/25",    border: "border-primary-glow/50", eyebrow: "signal" },
  constellation_node: { icon: Star,      bg: "bg-primary/25",    border: "border-primary-glow/50", eyebrow: "node" },
  user_proxy:         { icon: User,      bg: "bg-background/10", border: "border-background/25", eyebrow: "you" },
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
    <div className="relative min-w-0 rounded-lg border border-background/15 bg-background/10 p-3 shadow-soft backdrop-blur sm:p-4">
      {/* Speech bubble */}
      {speechText && (
        <div className="absolute -top-3 left-4 right-4 z-10 rounded-md bg-background px-2 py-1 text-[10px] font-medium leading-snug text-foreground shadow-soft sm:-top-4">
          {speechText}
        </div>
      )}

      <div className="flex min-w-0 items-center gap-3">
        <div
          className={[
            "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border sm:h-16 sm:w-16",
            visual.bg,
            visual.border,
            animClass,
            isAI ? "shadow-elevated" : "",
          ].join(" ")}
        >
          {isAI && <span className="absolute inset-0 animate-ping rounded-lg border border-primary-glow/40" />}
          <Icon className="h-6 w-6 text-background/85 sm:h-7 sm:w-7" />
        </div>

        <div className="min-w-0 pt-1">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-background/45">
            {visual.eyebrow}
          </p>
          <p className="whitespace-normal break-words text-sm font-semibold leading-tight text-background sm:text-base">
            {character.name}
          </p>
        </div>
      </div>
    </div>
  );
}

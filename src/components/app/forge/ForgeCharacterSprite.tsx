import type { ForgeCharacter, ForgeSceneAction } from "@/lib/types/forge-episode";

const ROLE_VISUALS: Record<ForgeCharacter["role"], { icon: string; bg: string; border: string }> = {
  judge: { icon: "⚖️", bg: "bg-slate-800", border: "border-amber-500/60" },
  task: { icon: "📄", bg: "bg-zinc-700", border: "border-zinc-400/40" },
  moment_ai: { icon: "✦", bg: "bg-indigo-950", border: "border-indigo-400/70" },
  future_self: { icon: "◈", bg: "bg-amber-950", border: "border-amber-400/60" },
  villain: { icon: "⬛", bg: "bg-red-950", border: "border-red-500/50" },
  news_anchor: { icon: "📺", bg: "bg-blue-900", border: "border-blue-400/50" },
  user_proxy: { icon: "◎", bg: "bg-teal-900", border: "border-teal-400/50" },
  constellation_node: { icon: "★", bg: "bg-purple-950", border: "border-purple-400/60" },
};

const ACTION_CLASSES: Record<ForgeSceneAction["action"], string> = {
  shake: "animate-forge-shake",
  panic: "animate-forge-panic",
  float: "animate-forge-float",
  dramatic_turn: "animate-forge-turn",
  collapse: "animate-forge-collapse",
  look_at_camera: "animate-forge-zoom",
  point: "animate-forge-point",
  freeze: "animate-forge-freeze",
  enter: "animate-forge-enter",
  walk: "animate-forge-walk",
  react: "animate-forge-react",
};

export function ForgeCharacterSprite({
  character,
  activeAction,
}: {
  character: ForgeCharacter;
  activeAction?: ForgeSceneAction;
}) {
  const visual = ROLE_VISUALS[character.role] ?? ROLE_VISUALS.task;
  const animClass = activeAction ? (ACTION_CLASSES[activeAction.action] ?? "") : "";

  const isMomentAI = character.role === "moment_ai";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={[
          "relative flex items-center justify-center rounded-full border-2 transition-all",
          "w-16 h-16",
          visual.bg,
          visual.border,
          animClass,
          isMomentAI ? "shadow-[0_0_18px_3px_rgba(99,102,241,0.5)]" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* Expression dot */}
        {character.expression === "haunted" || character.expression === "tired" ? (
          <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-amber-400 border border-amber-200 text-[7px] flex items-center justify-center">😰</div>
        ) : null}
        {character.expression === "unimpressed" ? (
          <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-slate-400 border border-slate-200 text-[7px] flex items-center justify-center">😑</div>
        ) : null}
        {character.expression === "menacing" || character.expression === "triumphant" ? (
          <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 border border-red-200 text-[7px] flex items-center justify-center">😈</div>
        ) : null}

        <span
          className={[
            "select-none leading-none",
            isMomentAI ? "text-3xl text-indigo-300" : "text-2xl",
          ].join(" ")}
        >
          {visual.icon}
        </span>

        {/* Pulse ring for moment_ai */}
        {isMomentAI && (
          <span className="absolute inset-0 rounded-full border border-indigo-400/30 animate-ping opacity-30" />
        )}
      </div>

      <span className="text-[10px] text-white/60 text-center max-w-[80px] leading-tight truncate">
        {character.name}
      </span>

      {activeAction?.text && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[160px] rounded-lg bg-black/80 px-2.5 py-1.5 text-[11px] text-white/90 text-center leading-snug border border-white/10">
          {activeAction.text}
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-black/80" />
        </div>
      )}
    </div>
  );
}

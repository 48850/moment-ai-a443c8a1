/**
 * TrialBrief — shown before a Forge guidebook launches.
 *
 * Sets expectations: what you're proving, what happens after,
 * and confirms that an attempt is required before results appear.
 */
import { Target, Zap, ChevronRight } from "lucide-react";
import type { ForgeGuidebook } from "@/lib/types";

interface TrialBriefProps {
  guidebook: ForgeGuidebook;
  onBeginTrial: () => void;
  onCancel?: () => void;
}

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  drill_lab: "Proof Drill",
  proof_builder: "Pressure Test",
  decision_engine: "Answer Upgrade",
  coach_lens: "Oral Trial",
  research_helper: "Resource Forge",
  protocol: "Lock-In Review",
  simulator: "Skill Simulation",
  control_room: "Skill Simulation",
  planner: "Proof Drill",
  tracker: "Lock-In Review",
  custom: "Proof Drill",
};

export function TrialBrief({ guidebook, onBeginTrial, onCancel }: TrialBriefProps) {
  const toolName = TOOL_DISPLAY_NAMES[guidebook.feature_type] ?? "Proof Drill";
  const resources = guidebook.required_inputs.map((i) => i.label ?? i.id).filter(Boolean);

  return (
    <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-indigo-500/15 flex items-center justify-center">
          <Target className="w-4 h-4 text-indigo-400" />
        </div>
        <div>
          <p className="text-xs text-indigo-400/70 uppercase tracking-wider">Trial Brief</p>
          <p className="text-sm font-semibold text-white/90">{toolName}</p>
        </div>
      </div>

      {/* Brief rows */}
      <div className="space-y-3">
        <BriefRow label="Proof target" value={guidebook.purpose} />
        {guidebook.bottleneck_addressed && (
          <BriefRow label="Weakness hypothesis" value={guidebook.bottleneck_addressed} />
        )}
        {resources.length > 0 && (
          <BriefRow label="Resources needed" value={resources.join(", ")} />
        )}
        <BriefRow label="Attempt required" value="Yes — you will need to try before results appear" />
      </div>

      {/* After section */}
      <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
        <p className="text-xs text-white/40 mb-1.5">After this Trial</p>
        <ul className="space-y-1">
          <li className="text-sm text-white/60 flex items-start gap-2">
            <Zap className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
            Weak points become repair cards
          </li>
          <li className="text-sm text-white/60 flex items-start gap-2">
            <Zap className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
            Completed work becomes Portfolio proof
          </li>
        </ul>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onBeginTrial}
          className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 text-sm font-medium transition-colors"
        >
          Begin Trial
          <ChevronRight className="w-4 h-4" />
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-3 rounded-xl border border-white/10 text-white/50 hover:text-white/70 text-sm transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

function BriefRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-xs text-white/40 w-36 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-white/80 leading-snug">{value}</span>
    </div>
  );
}

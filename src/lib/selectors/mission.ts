import type {
  MomentState,
  PursuitWorkstream,
  CapabilityCluster,
  EvidenceSignal,
  OperatingMode,
  PursuitRisk,
  PursuitStandard,
} from "@/lib/types";

export interface MissionViewModel {
  goal: {
    statement: string;
    whyItMatters: string;
    longTerm: string;
    mediumTerm: string;
    shortTerm: string;
  };
  activeOperatingMode: OperatingMode | null;
  workstreams: PursuitWorkstream[];
  capabilityClusters: CapabilityCluster[];
  evidenceSignals: EvidenceSignal[];
  risks: PursuitRisk[];
  standards: PursuitStandard[];
  hasModel: boolean;
}

function horizonFromState(state: MomentState, key: "long" | "medium" | "short") {
  const answers = state.onboarding?.answers ?? {};
  const answerKey = key === "long" ? "long_term_goal" : key === "medium" ? "medium_term_goal" : "short_term_goal";
  const direct = answers[answerKey];
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const source = [state.active_goal?.statement, state.active_goal?.success_definition]
    .filter(Boolean)
    .join("\n");
  const label = key === "long" ? "Long-term" : key === "medium" ? "Medium-term" : "Short-term";
  const match = source.match(new RegExp(`${label}:\\s*([^\\n|·]+?)(?=\\s*\\||$)`, "i"));
  if (match?.[1]?.trim()) return match[1].trim();
  return key === "long" ? state.active_goal?.statement ?? "" : "";
}

export function selectMissionViewModel(state: MomentState): MissionViewModel {
  const pm = state.pursuit_model;
  const goal = state.active_goal;
  const goalView = {
    statement: goal?.statement ?? "",
    whyItMatters: goal?.why_it_matters ?? "",
    longTerm: horizonFromState(state, "long"),
    mediumTerm: horizonFromState(state, "medium"),
    shortTerm: horizonFromState(state, "short"),
  };

  if (!pm) {
    return {
      goal: goalView,
      activeOperatingMode: null,
      workstreams: [],
      capabilityClusters: [],
      evidenceSignals: [],
      risks: [],
      standards: [],
      hasModel: false,
    };
  }

  const activeMode =
    pm.operating_modes.find((m) => m.id === pm.active_operating_mode_id) ?? null;

  return {
    goal: goalView,
    activeOperatingMode: activeMode,
    workstreams: pm.workstreams,
    capabilityClusters: pm.capability_clusters,
    evidenceSignals: pm.evidence_signals,
    risks: pm.risks,
    standards: pm.standards,
    hasModel: true,
  };
}

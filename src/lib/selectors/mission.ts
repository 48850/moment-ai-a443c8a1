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
  goal: { statement: string; whyItMatters: string };
  activeOperatingMode: OperatingMode | null;
  workstreams: PursuitWorkstream[];
  capabilityClusters: CapabilityCluster[];
  evidenceSignals: EvidenceSignal[];
  risks: PursuitRisk[];
  standards: PursuitStandard[];
  hasModel: boolean;
}

export function selectMissionViewModel(state: MomentState): MissionViewModel {
  const pm = state.pursuit_model;
  const goal = state.active_goal;

  if (!pm) {
    return {
      goal: { statement: goal?.statement ?? "", whyItMatters: goal?.why_it_matters ?? "" },
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
    goal: { statement: goal.statement, whyItMatters: goal.why_it_matters },
    activeOperatingMode: activeMode,
    workstreams: pm.workstreams,
    capabilityClusters: pm.capability_clusters,
    evidenceSignals: pm.evidence_signals,
    risks: pm.risks,
    standards: pm.standards,
    hasModel: true,
  };
}

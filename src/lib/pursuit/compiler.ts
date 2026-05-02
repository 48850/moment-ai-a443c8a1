import type {
  MomentState,
  CompiledPursuitModel,
  PursuitStandard,
  CapabilityCluster,
  PursuitWorkstream,
  PursuitRisk,
  EvidenceSignal,
  OperatingMode,
} from "@/lib/types";
import {
  inferPursuitFamily,
  buildFamilyTemplate,
  type FamilyTemplate,
} from "@/lib/pursuit/families";
type Goal = MomentState["active_goal"];
export function hashGoal(goal: Goal): string {
  return [(goal?.statement || "").trim(), (goal?.why_it_matters || "").trim()].join("||");
}
export function compileStandards(
  template: FamilyTemplate,
  existing?: CompiledPursuitModel | null,
  preserveEdits = false
): PursuitStandard[] {
  const existingById = buildIndex(existing?.standards);
  return template.standards.map((seed) => {
    const base: PursuitStandard = {
       id: seed.id,
       name: seed.name,
       description: seed.description,
       target_value: seed.target_value,
       current_value: "",
       trajectory: seed.trajectory,
       kind: seed.kind,
       last_checked_at: "",
       source: "compiler",
    };
    if (!preserveEdits) return base;
    const prev = existingById.get(seed.id);
    if (!prev) return base;
    return {
       ...base,
       current_value: prev.current_value || base.current_value,
       last_checked_at: prev.last_checked_at || base.last_checked_at,
       source: prev.source && prev.source !== "compiler" ? prev.source : base.source,
    };
  });
}
export function compileCapabilityClusters(
  template: FamilyTemplate,
  existing?: CompiledPursuitModel | null,
  preserveEdits = false
): CapabilityCluster[] {
  const existingById = buildIndex(existing?.capability_clusters);
  return template.capabilities.map((seed) => {
    const base: CapabilityCluster = {
       id: seed.id,
       name: seed.name,
       description: seed.description,
       status: seed.status,
       why_it_matters: seed.why_it_matters,
       source: "compiler",
    };
    if (!preserveEdits) return base;
    const prev = existingById.get(seed.id);
    if (!prev) return base;
    return {
       ...base,
       source: prev.source && prev.source !== "compiler" ? prev.source : base.source,
    };
  });
}
export function compileWorkstreams(
  template: FamilyTemplate,
  existing?: CompiledPursuitModel | null,
  preserveEdits = false
): PursuitWorkstream[] {
  const existingById = buildIndex(existing?.workstreams);
  return template.workstreams.map((seed) => {
    const base: PursuitWorkstream = {
       id: seed.id,
       name: seed.name,
       description: seed.description,
       status: seed.status,
       priority: seed.priority,
       bottleneck: seed.bottleneck,
       next_proof: seed.next_proof,
       last_updated_at: "",
       source: "compiler",
    };
    if (!preserveEdits) return base;
    const prev = existingById.get(seed.id);
    if (!prev) return base;
    const preserveUserFields = prev.source !== "compiler";
    return {
       ...base,
       bottleneck: preserveUserFields ? prev.bottleneck || base.bottleneck : base.bottleneck,
       next_proof: preserveUserFields ? prev.next_proof || base.next_proof : base.next_proof,
       last_updated_at: prev.last_updated_at || base.last_updated_at,
       source: preserveUserFields ? prev.source : base.source,
    };
  });
}
export function compileRisks(
  template: FamilyTemplate,
  existing?: CompiledPursuitModel | null,
  preserveEdits = false
): PursuitRisk[] {
  const existingById = buildIndex(existing?.risks);
  return template.risks.map((seed) => {
    const base: PursuitRisk = {
       id: seed.id,
       name: seed.name,
       description: seed.description,
       severity: seed.severity,
       mitigation: seed.mitigation,
       source: "compiler",
    };
    if (!preserveEdits) return base;
    const prev = existingById.get(seed.id);
    if (!prev) return base;
    return {
       ...base,
       source: prev.source && prev.source !== "compiler" ? prev.source : base.source,
    };
  });
}
export function compileEvidenceSignals(
  template: FamilyTemplate,
  existing?: CompiledPursuitModel | null,
  preserveEdits = false
): EvidenceSignal[] {
  const existingById = buildIndex(existing?.evidence_signals);
  return template.signals.map((seed) => {
    const base: EvidenceSignal = {
       id: seed.id,
       name: seed.name,
       kind: seed.kind,
       description: seed.description,
       cadence: seed.cadence,
       target: seed.target,
       last_value: "",
       last_checked_at: "",
       source: "compiler",
    };
    if (!preserveEdits) return base;
    const prev = existingById.get(seed.id);
    if (!prev) return base;
    return {
       ...base,
       last_value: prev.last_value || base.last_value,
       last_checked_at: prev.last_checked_at || base.last_checked_at,
       source: prev.source && prev.source !== "compiler" ? prev.source : base.source,
    };
  });
}
export function compileOperatingModes(template: FamilyTemplate): OperatingMode[] {
  return template.modes.map((seed) => ({
    id: seed.id,
    name: seed.name,
    description: seed.description,
    stance: seed.stance,
    when_to_use: seed.when_to_use,
  }));
}
export function selectDefaultActiveMode(
  modes: OperatingMode[],
  template: FamilyTemplate,
  existing?: CompiledPursuitModel | null
): string {
  const ids = new Set(modes.map((m) => m.id));
  if (existing?.active_operating_mode_id && ids.has(existing.active_operating_mode_id)) {
    return existing.active_operating_mode_id;
  }
  if (ids.has(template.defaultActiveModeId)) return template.defaultActiveModeId;
  return modes[0]?.id ?? "";
}
export function buildSummary(template: FamilyTemplate): string {
  return template.summary;
}
export function buildAssumptions(template: FamilyTemplate): string[] {
  return [...template.assumptions];
}
export function compilePursuitModel(
  goal: Goal,
  existing?: CompiledPursuitModel | null
): CompiledPursuitModel {
  const { family, confidence, matchedKeywords } = inferPursuitFamily(goal);
  const template = buildFamilyTemplate(goal, family);
  const hash = hashGoal(goal);
  const preserveEdits = existing?.compiled_from_goal_hash === hash;

  const standards = compileStandards(template, existing, preserveEdits);
  const capability_clusters = compileCapabilityClusters(template, existing, preserveEdits);
  const workstreams = compileWorkstreams(template, existing, preserveEdits);
  const risks = compileRisks(template, existing, preserveEdits);
  const evidence_signals = compileEvidenceSignals(template, existing, preserveEdits);
  const operating_modes = compileOperatingModes(template);
  const active_operating_mode_id = selectDefaultActiveMode(operating_modes, template, existing);

  return {
     pursuit_family: family,
     family_confidence: confidence,
     inferred_reasons: matchedKeywords ? matchedKeywords : [],
     summary: buildSummary(template),
     assumptions: buildAssumptions(template),
     standards,
     capability_clusters,
     workstreams,
     risks,
     evidence_signals,
     operating_modes,
     active_operating_mode_id,
     compiled_at: new Date().toISOString(),
     compiled_from_goal_hash: hash,
  };
}
// --- Internal helpers ---
function buildIndex<T extends { id?: string }>(items?: T[]): Map<string, T> {
  const map = new Map<string, T>();
  if (!items) return map;
  for (const item of items) {
    if (item.id) map.set(item.id, item);
  }
  return map;
}

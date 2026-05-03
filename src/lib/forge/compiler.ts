import type { FeatureCandidate, GeneratedModuleManifest, CompiledPursuitModel } from "@/lib/types";

export function buildInterviewQuestions(_pursuitModel: CompiledPursuitModel | null) {
  return [
    { id: "q1", question_key: "timeline_realization", question_text: "What would make this feel real in the next 3 months?" },
    { id: "q2", question_key: "current_weakness", question_text: "Where are you weakest right now?" },
    { id: "q3", question_key: "need_type", question_text: "Do you need structure, accountability, depth, or speed most?" },
    { id: "q4", question_key: "stall_trigger", question_text: "What usually causes you to stall?" },
    { id: "q5", question_key: "system_feel", question_text: "What kind of feature would feel indispensable?" },
  ];
}

export function generateFeatureCandidates(_pursuitModel: CompiledPursuitModel | null): FeatureCandidate[] {
  return [
    { id: "f1", name: "Deep Practice Loop", description: "A focused practice loop that pushes for depth over breadth.", problem_it_solves: "Surface-level progress.", leverage_score: 8, immediacy_score: 6, repeat_value_score: 9, complexity_score: 7, distinctiveness_score: 8, total_score: 38, rationale: "Depth is the main constraint.", module_type: "practice_system" },
    { id: "f2", name: "Deadline Compressor", description: "A weekly planner that forces tighter execution windows.", problem_it_solves: "Work expanding to fill time.", leverage_score: 9, immediacy_score: 9, repeat_value_score: 8, complexity_score: 5, distinctiveness_score: 6, total_score: 37, rationale: "Speed matters most early.", module_type: "planner" },
    { id: "f3", name: "Signal Tracker", description: "Track real progress signals.", problem_it_solves: "Building blind.", leverage_score: 9, immediacy_score: 7, repeat_value_score: 9, complexity_score: 6, distinctiveness_score: 7, total_score: 38, rationale: "Crucial for honesty.", module_type: "tracker" },
    { id: "f4", name: "Weakness Radar", description: "Regular prompts on known vulnerabilities.", problem_it_solves: "Ignoring fundamental flaws.", leverage_score: 7, immediacy_score: 6, repeat_value_score: 8, complexity_score: 4, distinctiveness_score: 9, total_score: 34, rationale: "Prevents blind spots.", module_type: "tracker" },
    { id: "f5", name: "Rescue Protocol", description: "An emergency flow that triggers when momentum breaks.", problem_it_solves: "Long downtime after burnouts.", leverage_score: 8, immediacy_score: 5, repeat_value_score: 7, complexity_score: 5, distinctiveness_score: 8, total_score: 33, rationale: "High value over long horizons.", module_type: "rescue_protocol" },
  ];
}

export function selectTopFeatures(candidates: FeatureCandidate[]): string[] {
  return [...candidates].sort((a, b) => b.total_score - a.total_score).slice(0, 3).map((c) => c.id);
}

function defaultConfigFor(moduleType: string): GeneratedModuleManifest["config"] {
  switch (moduleType) {
    case "tracker":
    case "evidence_log":
      return { fields: [{ key: "value", label: "Value", kind: "number" }, { key: "note", label: "Note", kind: "text" }] };
    case "rescue_protocol":
      return { steps: ["Name what's heavy in one sentence.", "Pick the smallest next move (≤5 min).", "Do it. Then decide what's next."] };
    case "practice_system":
      return { drills: [{ name: "Warm-up", minutes: 5 }, { name: "Focused rep", minutes: 20 }, { name: "Reflect", minutes: 5 }] };
    case "planner":
      return { slots: [{ label: "Deep work", cadence: "daily" }, { label: "Review", cadence: "weekly" }] };
    default:
      return { notes: "" };
  }
}

export function instantiateModuleManifests(selectedFeatureIds: string[], candidates: FeatureCandidate[]): GeneratedModuleManifest[] {
  return candidates
    .filter((c) => selectedFeatureIds.includes(c.id))
    .map((c) => ({
      id: `mod_${c.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: c.name,
      module_type: (c.module_type as GeneratedModuleManifest["module_type"]) ?? "tracker",
      title: c.name,
      description: c.description,
      linked_workstream_ids: [],
      primary_surface: "forge",
      config: c.config ?? defaultConfigFor(c.module_type),
      status: "active" as const,
      entries: [],
      created_at: new Date().toISOString(),
    }));
}

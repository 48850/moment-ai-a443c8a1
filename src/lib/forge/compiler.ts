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

const FAMILY_CANDIDATES: Record<string, FeatureCandidate[]> = {
  future_doctor_neurology: [
    { id: "med-1", name: "Study Sprint Builder", description: "Build focused timed sessions targeting your weakest science subjects. Each session has a clear target — a topic, a question type, a chapter.", problem_it_solves: "Passive study that doesn't stick.", leverage_score: 9, immediacy_score: 8, repeat_value_score: 9, complexity_score: 5, distinctiveness_score: 7, total_score: 40, rationale: "High-yield subjects need active retrieval, not re-reading.", module_type: "practice_system" },
    { id: "med-2", name: "Exam Gap Detector", description: "Track which topics keep failing in practice questions and prioritise them in your next session.", problem_it_solves: "Drilling strengths instead of fixing real weaknesses.", leverage_score: 9, immediacy_score: 8, repeat_value_score: 9, complexity_score: 4, distinctiveness_score: 8, total_score: 42, rationale: "Gap removal is higher-leverage than strength reinforcement.", module_type: "tracker" },
    { id: "med-3", name: "Progress Proof Log", description: "Record evidence of improvement: scores, concepts mastered, problems solved correctly for the first time.", problem_it_solves: "Building blind with no sense of whether it's working.", leverage_score: 8, immediacy_score: 7, repeat_value_score: 9, complexity_score: 3, distinctiveness_score: 8, total_score: 41, rationale: "Proof of progress prevents burnout on long-runway goals.", module_type: "evidence_log" },
    { id: "med-4", name: "Weekly Subject Planner", description: "Divide biology, chemistry, maths, and physics across the week with minimum hour targets. Lock in coverage before depth.", problem_it_solves: "Subjects getting neglected without noticing.", leverage_score: 8, immediacy_score: 9, repeat_value_score: 8, complexity_score: 4, distinctiveness_score: 7, total_score: 40, rationale: "Coverage discipline beats intensity bursts for exams.", module_type: "planner" },
    { id: "med-5", name: "Rescue Protocol", description: "Emergency reset flow for when study pressure becomes overwhelming and you need to restart without guilt.", problem_it_solves: "Burning out or shutting down before the exam.", leverage_score: 8, immediacy_score: 6, repeat_value_score: 7, complexity_score: 3, distinctiveness_score: 8, total_score: 36, rationale: "Long-runway goals need a built-in recovery system.", module_type: "rescue_protocol" },
  ],
  startup_founder: [
    { id: "start-1", name: "Ship Log", description: "Track what you've shipped each week — features, prototypes, conversations with real users. One entry per session.", problem_it_solves: "Feeling busy but not actually shipping anything.", leverage_score: 9, immediacy_score: 9, repeat_value_score: 9, complexity_score: 3, distinctiveness_score: 8, total_score: 44, rationale: "Shipping cadence is the most honest founder metric.", module_type: "tracker" },
    { id: "start-2", name: "User Signal Log", description: "Log what real users say — quotes, reactions, complaints, surprises. One line per signal.", problem_it_solves: "Building based on assumptions instead of real feedback.", leverage_score: 9, immediacy_score: 8, repeat_value_score: 9, complexity_score: 3, distinctiveness_score: 9, total_score: 44, rationale: "User signals separate viable ideas from wishful thinking.", module_type: "evidence_log" },
    { id: "start-3", name: "Weekly Founder Review", description: "Brief weekly checkpoint: what shipped, what blocked, what you learned, what changes next week.", problem_it_solves: "Losing the thread of what you're actually trying to build.", leverage_score: 8, immediacy_score: 8, repeat_value_score: 9, complexity_score: 3, distinctiveness_score: 7, total_score: 39, rationale: "Honest weekly reviews prevent months of silent drift.", module_type: "planner" },
    { id: "start-4", name: "Decision Log", description: "Record key decisions, why you made them, and what actually happened. One line per decision.", problem_it_solves: "Repeating mistakes or forgetting why you built what you built.", leverage_score: 8, immediacy_score: 6, repeat_value_score: 9, complexity_score: 3, distinctiveness_score: 8, total_score: 38, rationale: "Founders who track decisions learn faster.", module_type: "evidence_log" },
    { id: "start-5", name: "Rescue Protocol", description: "Emergency reset for when you're blocked, burned out, or losing momentum on a solo build.", problem_it_solves: "Long downtime after momentum breaks.", leverage_score: 8, immediacy_score: 6, repeat_value_score: 7, complexity_score: 3, distinctiveness_score: 7, total_score: 35, rationale: "Solo builders need a named recovery system.", module_type: "rescue_protocol" },
  ],
  exam_dominant_student: [
    { id: "exam-1", name: "Practice Test Tracker", description: "Schedule and log timed practice tests. Record scores, time taken, and which topics cost you marks.", problem_it_solves: "Testing yourself too rarely or without tracking what's breaking.", leverage_score: 10, immediacy_score: 9, repeat_value_score: 10, complexity_score: 4, distinctiveness_score: 8, total_score: 47, rationale: "Practice testing is the highest-yield study technique proven by research.", module_type: "tracker" },
    { id: "exam-2", name: "Weakness Driller", description: "Identify your lowest-scoring topics and drill them until they stop losing you marks. Track improvement per topic.", problem_it_solves: "Spending revision time on strengths instead of closing gaps.", leverage_score: 10, immediacy_score: 9, repeat_value_score: 10, complexity_score: 4, distinctiveness_score: 9, total_score: 48, rationale: "Weakness removal is higher-leverage than strength reinforcement.", module_type: "practice_system" },
    { id: "exam-3", name: "Score Progress Chart", description: "Log scores from every practice test. See your trend and identify if you've plateaued.", problem_it_solves: "Not knowing whether your revision is actually working.", leverage_score: 9, immediacy_score: 8, repeat_value_score: 10, complexity_score: 3, distinctiveness_score: 8, total_score: 44, rationale: "Visible progress prevents panic and surfaces plateaus early.", module_type: "evidence_log" },
    { id: "exam-4", name: "Revision Sprint Planner", description: "Build focused 25-min revision sessions backwards from your exam date. Know exactly what to cover each day.", problem_it_solves: "Last-minute cramming that doesn't stick and causes panic.", leverage_score: 9, immediacy_score: 10, repeat_value_score: 8, complexity_score: 5, distinctiveness_score: 7, total_score: 43, rationale: "Reverse-engineering from exam date creates urgency without panic.", module_type: "planner" },
    { id: "exam-5", name: "Rescue Protocol", description: "Emergency reset when exam anxiety or exhaustion causes shutdown.", problem_it_solves: "Freezing or shutting down during high-pressure exam periods.", leverage_score: 8, immediacy_score: 7, repeat_value_score: 7, complexity_score: 3, distinctiveness_score: 7, total_score: 36, rationale: "Exam periods create specific stress that needs a named protocol.", module_type: "rescue_protocol" },
  ],
  generic: [
    { id: "gen-1", name: "Deep Practice Loop", description: "Focused practice sessions that push for depth and mastery. Each session targets one skill, not general review.", problem_it_solves: "Surface-level effort that doesn't compound.", leverage_score: 8, immediacy_score: 7, repeat_value_score: 9, complexity_score: 5, distinctiveness_score: 7, total_score: 36, rationale: "Depth is the main constraint for most ambitious goals.", module_type: "practice_system" },
    { id: "gen-2", name: "Progress Signal Tracker", description: "Track the real signals that show whether you're moving toward your goal. Leading signals over lagging ones.", problem_it_solves: "Building blind with no measure of real progress.", leverage_score: 9, immediacy_score: 8, repeat_value_score: 9, complexity_score: 4, distinctiveness_score: 7, total_score: 41, rationale: "Without tracked signals, effort is invisible.", module_type: "evidence_log" },
    { id: "gen-3", name: "Weekly Goal Review", description: "Short weekly check-in: what moved, what stalled, what needs adjusting. Takes less than 10 minutes.", problem_it_solves: "Drifting from your goal without noticing.", leverage_score: 8, immediacy_score: 8, repeat_value_score: 9, complexity_score: 3, distinctiveness_score: 7, total_score: 39, rationale: "Weekly reviews create compounding self-awareness.", module_type: "planner" },
    { id: "gen-4", name: "Rescue Protocol", description: "Emergency flow that activates when momentum breaks. Named steps so you know exactly what to do.", problem_it_solves: "Long downtime after burnout or setback.", leverage_score: 8, immediacy_score: 6, repeat_value_score: 7, complexity_score: 3, distinctiveness_score: 8, total_score: 36, rationale: "High value over long horizons.", module_type: "rescue_protocol" },
    { id: "gen-5", name: "Bottleneck Tracker", description: "Log what repeatedly blocks your progress, then address it systematically.", problem_it_solves: "Hitting the same wall without naming it.", leverage_score: 8, immediacy_score: 7, repeat_value_score: 8, complexity_score: 3, distinctiveness_score: 8, total_score: 38, rationale: "Naming the bottleneck is the first step to removing it.", module_type: "tracker" },
  ],
};

export function generateFeatureCandidates(pursuitModel: CompiledPursuitModel | null): FeatureCandidate[] {
  const family = pursuitModel?.pursuit_family ?? "generic";
  const candidates = FAMILY_CANDIDATES[family] ?? FAMILY_CANDIDATES.generic;
  // If pursuit model has workstream bottlenecks, boost the most relevant feature
  if (pursuitModel?.workstreams?.length) {
    const bottleneck = pursuitModel.workstreams
      .filter((w) => w.status !== "complete")
      .sort((a, b) => {
        const p = { critical: 0, high: 1, medium: 2, low: 3 } as const;
        return (p[a.priority] ?? 4) - (p[b.priority] ?? 4);
      })[0]?.bottleneck ?? "";
    if (bottleneck) {
      // Boost the tracker type candidate since it directly addresses bottlenecks
      return candidates.map((c) =>
        c.module_type === "tracker"
          ? { ...c, total_score: c.total_score + 3 }
          : c,
      );
    }
  }
  return candidates;
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

import type {
  ForgeGuidebook,
  ForgeFeatureType,
  GuidebookFunctionType,
  MomentState,
} from "@/lib/types";

export const FEATURE_TYPE_LABELS: Record<ForgeFeatureType, string> = {
  control_room: "Control Room",
  proof_builder: "Proof Builder",
  drill_lab: "Drill Lab",
  tracker: "Signal Tracker",
  planner: "Planner",
  simulator: "Simulator",
  coach_lens: "Coach Lens",
  research_helper: "Research Helper",
  decision_engine: "Decision Engine",
  protocol: "Protocol",
  custom: "Custom",
};

export const FUNCTION_TYPE_LABELS: Record<GuidebookFunctionType, string> = {
  generate: "Generate",
  rank: "Rank",
  critique: "Critique",
  score: "Score",
  plan: "Plan",
  reflect: "Reflect",
  diagnose: "Diagnose",
  rewrite: "Rewrite",
  summarize: "Summarize",
  decide: "Decide",
};

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "feature";

const id = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

export function buildTemplateGuidebook(
  type: ForgeFeatureType,
  goal: string,
): ForgeGuidebook {
  const now = new Date().toISOString();
  const title = `${FEATURE_TYPE_LABELS[type]}${goal ? ` · ${goal.slice(0, 40)}` : ""}`;
  const inputId = id();
  const fnId = id();
  return {
    id: id(),
    feature_type: type,
    title,
    subtitle: "",
    purpose: `A ${FEATURE_TYPE_LABELS[type]} tailored to your goal.`,
    bottleneck_addressed: "",
    route_slug: slug(title),
    required_inputs: [
      {
        id: inputId,
        label: "Context",
        type: "textarea",
        placeholder: "What's happening right now?",
        required: true,
      },
    ],
    ai_functions: [
      {
        id: fnId,
        name: "Generate next move",
        description: "Turn your context into a clear next move.",
        function_type: "generate",
        prompt_contract: `You are a sharp coach. Read the user's context and propose a single concrete next action that moves their goal forward. Be specific to: ${goal || "their goal"}.`,
        input_sources: [inputId],
        output_schema: {
          next_action: "string",
          why: "string",
        },
        writes_to_state: true,
        allowed_state_actions: ["task/create"],
      },
    ],
    sections: [
      { id: id(), title: "Inputs", section_type: "input_panel" },
      { id: id(), title: "Result", section_type: "ai_output", linked_ai_function_id: fnId },
      { id: id(), title: "History", section_type: "saved_entries" },
    ],
    task_outputs: [],
    audit_hooks: [],
    state_writes: [{ action: "task/create", description: "Create a today task from the next action." }],
    safety_rules: ["Never shame the user.", "Blame the plan, not the person."],
    status: "draft",
    created_at: now,
    updated_at: now,
  };
}

export function parseAIGuidebookResponse(
  raw: Record<string, unknown>,
  state: MomentState,
): ForgeGuidebook {
  const now = new Date().toISOString();
  const goal = state.active_goal?.statement ?? "";
  const featureType = (raw.feature_type as ForgeFeatureType) ?? "custom";
  const title = (raw.title as string) ?? `${FEATURE_TYPE_LABELS[featureType] ?? "Feature"} · ${goal.slice(0, 40)}`;
  const inputs = Array.isArray(raw.required_inputs) ? (raw.required_inputs as any[]) : [];
  const fns = Array.isArray(raw.ai_functions) ? (raw.ai_functions as any[]) : [];
  const sections = Array.isArray(raw.sections) ? (raw.sections as any[]) : [];
  const safety = Array.isArray(raw.safety_rules) ? (raw.safety_rules as string[]) : [];
  const audits = Array.isArray(raw.audit_hooks) ? (raw.audit_hooks as any[]) : [];
  const writes = Array.isArray(raw.state_writes) ? (raw.state_writes as any[]) : [];

  const normalizedInputs = inputs.map((i) => ({
    id: i.id ?? id(),
    label: i.label ?? "Input",
    type: (i.type as any) ?? "text",
    placeholder: i.placeholder ?? "",
    required: i.required ?? false,
    options: i.options,
  }));

  const normalizedFns = fns.map((f) => ({
    id: f.id ?? id(),
    name: f.name ?? "AI Function",
    description: f.description ?? "",
    function_type: (f.function_type as GuidebookFunctionType) ?? "generate",
    prompt_contract: f.prompt_contract ?? "",
    input_sources: Array.isArray(f.input_sources) ? f.input_sources : normalizedInputs.map((i) => i.id),
    output_schema: f.output_schema ?? { result: "string" },
    writes_to_state: f.writes_to_state ?? false,
    allowed_state_actions: Array.isArray(f.allowed_state_actions) ? f.allowed_state_actions : [],
  }));

  const normalizedSections =
    sections.length > 0
      ? sections.map((s) => ({
          id: s.id ?? id(),
          title: s.title ?? "Section",
          section_type: (s.section_type as any) ?? "ai_output",
          description: s.description,
          linked_ai_function_id: s.linked_ai_function_id ?? normalizedFns[0]?.id,
        }))
      : [
          { id: id(), title: "Inputs", section_type: "input_panel" as const },
          { id: id(), title: "Result", section_type: "ai_output" as const, linked_ai_function_id: normalizedFns[0]?.id },
          { id: id(), title: "History", section_type: "saved_entries" as const },
        ];

  return {
    id: id(),
    feature_type: featureType,
    title,
    subtitle: (raw.subtitle as string) ?? "",
    purpose: (raw.purpose as string) ?? "",
    bottleneck_addressed: (raw.bottleneck_addressed as string) ?? "",
    route_slug: (raw.route_slug as string) ?? slug(title),
    required_inputs: normalizedInputs,
    ai_functions: normalizedFns,
    sections: normalizedSections,
    task_outputs: Array.isArray(raw.task_outputs) ? (raw.task_outputs as any[]) : [],
    audit_hooks: audits,
    state_writes: writes.length ? writes : [{ action: "task/create", description: "Add tasks from output." }],
    safety_rules: safety.length ? safety : ["Never shame the user."],
    status: "draft",
    created_at: now,
    updated_at: now,
  };
}

export function detectSystemGap(state: MomentState | null) {
  if (!state) return null;
  const goal = state.active_goal?.statement;
  if (!goal || !goal.trim()) return null;
  const stalledWorkstream = state.pursuit_model?.workstreams?.find((w) => w.status === "stalled" || w.status === "slipping");
  if (stalledWorkstream) {
    return {
      bottleneck: stalledWorkstream.bottleneck || `${stalledWorkstream.name} is stalling`,
      reason: `This workstream needs a dedicated system to keep moving.`,
      suggested_feature_type: "control_room" as ForgeFeatureType,
      suggested_question: `What would unblock "${stalledWorkstream.name}" this week?`,
    };
  }
  return null;
}

// @ts-nocheck
import type {
  ForgeGuidebook,
  GuidebookInput,
  GuidebookSection,
  GuidebookAIFunction,
  GuidebookStateWrite,
  GuidebookTaskOutput,
  GuidebookAuditHook,
  ForgeFeatureType,
  CompiledPursuitModel,
  MomentState,
} from "@/lib/types";

// ─── Slug helpers ─────────────────────────────────────────────────────────────

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

// ─── State read for gap detection ─────────────────────────────────────────────

export interface ForgeSystemGap {
  bottleneck: string;
  reason: string;
  suggested_feature_type: ForgeFeatureType;
  suggested_question: string;
}

export function detectSystemGap(state: MomentState): ForgeSystemGap {
  const model = state.pursuit_model;
  const reflections = state.reflections ?? [];
  const feedback = state.execution_feedback ?? [];
  const guidebooks = state.forge_state?.guidebooks ?? [];
  const activeGuideBooks = guidebooks.filter((g) => g.status === "active");

  // Look for bottleneck in pursuit model
  const bottleneckWorkstream = model?.workstreams?.find((w) => w.bottleneck);
  const bottleneck = bottleneckWorkstream?.bottleneck ?? model?.workstreams?.[0]?.title ?? null;

  // Look at recent reflections for struggle patterns
  const recentStruggles = reflections
    .slice(-5)
    .map((r) => r.struggle)
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Count negative feedback
  const negativeFeedback = feedback.slice(-20).filter((f) =>
    ["stuck", "hard", "confused", "overwhelmed", "behind", "missed"].some((kw) =>
      f.feedback.toLowerCase().includes(kw)
    )
  ).length;

  // Look at what features already exist to avoid suggesting duplicates
  const existingTypes = new Set(activeGuideBooks.map((g) => g.feature_type));

  // Simple heuristic gap detection
  if (bottleneck && !existingTypes.has("control_room")) {
    return {
      bottleneck: bottleneck,
      reason: `Your pursuit model identifies "${bottleneck}" as a current bottleneck with no execution feature covering it.`,
      suggested_feature_type: "control_room",
      suggested_question:
        "Should this feature mostly help you execute on that bottleneck, track your progress through it, or practice the skill involved?",
    };
  }

  if (recentStruggles.includes("behind") || recentStruggles.includes("overwhelmed")) {
    return {
      bottleneck: "Assignment or task overload",
      reason: "Your recent reflections show recurring struggle with falling behind or feeling overwhelmed.",
      suggested_feature_type: "control_room",
      suggested_question:
        "What kind of system would help most: a triage tool for catching up, a drill for building the skill faster, or a tracker for staying ahead?",
    };
  }

  if (recentStruggles.includes("proof") || recentStruggles.includes("evidence") || recentStruggles.includes("application")) {
    return {
      bottleneck: "Proof and evidence quality",
      reason: "Your reflections suggest weak or unorganised application evidence.",
      suggested_feature_type: "proof_builder",
      suggested_question:
        "Should this feature help you collect and score existing proof, generate new proof tasks, or do both?",
    };
  }

  if (negativeFeedback >= 3 && !existingTypes.has("drill_lab")) {
    return {
      bottleneck: "Execution quality on high-leverage tasks",
      reason: "Multiple recent sessions show friction. A targeted drill lab could turn weak reps into strong ones.",
      suggested_feature_type: "drill_lab",
      suggested_question:
        "Which domain needs the most practice right now: writing, maths, speaking, or a specific skill from your goal?",
    };
  }

  // Default
  const goalStatement = state.active_goal?.statement ?? "";
  return {
    bottleneck: goalStatement ? `Execution momentum toward: ${goalStatement.slice(0, 60)}` : "No bottleneck detected yet",
    reason: "No specific gap detected — you can forge a feature around any recurring need.",
    suggested_feature_type: "tracker",
    suggested_question:
      "What recurring problem should this feature solve: unclear tasks, weak proof, missed deadlines, practice quality, or decision-making?",
  };
}

// ─── Guidebook factory ────────────────────────────────────────────────────────

export function buildGuidebookFromAIResponse(
  aiResponse: Partial<ForgeGuidebook>,
  state: MomentState,
): ForgeGuidebook {
  const now = new Date().toISOString();
  const id = `gb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const title = aiResponse.title ?? "Custom Feature";
  const slug = aiResponse.route_slug ?? slugify(title);

  return {
    id,
    title,
    subtitle: aiResponse.subtitle ?? "",
    purpose: aiResponse.purpose ?? "",
    linked_goal_id: state.active_goal?.statement ? "active_goal" : "",
    bottleneck_addressed: aiResponse.bottleneck_addressed ?? "",
    feature_type: aiResponse.feature_type ?? "custom",
    status: "draft",
    route_slug: slug,
    required_inputs: aiResponse.required_inputs ?? [],
    sections: aiResponse.sections ?? [],
    ai_functions: aiResponse.ai_functions ?? [],
    state_writes: aiResponse.state_writes ?? [],
    task_outputs: aiResponse.task_outputs ?? [],
    audit_hooks: aiResponse.audit_hooks ?? [],
    chat_context_summary: aiResponse.chat_context_summary ?? `${title}: ${aiResponse.purpose ?? ""}`,
    safety_rules: aiResponse.safety_rules ?? [
      "Do not produce content designed to cheat or deceive.",
      "Do not give medical diagnoses or replace professional advice.",
      "Do not create systems for surveillance or data extraction.",
    ],
    created_at: now,
    updated_at: now,
    last_used_at: now,
  };
}

// ─── Predefined guidebook templates for offline/fallback use ──────────────────

function makeInputId() {
  return `inp_${Math.random().toString(36).slice(2, 8)}`;
}
function makeSectionId() {
  return `sec_${Math.random().toString(36).slice(2, 8)}`;
}
function makeFnId() {
  return `fn_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildTemplateGuidebook(
  featureType: ForgeFeatureType,
  goalStatement: string,
): ForgeGuidebook {
  const now = new Date().toISOString();
  const id = `gb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const templates: Record<string, Omit<ForgeGuidebook, "id" | "created_at" | "updated_at" | "last_used_at" | "status" | "linked_goal_id">> = {
    proof_builder: {
      title: "Application Evidence Bank",
      subtitle: "Turn your work into proof",
      purpose: "Help you collect, score, and improve the evidence that supports your goal applications.",
      bottleneck_addressed: "Weak or unorganised application proof",
      feature_type: "proof_builder",
      route_slug: "application-evidence-bank",
      required_inputs: [
        { id: makeInputId(), label: "Evidence title", type: "text", required: true, placeholder: "e.g. Science fair project, Math Olympiad" },
        { id: makeInputId(), label: "Description", type: "textarea", required: true, placeholder: "What did you do and what was the result?" },
        { id: makeInputId(), label: "Category", type: "select", required: true, options: ["Academic", "Leadership", "Research", "Extracurricular", "Community", "Personal"] },
        { id: makeInputId(), label: "Why it matters", type: "textarea", required: false, placeholder: "How does this connect to your goal?" },
        { id: makeInputId(), label: "Current quality (1–10)", type: "scale", required: true },
      ],
      sections: [
        { id: makeSectionId(), title: "Evidence Intake", section_type: "input_panel", description: "Add a new piece of evidence" },
        { id: makeSectionId(), title: "AI Proof Analysis", section_type: "ai_output", description: "Strength score, weak points, and next action", linked_ai_function_id: "fn_analyze" },
        { id: makeSectionId(), title: "Evidence Bank", section_type: "saved_entries", description: "All your evidence, sorted by strength" },
        { id: makeSectionId(), title: "Next Proof Task", section_type: "task_list", description: "AI-generated tasks to improve your strongest proof gaps" },
      ],
      ai_functions: [
        {
          id: "fn_analyze",
          name: "Analyze evidence strength",
          description: "Scores the evidence against goal relevance, uniqueness, and verifiability",
          function_type: "score_quality",
          input_sources: ["evidence_title", "description", "category", "why_it_matters", "current_quality"],
          output_schema: { proof_score: "number", weak_point: "string", next_action: "string", verdict: "string" },
          prompt_contract: "You are evaluating application evidence for an ambitious student. Score it 1-10 for goal alignment, uniqueness, and verifiability. Identify the single weakest point and suggest the one next action to improve it.",
          writes_to_state: true,
          allowed_state_actions: ["task/create", "forge/log_signal", "audit/add_signal"],
        },
        {
          id: "fn_next_move",
          name: "Create next proof task",
          description: "Generates a concrete task to close the biggest proof gap",
          function_type: "create_next_move",
          input_sources: ["evidence_bank"],
          output_schema: { task_title: "string", task_description: "string", priority: "string" },
          prompt_contract: "Look at the evidence bank and find the highest-priority gap. Generate one concrete task the student can do this week to add or strengthen a piece of proof.",
          writes_to_state: true,
          allowed_state_actions: ["task/create"],
        },
      ],
      state_writes: [
        { action: "task/create", conditions: "After AI analysis produces a next_action", user_confirmation_required: true },
        { action: "forge/log_signal", conditions: "After any evidence is saved", user_confirmation_required: false },
        { action: "audit/add_signal", conditions: "After proof score is computed", user_confirmation_required: false },
      ],
      task_outputs: [
        { id: `to_${Date.now()}`, title_template: "Add proof: {{evidence_title}}", priority: "medium", trigger: "After analysis" },
      ],
      audit_hooks: [
        { signal_key: "proof_score", description: "Average proof score across all evidence", trigger: "On evidence save" },
        { signal_key: "evidence_count", description: "Total evidence entries logged", trigger: "On evidence save" },
      ],
      chat_context_summary: "This feature tracks and scores application evidence for the user's goal. Active entries and AI scores are available to guide task suggestions.",
      safety_rules: ["Do not fabricate evidence or results.", "Do not help construct misleading claims."],
    },

    control_room: {
      title: "Assignment Control Room",
      subtitle: "Turn messy assignments into execution plans",
      purpose: "Take any assignment, extract its requirements, triage urgency, and generate a Plan A and Plan B.",
      bottleneck_addressed: "Assignment confusion and execution stalls",
      feature_type: "control_room",
      route_slug: "assignment-control-room",
      required_inputs: [
        { id: makeInputId(), label: "Paste the assignment", type: "textarea", required: true, placeholder: "Paste the full text or describe the task…" },
        { id: makeInputId(), label: "Due date", type: "date", required: true },
        { id: makeInputId(), label: "Current progress (0–100%)", type: "scale", required: true },
        { id: makeInputId(), label: "Where you're stuck", type: "textarea", required: false, placeholder: "What's the hardest part right now?" },
        { id: makeInputId(), label: "Energy level right now (1–5)", type: "scale", required: false },
      ],
      sections: [
        { id: makeSectionId(), title: "Paste Assignment", section_type: "input_panel", description: "Drop your assignment text and context" },
        { id: makeSectionId(), title: "Requirement Extraction", section_type: "ai_output", description: "AI breaks the assignment into clear requirements", linked_ai_function_id: "fn_analyze" },
        { id: makeSectionId(), title: "Triage Board", section_type: "scorecard", description: "Urgency score and hidden subtasks", linked_ai_function_id: "fn_triage" },
        { id: makeSectionId(), title: "Plan A / Plan B", section_type: "decision_result", description: "Full plan vs minimal rescue version", linked_ai_function_id: "fn_plan" },
        { id: makeSectionId(), title: "Push to Today", section_type: "task_list", description: "Confirmed tasks ready to add to Today" },
        { id: makeSectionId(), title: "Previous Runs", section_type: "saved_entries", description: "Assignments you've processed before" },
      ],
      ai_functions: [
        {
          id: "fn_analyze",
          name: "Extract requirements",
          description: "Pulls key requirements, due structure, and hidden subtasks from the assignment text",
          function_type: "analyze",
          input_sources: ["assignment_text", "due_date"],
          output_schema: { requirements: "string[]", hidden_subtasks: "string[]", unclear_parts: "string[]", risk_level: "string" },
          prompt_contract: "You are an expert academic strategist. Extract all explicit and hidden requirements from this assignment. Flag any unclear parts. Identify risk level (low/medium/high) based on complexity and scope.",
          writes_to_state: false,
          allowed_state_actions: [],
        },
        {
          id: "fn_triage",
          name: "Triage urgency",
          description: "Scores urgency and identifies the single most important action",
          function_type: "rank_options",
          input_sources: ["assignment_text", "due_date", "current_progress", "where_stuck"],
          output_schema: { urgency_score: "number", bottleneck: "string", first_move: "string" },
          prompt_contract: "Given the assignment, due date, current progress, and where the student is stuck, score urgency 1-10. Identify the single biggest bottleneck. Suggest one concrete first move they should do in the next 30 minutes.",
          writes_to_state: false,
          allowed_state_actions: [],
        },
        {
          id: "fn_plan",
          name: "Generate Plan A / Plan B",
          description: "Creates a full execution plan and a minimal rescue version",
          function_type: "generate_plan",
          input_sources: ["assignment_text", "due_date", "current_progress", "energy_level", "requirements"],
          output_schema: { plan_a: "string[]", plan_b: "string[]", today_tasks: "string[]" },
          prompt_contract: "Generate Plan A (full quality, on-time completion) and Plan B (minimum viable submission if time is short) as ordered task lists. Also produce 1-3 tasks the student should do today.",
          writes_to_state: true,
          allowed_state_actions: ["task/create", "plan/add_item", "forge/log_signal"],
        },
      ],
      state_writes: [
        { action: "task/create", conditions: "After plan generation, for each Today task approved", user_confirmation_required: true },
        { action: "plan/add_item", conditions: "After plan generation, for multi-day items", user_confirmation_required: true },
        { action: "forge/log_signal", conditions: "After each triage run", user_confirmation_required: false },
      ],
      task_outputs: [
        { id: `to_${Date.now()}`, title_template: "{{assignment_title}}: {{first_task}}", priority: "high", trigger: "After plan generation" },
      ],
      audit_hooks: [
        { signal_key: "urgency_score", description: "Urgency score of the last processed assignment", trigger: "After triage" },
        { signal_key: "assignments_processed", description: "Total assignments run through the control room", trigger: "After each run" },
      ],
      chat_context_summary: "The Assignment Control Room has processed recent assignments. It knows the urgency scores, generated plans, and any tasks pushed to Today.",
      safety_rules: ["Do not write the assignment for the student.", "Help with understanding, planning, and execution — not ghostwriting."],
    },

    drill_lab: {
      title: "Debate Drill Lab",
      subtitle: "Practice with AI opposition",
      purpose: "Help you practise debating with active AI opposition, scoring, and drill history.",
      bottleneck_addressed: "Weak debate practice with no real feedback",
      feature_type: "drill_lab",
      route_slug: "debate-drill-lab",
      required_inputs: [
        { id: makeInputId(), label: "Debate topic", type: "text", required: true, placeholder: "e.g. Social media does more harm than good" },
        { id: makeInputId(), label: "Your side", type: "select", required: true, options: ["Affirmative", "Negative"] },
        { id: makeInputId(), label: "Speech length (minutes)", type: "number", required: false },
        { id: makeInputId(), label: "Skill focus", type: "select", required: false, options: ["Argument construction", "Rebuttal speed", "Evidence use", "Delivery", "Cross-examination"] },
        { id: makeInputId(), label: "Difficulty (1–5)", type: "scale", required: false },
      ],
      sections: [
        { id: makeSectionId(), title: "Topic Setup", section_type: "input_panel", description: "Configure your drill session" },
        { id: makeSectionId(), title: "AI Opponent", section_type: "ai_output", description: "Arguments and rebuttal challenges", linked_ai_function_id: "fn_challenge" },
        { id: makeSectionId(), title: "Your Response", section_type: "reflection_box", description: "Type or record your rebuttal" },
        { id: makeSectionId(), title: "Scorecard", section_type: "scorecard", description: "AI scores your argument quality", linked_ai_function_id: "fn_score" },
        { id: makeSectionId(), title: "Drill History", section_type: "saved_entries", description: "Previous drills, topics, and scores" },
      ],
      ai_functions: [
        {
          id: "fn_challenge",
          name: "Generate AI opponent arguments",
          description: "Produces strong arguments for the opposing side and rebuttal challenges",
          function_type: "challenge",
          input_sources: ["topic", "your_side", "difficulty"],
          output_schema: { opponent_arguments: "string[]", rebuttal_challenge: "string", trap_question: "string" },
          prompt_contract: "You are a skilled debater on the opposite side. Generate 3 strong arguments against the student's position. Then give one sharp rebuttal challenge and one trap question they should prepare for.",
          writes_to_state: false,
          allowed_state_actions: [],
        },
        {
          id: "fn_score",
          name: "Score argument quality",
          description: "Scores the student's response on logic, evidence, and persuasion",
          function_type: "score_quality",
          input_sources: ["student_response", "topic", "skill_focus"],
          output_schema: { logic_score: "number", evidence_score: "number", persuasion_score: "number", total_score: "number", feedback: "string", next_drill: "string" },
          prompt_contract: "Score the student's debate response (1-10 each): logic (is it sound?), evidence (are claims supported?), persuasion (is it compelling?). Give one sharp piece of feedback and suggest the next drill focus.",
          writes_to_state: true,
          allowed_state_actions: ["forge/log_signal", "task/create", "audit/add_signal"],
        },
      ],
      state_writes: [
        { action: "forge/log_signal", conditions: "After each scored drill", user_confirmation_required: false },
        { action: "task/create", conditions: "After scoring, if weakness identified", user_confirmation_required: true },
        { action: "audit/add_signal", conditions: "After each session", user_confirmation_required: false },
      ],
      task_outputs: [
        { id: `to_${Date.now()}`, title_template: "Debate drill: {{skill_focus}}", priority: "medium", trigger: "After session scoring" },
      ],
      audit_hooks: [
        { signal_key: "avg_debate_score", description: "Rolling average debate quality score", trigger: "After each scored session" },
        { signal_key: "sessions_completed", description: "Total drill sessions", trigger: "After each session" },
      ],
      chat_context_summary: "Debate Drill Lab tracks practice sessions and scores. Recent performance and identified weaknesses are available to guide next steps.",
      safety_rules: ["Keep all debate topics appropriate and non-harmful.", "Do not produce content that discriminates or incites."],
    },

    tracker: {
      title: "Progress Signal Tracker",
      subtitle: "Track what actually matters",
      purpose: "Log real signals toward your goal, spot trends, and generate next actions from the data.",
      bottleneck_addressed: "Building blind with no clear progress signals",
      feature_type: "tracker",
      route_slug: "progress-signal-tracker",
      required_inputs: [
        { id: makeInputId(), label: "Signal name", type: "text", required: true, placeholder: "e.g. SAT practice score, pages read, hours focused" },
        { id: makeInputId(), label: "Value", type: "number", required: true },
        { id: makeInputId(), label: "Context note", type: "text", required: false, placeholder: "What happened today?" },
      ],
      sections: [
        { id: makeSectionId(), title: "Log Signal", section_type: "input_panel", description: "Record a progress signal" },
        { id: makeSectionId(), title: "Trend Analysis", section_type: "ai_output", description: "AI analyses your trend and extracts next action", linked_ai_function_id: "fn_extract" },
        { id: makeSectionId(), title: "Signal Log", section_type: "saved_entries", description: "All logged signals over time" },
        { id: makeSectionId(), title: "Next Move", section_type: "task_list", description: "AI-generated task based on trend" },
      ],
      ai_functions: [
        {
          id: "fn_extract",
          name: "Extract signals and next move",
          description: "Analyses the trend across recent entries and suggests a concrete next action",
          function_type: "extract_signals",
          input_sources: ["signal_history"],
          output_schema: { trend: "string", velocity: "string", next_action: "string", warning: "string" },
          prompt_contract: "Analyse the student's recent signal log. Describe the trend (improving/stalling/declining). Estimate velocity. Suggest one concrete next action. Flag any warning if the trend is concerning.",
          writes_to_state: true,
          allowed_state_actions: ["task/create", "forge/log_signal", "audit/add_signal"],
        },
      ],
      state_writes: [
        { action: "forge/log_signal", conditions: "After every signal entry", user_confirmation_required: false },
        { action: "task/create", conditions: "After AI generates a next action", user_confirmation_required: true },
        { action: "audit/add_signal", conditions: "Weekly trend summary", user_confirmation_required: false },
      ],
      task_outputs: [
        { id: `to_${Date.now()}`, title_template: "Act on signal: {{next_action}}", priority: "medium", trigger: "After trend analysis" },
      ],
      audit_hooks: [
        { signal_key: "signal_velocity", description: "Week-over-week change in tracked signal", trigger: "After each log" },
        { signal_key: "entries_this_week", description: "How many signals logged this week", trigger: "After each log" },
      ],
      chat_context_summary: "Signal tracker is logging progress metrics. Recent values, trends, and AI-recommended next actions are available.",
      safety_rules: [],
    },

    custom: {
      title: "Custom Feature",
      subtitle: "Your own AI-powered system",
      purpose: "A custom feature built around your specific need.",
      bottleneck_addressed: "User-defined",
      feature_type: "custom",
      route_slug: "custom-feature",
      required_inputs: [
        { id: makeInputId(), label: "Input", type: "textarea", required: true, placeholder: "Describe what you want to analyse or work on…" },
      ],
      sections: [
        { id: makeSectionId(), title: "Input", section_type: "input_panel" },
        { id: makeSectionId(), title: "AI Analysis", section_type: "ai_output", linked_ai_function_id: "fn_analyze" },
        { id: makeSectionId(), title: "History", section_type: "saved_entries" },
      ],
      ai_functions: [
        {
          id: "fn_analyze",
          name: "Analyse",
          description: "Analyses the input and produces structured output",
          function_type: "analyze",
          input_sources: ["input"],
          output_schema: { analysis: "string", next_action: "string" },
          prompt_contract: "Analyse the user input in the context of their goal. Provide useful structured output and suggest one next action.",
          writes_to_state: true,
          allowed_state_actions: ["task/create", "forge/log_signal"],
        },
      ],
      state_writes: [
        { action: "task/create", conditions: "After AI generates a next action", user_confirmation_required: true },
      ],
      task_outputs: [],
      audit_hooks: [],
      chat_context_summary: "Custom feature tracking user inputs and AI analysis results.",
      safety_rules: [
        "Do not produce content designed to cheat or deceive.",
        "Do not give medical diagnoses or replace professional advice.",
      ],
    },
  };

  const template = templates[featureType] ?? templates.custom;

  return {
    ...template,
    id,
    status: "draft" as const,
    linked_goal_id: goalStatement ? "active_goal" : "",
    created_at: now,
    updated_at: now,
    last_used_at: now,
  };
}

// ─── AI response parser ───────────────────────────────────────────────────────

export function parseAIGuidebookResponse(
  raw: Record<string, unknown>,
  state: MomentState,
): ForgeGuidebook {
  return buildGuidebookFromAIResponse(raw as Partial<ForgeGuidebook>, state);
}

// ─── Validation ──────────────────────────────────────────────────────────────

export function validateGuidebook(g: ForgeGuidebook): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!g.title?.trim()) reasons.push("missing title");
  if ((g.required_inputs?.length ?? 0) < 2) reasons.push("needs ≥2 inputs");
  if ((g.ai_functions?.length ?? 0) < 1) reasons.push("needs ≥1 AI function");
  if ((g.sections?.length ?? 0) < 3) reasons.push("needs ≥3 sections");
  for (const fn of g.ai_functions ?? []) {
    if (!fn.prompt_contract || fn.prompt_contract.length < 40) {
      reasons.push(`fn ${fn.id}: prompt_contract too short (<40 chars)`);
    }
  }
  return { ok: reasons.length === 0, reasons };
}

// ─── AI-powered custom guidebook generation ────────────────────────────────────

export async function generateCustomGuidebookViaAI(
  state: MomentState,
  userDescription: string,
): Promise<{ guidebook: ForgeGuidebook; validation: ReturnType<typeof validateGuidebook> }> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { buildContextPacket } = await import("@/lib/ai/context-packet");
  const { data } = await supabase.functions.invoke("app-intelligence", {
    body: {
      intent: "forge_guidebook",
      snapshot: buildContextPacket(state),
      payload: {
        description: userDescription,
        feature_type: "custom",
        goal: state.active_goal?.statement ?? "",
        bottleneck: "user-defined",
      },
    },
  });
  const raw = (data?.result ?? {}) as Partial<ForgeGuidebook>;
  const guidebook = buildGuidebookFromAIResponse(raw, state);
  const validation = validateGuidebook(guidebook);
  return { guidebook, validation };
}

// ─── Feature type labels ──────────────────────────────────────────────────────

export const FEATURE_TYPE_LABELS: Record<ForgeFeatureType, string> = {
  tracker: "Signal Tracker",
  protocol: "Protocol",
  control_room: "Control Room",
  drill_lab: "Drill Lab",
  proof_builder: "Proof Builder",
  decision_engine: "Decision Engine",
  planner: "Planner",
  simulator: "Simulator",
  coach_lens: "Coach Lens",
  research_helper: "Research Helper",
  custom: "Custom",
};

export const FUNCTION_TYPE_LABELS: Record<string, string> = {
  analyze: "Analyse",
  generate_plan: "Generate Plan",
  split_tasks: "Split Tasks",
  score_quality: "Score Quality",
  rank_options: "Rank Options",
  simulate: "Simulate",
  challenge: "Challenge",
  summarize: "Summarise",
  extract_signals: "Extract Signals",
  create_next_move: "Create Next Move",
};
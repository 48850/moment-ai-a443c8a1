// Coach-style chat with two modes:
// 1. Default — elicits Schedule Info constraints and operates on the live plan.
// 2. goal_specialisation — post-onboarding calibration: maps the pathway, locates
//    the user on it, and activates the first meaningful task.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TOOLS = [
  {
    type: "function",
    function: {
      name: "update_constraints",
      description:
        "Save schedule info the user has just shared. ONLY include fields they explicitly answered in this message. Never include a field that is already in constraints_known. IMPORTANT: if the user says they have NO fixed commitments (none, no, nothing, not really), set fixed_commitments_checked: true so the app never asks again.",
      parameters: {
        type: "object",
        properties: {
          school_end_time: { type: "string", description: "HH:mm 24h, e.g. '15:30'" },
          commute_minutes: { type: "number" },
          sleep_floor_time: { type: "string", description: "Latest acceptable bedtime, HH:mm" },
          sleep_target_time: { type: "string", description: "Target bedtime, HH:mm" },
          exercise_minutes_daily: { type: "number" },
          study_minutes_daily: { type: "number" },
          preferred_work_window: { type: "string" },
          energy_pattern: {
            type: "string",
            enum: ["morning", "afternoon", "night", "variable", "unknown"],
          },
          fixed_commitments_checked: {
            type: "boolean",
            description: "Set to true when the user confirms they have NO fixed commitments (none, no, nothing, etc.). This marks fixed_commitments as answered so it is never asked again.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_fixed_commitment",
      description: "Record a recurring fixed commitment the user mentioned.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          day_of_week: { type: "string", description: "e.g. 'Mon', 'Tue,Thu', 'Daily'" },
          start_time: { type: "string", description: "HH:mm" },
          end_time: { type: "string", description: "HH:mm" },
          importance: {
            type: "string",
            enum: ["essential", "important", "flexible"],
          },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_goal",
      description:
        "Lock in or refine the user's single active goal. Only call when the user clearly stated a goal they want this app pointed at.",
      parameters: {
        type: "object",
        properties: {
          statement: { type: "string" },
          why_it_matters: { type: "string" },
        },
        required: ["statement"],
        additionalProperties: false,
      },
    },
  },
  // ─── Omnipotent task tools ───────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "add_task",
      description: "Create a new task for the user. Use when they describe something they want to do.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          why_now: { type: "string", description: "One sentence linking this to their goal/stage." },
          proof_of_completion: { type: "string", description: "Observable signal that proves it's done." },
          estimated_minutes: { type: "number" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
          category: { type: "string", enum: ["goal_direct", "bottleneck_removal", "discovery", "maintenance"] },
          resource_url: { type: "string", description: "REQUIRED if task involves online work (course, signup, watch/read). Real specific https URL to one consumable source — not a homepage, category page, or search results URL." },
          resource_label: { type: "string", description: "Short label for the URL. Required if resource_url is set." },
          elaborated_notes: {
            type: "array",
            minItems: 2,
            maxItems: 5,
            description: "REQUIRED. 2-5 substantive note paragraphs (~2-4 sentences each) elaborating the task: how to approach it, sub-steps, what to look for, pitfalls, and — if resource_url is set — what to extract from that resource. Concrete guidance, not motivation.",
            items: { type: "string" },
          },
          schedule_for: {
            type: "object",
            description: "Optional: also place this task on the weekly calendar.",
            properties: {
              day_index: { type: "number", minimum: 0, maximum: 6, description: "0=Mon..6=Sun" },
              start_time: { type: "string", description: "HH:MM 24h" },
            },
            additionalProperties: false,
          },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_task",
      description: "Update an existing task. Pick the id from pending_tasks in context.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Task id from pending_tasks." },
          title: { type: "string" },
          why_now: { type: "string" },
          proof_of_completion: { type: "string" },
          estimated_minutes: { type: "number" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_task",
      description: "Mark a task as done by id.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_task",
      description: "Remove a task by id. Use only when the user explicitly wants it gone.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },
  // ─── Omnipotent week-plan tools ──────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "add_week_block",
      description: "Add a new block to the weekly calendar.",
      parameters: {
        type: "object",
        properties: {
          day_index: { type: "number", minimum: 0, maximum: 6 },
          start_time: { type: "string", description: "HH:MM 24h" },
          end_time: { type: "string", description: "HH:MM 24h" },
          title: { type: "string" },
          category: { type: "string", enum: ["school", "goal", "commitment", "hobby", "rest"] },
          is_locked: { type: "boolean" },
        },
        required: ["day_index", "start_time", "end_time", "title", "category"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_week_block",
      description: "Change an existing week block. Pick the id from week_blocks in context.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          day_index: { type: "number", minimum: 0, maximum: 6 },
          start_time: { type: "string" },
          end_time: { type: "string" },
          title: { type: "string" },
          category: { type: "string", enum: ["school", "goal", "commitment", "hobby", "rest"] },
          is_locked: { type: "boolean" },
        },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_week_block",
      description: "Remove a week block by id.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "regenerate_week",
      description: "Trigger a full week reshuffle that keeps locked blocks. Use when the user wants their whole week rebuilt.",
      parameters: {
        type: "object",
        properties: { note: { type: "string", description: "What the user wants changed; passed to the regenerator." } },
        additionalProperties: false,
      },
    },
  },
  // ─── Profile + preferences ───────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "update_profile",
      description: "Patch the user's profile fields (name, country, school year, education system, normal weekday).",
      parameters: {
        type: "object",
        properties: {
          display_name: { type: "string" },
          country: { type: "string" },
          school_year: { type: "string" },
          academic_context: { type: "string" },
          normal_weekday: { type: "string" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_tone",
      description: "Change the chat tone preference.",
      parameters: {
        type: "object",
        properties: { tone: { type: "string", enum: ["gentler", "default", "more_direct"] } },
        required: ["tone"],
        additionalProperties: false,
      },
    },
  },
];

const EXAM_EMERGENCY_TOOL = {
  type: "function",
  function: {
    name: "create_exam_emergency",
    description:
      "Called when a student mentions an upcoming exam, test, or mock. Collect intake data only — do NOT build the plan. Local code builds the plan from your collected fields.",
    parameters: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Subject name, e.g. 'Maths', 'Biology'" },
        exam_date_time: { type: "string", description: "ISO 8601 datetime, e.g. '2024-11-15T09:00:00'" },
        preparedness_score: { type: "number", description: "How prepared the student feels, 1–10" },
        target_outcome: { type: "string", enum: ["survive", "solid", "high_score"] },
        topics: {
          type: "array",
          description: "List of topics on the exam",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              confidence: { type: "number", minimum: 1, maximum: 5, description: "Student confidence 1–5" },
              mark_value: { type: "number", minimum: 1, maximum: 5 },
              likelihood: { type: "number", minimum: 1, maximum: 5 },
              time_cost: { type: "number", minimum: 1, maximum: 5 },
              quick_win_potential: { type: "number", minimum: 1, maximum: 5 },
            },
            required: ["name"],
          },
        },
        available_study_windows: {
          type: "array",
          items: {
            type: "object",
            properties: {
              start_time: { type: "string" },
              end_time: { type: "string" },
              day_label: { type: "string" },
              available_minutes: { type: "number" },
            },
          },
        },
        missing_fields: {
          type: "array",
          items: { type: "string" },
          description: "Fields still needed from the student",
        },
      },
      required: ["subject"],
      additionalProperties: false,
    },
  },
};

const EXAM_COPILOT_TOOL = {
  type: "function",
  function: {
    name: "exam_copilot",
    description:
      "Generate a study question, rate a student's answer, or extract task profile details for an active exam emergency. Use when the student wants to be tested, submits an answer for feedback, or pastes exam rubric/format information.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["generate_question", "rate_answer", "set_task_profile"],
          description: "generate_question: create a practice question. rate_answer: score student's answer. set_task_profile: extract exam format from pasted text.",
        },
        emergency_id: { type: "string", description: "ID of the active exam emergency" },
        question_type: {
          type: "string",
          enum: ["quick_quiz", "explain_back", "past_paper_style", "essay_plan", "definition", "formula", "weak_topic"],
        },
        topic_name: { type: "string" },
        question_text: { type: "string", description: "Complete standalone question the student can answer without more context" },
        model_answer: { type: "string", description: "What a good answer should contain" },
        hints: { type: "array", items: { type: "string" }, description: "Up to 2 hints" },
        answer_text: { type: "string", description: "Student's submitted answer (for rate_answer)" },
        question_id: { type: "string", description: "ID of the question being rated (for rate_answer)" },
        score_out_of: { type: "number", description: "Practice score estimate" },
        max_marks: { type: "number" },
        level: { type: "string", enum: ["needs_work", "developing", "solid", "strong"] },
        missing_points: { type: "array", items: { type: "string" }, description: "Up to 3 missing points" },
        upgrade_suggestion: { type: "string", description: "One concrete next action to improve the answer" },
        task_profile: {
          type: "object",
          description: "Extracted exam format info (for set_task_profile)",
          properties: {
            exam_format: { type: "string" },
            rubric_notes: { type: "string" },
            mark_allocation: { type: "string" },
            common_mistakes: { type: "string" },
            section_breakdown: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  marks: { type: "number" },
                  description: { type: "string" },
                },
              },
            },
          },
        },
      },
      required: ["action", "emergency_id"],
      additionalProperties: false,
    },
  },
};

const RESCUE_TOOL = {
  type: "function",
  function: {
    name: "create_rescue_plan",
    description:
      "Generate a structured rescue plan when the user has an urgent deadline they haven't started. Use when user expresses panic, 'haven't started', or a specific deadline under clear time pressure. Creates tasks automatically from the rescue steps.",
    parameters: {
      type: "object",
      properties: {
        task_title: { type: "string", description: "What the user needs to rescue, e.g. 'history essay'" },
        due_description: { type: "string", description: "When it's due, e.g. 'Friday', 'tomorrow morning', '3 hours'" },
        current_status: { type: "string", description: "What exists so far, e.g. 'haven't started', '300 words written'" },
        rescue_steps: {
          type: "array",
          items: { type: "string" },
          description: "3-6 concrete timed steps to complete the work. Each must say what to do and roughly how long. E.g. 'Write 3-point outline (10 min)'.",
          minItems: 3,
          maxItems: 6,
        },
        first_move: { type: "string", description: "The single first action — must take under 5 minutes and require zero preparation." },
        estimated_total_minutes: { type: "number", description: "Realistic total time to completion in minutes." },
        panic_reduction: { type: "string", description: "One honest line that shrinks the panic by naming what is actually achievable. Never say 'you got this'." },
      },
      required: ["task_title", "due_description", "rescue_steps", "first_move", "panic_reduction"],
      additionalProperties: false,
    },
  },
};

const SPECIALISATION_TOOLS = [
  {
    type: "function",
    function: {
      name: "patch_goal_model",
      description:
        "Update the active_goal fields after learning something new about where the user currently stands or what the pathway requires. Call when you have enough signal to set current_stage, knowns, or unknowns.",
      parameters: {
        type: "object",
        properties: {
          current_stage: { type: "string", description: "Honest one-line description of where the user is RIGHT NOW on the pathway to this goal." },
          target_stage: { type: "string", description: "The minimum-viable milestone that unlocks the next real stage." },
          reality_gap: { type: "string", description: "What is the honest distance between current_stage and target_stage?" },
          knowns: {
            type: "array",
            items: { type: "string" },
            description: "Facts you now know about the user's situation. Short strings.",
          },
          unknowns: {
            type: "array",
            items: { type: "string" },
            description: "Things that are still unclear and would change the plan if answered.",
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_first_task",
      description:
        "Create exactly one first task for the user. Call only when you are confident about their current stage and the best next move. The task must be stagewise appropriate — no premature tasks.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short, specific, actionable task title." },
          description: { type: "string", description: "One sentence on why this specific task, why now." },
          estimated_minutes: { type: "number", description: "Realistic time estimate in minutes." },
          category: {
            type: "string",
            enum: ["goal_direct", "bottleneck_removal", "maintenance", "discovery"],
          },
          why_now: { type: "string", description: "Why is this the right first move given where the user is?" },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
          resource_url: { type: "string", description: "REQUIRED if the first task involves any internet work (course, signup, watch/read online). Real, specific https URL to one consumable source — not a homepage, category page, or search results URL." },
          resource_label: { type: "string", description: "Short label for the URL. Required if resource_url is set." },
          elaborated_notes: {
            type: "array",
            minItems: 2,
            maxItems: 5,
            description: "REQUIRED. 2-5 substantive note paragraphs (~2-4 sentences each) elaborating the task: how to approach it, sub-steps, what to look for, pitfalls, and — if resource_url is set — what to extract from that resource. Concrete guidance, not motivation.",
            items: { type: "string" },
          },
        },
        required: ["title", "category", "why_now"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_specialisation",
      description:
        "Signal that the specialisation conversation is complete. Call when: you have called patch_goal_model at least once AND called create_first_task. Do not call prematurely.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  },
];

interface ChatSnapshot {
  display_name?: string;
  active_goal?: { statement?: string; long_term_goal?: string; medium_term_goal?: string; short_term_goal?: string; why_it_matters?: string; status?: string };
  task_notes_context?: Array<{ task_id: string; task_title: string; notes: Array<{ content: string; created_at: string }>; latest_review?: unknown }>;
  constraints_known?: Record<string, unknown>;
  missing_schedule_info?: string[];
  todays_plan?: Array<{ time: string; title: string; status: string }>;
  next_move?: { id: string; title: string; estimated_minutes: number } | null;
  recent_completed?: Array<{ title: string; at: string }>;
  pending_count?: number;
  recent_feedback?: Array<{ feedback: string; task_title: string; at: string }>;
  recent_rescue?: { reason: string; at: string } | null;
  latest_reflection?: { date: string; energy: number; win: string; struggle: string } | null;
  active_plan?: "plan_a" | "plan_b";
  forge_modules?: Array<{ name: string; type: string; runs: number }>;
  tone_preference?: string;
  // Extended
  user_age_bracket?: string;
  user_school_year?: string;
  user_academic_context?: string;
  user_normal_weekday?: string;
  onboarding_knowns?: string[];
  onboarding_unknowns?: string[];
  onboarding_answers?: Record<string, string>;
  goal_current_stage?: string;
  goal_target_stage?: string;
  goal_reality_gap?: string;
  goal_phase?: string;
  goal_appropriate_focus?: string[];
  goal_premature_tasks?: string[];
  goal_risk?: string;
  top_workstream?: { name: string; status: string; bottleneck: string } | null;
  completed_tasks_count?: number;
  country?: string;
  education_system?: string;
  recent_chat?: Array<{ role: string; content: string }>;
  pending_tasks?: Array<{ id: string; title: string; minutes: number; priority: string }>;
  week_blocks?: Array<{ id: string; day_index: number; start_time: string; end_time: string; title: string; category: string; is_locked: boolean }>;
}

function latestUserMessage(messages: Array<{ role: string; content: string }>): string {
  return [...messages].reverse().find((m) => m.role === "user" && typeof m.content === "string")?.content?.trim() ?? "";
}

function isGreetingOnly(text: string): boolean {
  const normalized = text.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  return /^(hi|hey|hello|yo|sup|ok|okay|k|hii|hiya|how r u|how are you|hi how r u|hi how are you|hello how r u|hello how are you)$/.test(normalized);
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  return String(v);
}

function horizonFromSnap(snap: ChatSnapshot, key: "long" | "medium" | "short") {
  const direct = key === "long" ? snap.active_goal?.long_term_goal : key === "medium" ? snap.active_goal?.medium_term_goal : snap.active_goal?.short_term_goal;
  if (direct?.trim()) return direct.trim();
  const answerKey = key === "long" ? "long_term_goal" : key === "medium" ? "medium_term_goal" : "short_term_goal";
  const answer = snap.onboarding_answers?.[answerKey];
  if (answer?.trim()) return answer.trim();
  const source = snap.active_goal?.statement ?? "";
  const label = key === "long" ? "Long-term" : key === "medium" ? "Medium-term" : "Short-term";
  const match = source.match(new RegExp(`${label}:\\s*([^\\n|·]+?)(?=\\s*\\||$)`, "i"));
  if (match?.[1]?.trim()) return match[1].trim();
  return key === "long" ? source : "";
}

function specialisationSystemPrompt(snap: ChatSnapshot): string {
  const name = snap.display_name || "there";
  const _lt = horizonFromSnap(snap, "long");
  const _mt = horizonFromSnap(snap, "medium");
  const _st = horizonFromSnap(snap, "short");
  const goal = (_lt || _mt || _st)
    ? `Long-term: ${_lt || "(not set)"} · Medium-term: ${_mt || "(not set)"} · Short-term: ${_st || "(not set)"}`
    : (snap.active_goal?.statement || "(no goal set yet)");
  const why = snap.active_goal?.why_it_matters || "";
  const currentStage = snap.goal_current_stage || "";
  const targetStage = snap.goal_target_stage || "";
  const realityGap = snap.goal_reality_gap || "";
  const risk = snap.goal_risk || "low";
  const appropriate = snap.goal_appropriate_focus?.length
    ? snap.goal_appropriate_focus.join(", ")
    : "";
  const premature = snap.goal_premature_tasks?.length
    ? snap.goal_premature_tasks.join(", ")
    : "";

  const knowns = snap.onboarding_knowns?.length
    ? snap.onboarding_knowns.map((k) => `- ${k}`).join("\n")
    : "- (none captured yet)";

  const unknowns = snap.onboarding_unknowns?.length
    ? snap.onboarding_unknowns
    : [];

  const unknownsBlock = unknowns.length
    ? unknowns.map((u) => `- ${u}`).join("\n")
    : "- Nothing critical still missing.";

  const completedCount = snap.completed_tasks_count ?? 0;
  const completed = snap.recent_completed?.length
    ? snap.recent_completed.map((c) => `- ${c.title}`).join("\n")
    : "- (none yet)";

  const rawAnswers = snap.onboarding_answers && Object.keys(snap.onboarding_answers).length
    ? Object.entries(snap.onboarding_answers).map(([k, v]) => `- ${k}: ${v}`).join("\n")
    : "- (none captured)";

  const recentUserMessages = (snap.recent_chat ?? [])
    .filter((m) => m.role === "user")
    .slice(-8)
    .map((m) => `- "${m.content}"`)
    .join("\n");

  const country = snap.country || "unknown";
  const educationSystem = snap.education_system || "unknown";
  const schoolYear = snap.user_school_year || "";

  return `You are Moment in goal-specialisation mode — a ruthlessly focused post-onboarding calibration. Your job is to map exactly where ${name} currently stands on the path to their goal, then create the one most-stagewise-appropriate first task.

USER CONTEXT:
- Name: ${name}
- Country: ${country}
- Education system: ${educationSystem}${schoolYear ? ` · ${schoolYear}` : ""}
- Goal: ${goal}${why ? ` · Why: ${why}` : ""}
- Current stage: ${currentStage || "not yet assessed — this is what you must find out"}
- Target stage: ${targetStage || "not yet defined"}
- Reality gap: ${realityGap || "not yet assessed"}
- Risk of premature advice: ${risk}
${appropriate ? `- Appropriate focus now: ${appropriate}` : ""}
${premature && risk === "high" ? `- DO NOT SUGGEST TASKS INVOLVING: ${premature}` : ""}

ONBOARDING ANSWERS — these were provided during setup, DO NOT re-ask:
${rawAnswers}

ALREADY KNOWN FROM ONBOARDING — DO NOT ASK FOR ANY OF THESE:
${knowns}

WHAT THE USER SHARED IN THIS CONVERSATION — TREAT AS ANSWERED, DO NOT RE-ASK:
${recentUserMessages || "- (nothing yet this session)"}

COMPLETED TASKS (${completedCount} total):
${completed}

STILL UNKNOWN (work through these ONE AT A TIME, most important first):
${unknownsBlock}

YOUR PROCESS — follow this strictly:
1. Call patch_goal_model as soon as you can honestly assess current_stage, target_stage, reality_gap, or knowns/unknowns. Call it multiple times as you learn more.
2. Once you have a clear picture of where ${name} actually is right now, call create_first_task with the single most stagewise-appropriate first move.
3. Once you have called both patch_goal_model at least once AND create_first_task, call complete_specialisation.
4. If the user directly asks you to add, update, complete, delete, or schedule something, use the ordinary task/week tools immediately. Specialisation mode does not remove your omnipotent app-control role.

FIRST TASK RULES — NON-NEGOTIABLE:
- ZERO-RESEARCH-BURDEN: YOU do the research, not ${name}. Never create a first task that says "research", "look up", "find resources", "explore options", or "search for". Instead, name the specific resource yourself (a specific YouTube video, book, chapter, paper, Wikipedia article, course lesson, or article) and put its real deep-link https URL in resource_url with a precise resource_label naming the source. The first task should be a single concrete consume-and-act step.
- elaborated_notes (2-5 paragraphs) MUST tell ${name} what the resource covers, which specific sections/chapters/timestamps to focus on, what to extract, and the small output to produce.
- resource_url must deep-link to ONE specific item. Never a homepage or search results page.

STYLE — STRICT:
- Max 2 sentences. Often 1. Hard cap ~40 words.
- No preamble, no recap, no filler, no emojis.
- ONE question per reply, maximum. Make it specific to THIS goal and THIS user's stage.
- NEVER ask for anything listed under "ONBOARDING ANSWERS", "ALREADY KNOWN", or "WHAT THE USER SHARED". Asking again destroys trust.
- Call tools silently — do not announce what you are about to call or what you just saved.
- The task you create must be honest about where ${name} is right now. Not aspirational. Not premature.
- If ${name} is early-stage, the first task should build knowledge or proof, not jump to execution.
- After saving an answer, move to the NEXT unknown — never ask the same field twice.`;
}

function systemPrompt(snap: ChatSnapshot): string {
  const name = snap.display_name || "there";
  const _lt2 = horizonFromSnap(snap, "long");
  const _mt2 = horizonFromSnap(snap, "medium");
  const _st2 = horizonFromSnap(snap, "short");
  const goal = (_lt2 || _mt2 || _st2)
    ? `Long-term: ${_lt2 || "(not set)"} · Medium-term: ${_mt2 || "(not set)"} · Short-term: ${_st2 || "(not set)"}`
    : (snap.active_goal?.statement || "(no goal set yet)");
  const why = snap.active_goal?.why_it_matters || "";
  const known = snap.constraints_known ?? {};
  const knownLines = Object.keys(known).length
    ? Object.entries(known).map(([k, v]) => `- ${k}: ${fmt(v)}`).join("\n")
    : "- (none yet)";
  const missing = snap.missing_schedule_info?.length
    ? snap.missing_schedule_info.join(", ")
    : "none — schedule info is complete";
  const plan = snap.todays_plan?.length
    ? snap.todays_plan.map((b) => `- ${b.time} ${b.title} [${b.status}]`).join("\n")
    : "- (no plan yet)";
  const next = snap.next_move
    ? `${snap.next_move.title} (~${snap.next_move.estimated_minutes}m)`
    : "(none queued)";
  const completed = snap.recent_completed?.length
    ? snap.recent_completed.map((c) => `- ${c.title}${c.completed_at ? ` (done ${new Date(c.completed_at).toLocaleDateString()})` : ""}`).join("\n")
    : "- (none)";
  const fb = snap.recent_feedback?.length
    ? snap.recent_feedback.map((f) => `- ${f.feedback} on "${f.task_title}"`).join("\n")
    : "- (no feedback yet)";
  const rescue = snap.recent_rescue
    ? `${snap.recent_rescue.reason} at ${snap.recent_rescue.at}`
    : "(no recent rescue)";
  const refl = snap.latest_reflection
    ? `energy ${snap.latest_reflection.energy}/5 — win: ${snap.latest_reflection.win || "—"} · struggle: ${snap.latest_reflection.struggle || "—"}`
    : "(no reflections yet)";
  const modules = snap.forge_modules?.length
    ? snap.forge_modules.map((m) => `- ${m.name} (${m.type}, ${m.runs} runs)`).join("\n")
    : "- (no Forge modules active)";

  // New context fields
  const ageBracket = snap.user_age_bracket ?? "unknown";
  const schoolYear = snap.user_school_year ?? "";
  const country = snap.country ?? "";
  const educationSystem = snap.education_system ?? "unknown";
  const academicCtx = snap.user_academic_context ?? "";
  const currentStage = snap.goal_current_stage ?? "";
  const targetStage = snap.goal_target_stage ?? "";
  const realityGap = snap.goal_reality_gap ?? "";
  const goalPhase = snap.goal_phase ?? "";
  const risk = snap.goal_risk ?? "low";
  const appropriateFocus = snap.goal_appropriate_focus?.length
    ? snap.goal_appropriate_focus.join(", ")
    : "";
  const prematureTasks = snap.goal_premature_tasks?.length
    ? snap.goal_premature_tasks.join(", ")
    : "";
  const onboardingKnowns = snap.onboarding_knowns?.length
    ? snap.onboarding_knowns.join(", ")
    : "";
  const onboardingUnknowns = snap.onboarding_unknowns?.length
    ? snap.onboarding_unknowns.join(", ")
    : "";
  const rawAnswers = snap.onboarding_answers && Object.keys(snap.onboarding_answers).length
    ? Object.entries(snap.onboarding_answers).map(([k, v]) => `- ${k}: ${v}`).join("\n")
    : "none";
  const recentUserMessages = (snap.recent_chat ?? [])
    .filter((m) => m.role === "user")
    .slice(-8)
    .map((m) => `- "${m.content}"`)
    .join("\n");
  const topWorkstream = snap.top_workstream
    ? `${snap.top_workstream.name} (${snap.top_workstream.status}${snap.top_workstream.bottleneck ? ` — blocked: ${snap.top_workstream.bottleneck}` : ""})`
    : "(none)";
  const completedCount = snap.completed_tasks_count ?? 0;
  const taskNotes = snap.task_notes_context?.length
    ? JSON.stringify(snap.task_notes_context.slice(-8)).slice(0, 5000)
    : "none";

  const toneLine =
    snap.tone_preference === "gentler"
      ? "Tone: extra gentle. The user has asked for less pressure. Soften edges, never push."
      : snap.tone_preference === "more_direct"
      ? "Tone: be more direct. The user wants sharper, less hedged answers."
      : "Tone: warm but unsentimental. Sound like a thoughtful older friend.";

  // Portfolio snapshot — state-aware coaching block
  const portfolio = (snap as any).portfolio ?? null;
  const portfolioBlock = portfolio
    ? `PORTFOLIO SNAPSHOT (state-aware — reference these specifics, do not be generic):
- Completed today: ${portfolio.completed_today_count} (${
        portfolio.completed_today?.length
          ? portfolio.completed_today.map((t: any) => `"${t.title}"`).join(", ")
          : "nothing yet today"
      })
- Pending today: ${portfolio.pending_today_count}
- Overdue: ${portfolio.overdue_tasks?.length ?? 0}${
        portfolio.overdue_tasks?.length
          ? ` (${portfolio.overdue_tasks
              .slice(0, 3)
              .map((t: any) => `"${t.title}" due ${t.due_date.slice(0, 10)}`)
              .join("; ")})`
          : ""
      }
- Missed recent: ${portfolio.missed_tasks_recent?.length ?? 0}${
        portfolio.missed_tasks_recent?.length
          ? ` (${portfolio.missed_tasks_recent.slice(0, 3).map((t: any) => `"${t.title}"`).join(", ")})`
          : ""
      }
- Current block: ${
        portfolio.current_block
          ? `${portfolio.current_block.start_time}–${portfolio.current_block.end_time} "${portfolio.current_block.title}" [${portfolio.current_block.status}]`
          : "(none active right now)"
      }
- Next block: ${
        portfolio.next_block
          ? `${portfolio.next_block.start_time} "${portfolio.next_block.title}"`
          : "(nothing scheduled after this)"
      }
- Schedule pressure: ${portfolio.schedule_pressure} (${portfolio.pressure_reason})
- Top pressure task: ${
        portfolio.top_pressure_task
          ? `"${portfolio.top_pressure_task.title}" (~${portfolio.top_pressure_task.minutes}m, ${portfolio.top_pressure_task.priority})`
          : "(none)"
      }
- Recommended next move: ${
        portfolio.recommended_next_move
          ? `"${portfolio.recommended_next_move.title}" (~${portfolio.recommended_next_move.minutes}m)`
          : "(unset)"
      }
- Repeated friction tags: ${
        portfolio.repeated_friction_tags?.length
          ? portfolio.repeated_friction_tags.map((t: any) => `${t.tag} (${t.count}×)`).join(", ")
          : "none"
      }
- Alignment: ${portfolio.alignment_status} (drift ${portfolio.drift_score})
- Today's bottleneck: ${portfolio.constellation_status?.current_bottleneck || "(unset)"}
- Today's decisive move: ${portfolio.constellation_status?.decisive_move || "(unset)"}

PORTFOLIO-AWARE COACHING RULES:
- Reference the portfolio specifics by name (task title, block name, exact counts) — never paraphrase generically.
- If schedule_pressure is "high" or "critical", name the math directly: "${portfolio.pending_today_count} tasks, ~${portfolio.recommended_next_move?.minutes ?? 0}m on the top one, remaining time is short." Then protect the one task that matters most.
- If completed_today_count > 0, name a real completion before suggesting more work.
- If repeated_friction_tags has entries, acknowledge the pattern by name (e.g. "you've marked things too_big 3×") and shrink, don't push.
- If alignment_status is "drifting" or "overwhelmed", soften and narrow to one tiny next step — do not pile on tasks.
- If overdue_tasks exist, name the top one and suggest one small action on it (break_down, start_task), not a status report.
- Never say "you got this" or any motivational filler. Connect every line to a real portfolio entry above.`
    : "";

  return `You are Moment — a calm, sharp coach for an ambitious person named ${name}. Talk like a thoughtful older friend, never like a productivity app. ${toneLine}

STYLE — STRICT
- Max 2 sentences. Often 1. Hard cap ~40 words.
- No preamble ("Got it", "Sure", "Okay"), no recap of what they said, no filler.
- No emojis unless they use one first. No bullet lists. No headers.
- One question max per reply, and only if it actually moves things forward.
- Don't explain what you're about to do — just do it (call tools silently).
- If you have nothing sharp to say, say one specific thing about their next move or latest signal. Never generic encouragement.
- The latest user message is the command. If they ask a status/progress question, answer it directly from the data before suggesting action. If they greet you, respond naturally and continue the thread.
- Do not let tool calls hijack the reply. If you add/update a task, the visible reply must mainly answer the latest user message, then mention the saved change briefly.

KNOWN ABOUT THIS USER (DO NOT ASK FOR ANY OF THIS — you already have it):
- Age bracket: ${ageBracket}${schoolYear ? ` · ${schoolYear}` : ""}${academicCtx ? ` · ${academicCtx}` : ""}
- Country: ${country || "(unknown)"}
- Education system: ${educationSystem}
- Goal: ${goal}${why ? ` · Why: ${why}` : ""}
- Goal phase: ${goalPhase || "clarifying"}
- Current stage: ${currentStage || "not yet assessed"}
- Target stage: ${targetStage || "not yet defined"}
- Reality gap: ${realityGap || "not yet assessed"}
- Tasks completed overall: ${completedCount}
- Onboarding knowns: ${onboardingKnowns || "none captured yet"}
- Onboarding raw answers: ${rawAnswers}
- Schedule constraints known: ${knownLines}
- Top active workstream: ${topWorkstream}

WHAT THE USER SHARED THIS SESSION — DO NOT RE-ASK:
${recentUserMessages || "- (nothing yet)"}

WHAT MOMENT STILL DOESN'T KNOW (only ask ONE of these if relevant, not all):
${onboardingUnknowns ? `- ${onboardingUnknowns.split(", ").join("\n- ")}` : "- Nothing critical is missing."}

SCHEDULE INFO STILL MISSING: ${missing}

GOAL STAGE CONTEXT:
- Risk of premature advice: ${risk}
${appropriateFocus ? `- Appropriate focus for this user now: ${appropriateFocus}` : ""}
${prematureTasks && risk === "high" ? `- DO NOT suggest tasks involving: ${prematureTasks}` : ""}

TODAY'S PLAN:
${plan}

NEXT MOVE: ${next}

${portfolioBlock}

RECENTLY COMPLETED (${completedCount} total):
${completed}

TASK FEEDBACK SIGNALS (how work is landing — use these specifically in companion mode):
${fb}

SAVED TASK NOTES + NOTE MINI-LESSONS (durable context — use these to remember what the user learned and what gaps were identified):
${taskNotes}

LAST RESCUE SIGNAL: ${rescue}
LATEST REFLECTION: ${refl}

ACTIVE FORGE MODULES:
${modules}

OPEN TASKS (id · title · minutes · priority) — use these ids for update_task/complete_task/delete_task:
${(snap.pending_tasks ?? []).length
  ? snap.pending_tasks!.map((t) => `- ${t.id} · ${t.title} · ${t.minutes}m · ${t.priority}`).join("\n")
  : "- (none)"}

WEEK CALENDAR BLOCKS (id · day · time · title · category) — use these ids for update_week_block/delete_week_block. Days: 0=Mon..6=Sun:
${(snap.week_blocks ?? []).length
  ? snap.week_blocks!.slice(0, 60).map((b) => `- ${b.id} · d${b.day_index} ${b.start_time}-${b.end_time} · ${b.title} · ${b.category}${b.is_locked ? " · locked" : ""}`).join("\n")
  : "- (empty week)"}

OMNIPOTENT TOOLS — you can change ANY of the user's data when they ask. Always call tools silently then reply briefly:
- add_task / update_task / complete_task / delete_task (use ids from OPEN TASKS).
- add_week_block / update_week_block / delete_week_block (use ids from WEEK CALENDAR BLOCKS). For NEW blocks, pick reasonable day_index and HH:MM 24h times between 07:00 and 22:00.
- regenerate_week when the user wants the whole week rebuilt; pass their note.
- update_profile / set_tone for personal preferences.
- update_constraints / add_fixed_commitment / set_goal as before.
Never invent ids. If the user references a task or block by name, find the matching id in the lists above (case-insensitive). If no match, ask which one they mean.

TASK CREATION RULES — NON-NEGOTIABLE:
- HARD CAP: never present more than 3 pending tasks as today's work. If the user asks to add a task when today already has 3, you may still call add_task, but frame it as queued/deferred unless it replaces a current item.
- Every add_task call MUST include elaborated_notes (2-5 substantive paragraphs of concrete guidance — what to do, what to extract, what to produce).
- ZERO-RESEARCH-BURDEN RULE: YOU do the research, never the user. NEVER create tasks like "research X", "look up Y", "find resources on Z", "explore options", "search for tutorials". Those are admin and are banned. Instead, name the specific resource yourself — a specific YouTube video, a specific book/chapter, a specific Wikipedia article, a specific paper, a specific course lesson, a specific article — and put its real deep-link https URL in resource_url with a precise resource_label naming the source (e.g. "Marcus Aurelius — Meditations, Book II (Project Gutenberg)", "3Blue1Brown — Essence of Calculus, Ch.1"). The user only consumes and acts; they never go hunting.
- resource_url MUST deep-link to ONE specific consumable item. Never a homepage, never a search results page, never a category index, never a Google search URL.
- If the task is purely offline (writing on paper, going outside, speaking to a person), omit resource_url. Otherwise it is required.

PROGRESS ANSWERS — when asked "how am I progressing", "what have I done", or similar:
- Answer with the actual completed count, recent completed titles if any, pending count, next move, and the most relevant recent feedback signal.
- If completed count is 0, say that clearly but do not sound broken; point to the first pending task as the next proof.


${!snap.missing_schedule_info?.length
  ? `COMPANION MODE — Schedule and profile are COMPLETE.
DO NOT ask about schedule or onboarding. The user's setup is done.

YOUR JOB NOW:
- Be a calm, knowledgeable thinking partner about the user's actual journey.
- Reference what you can see: their next task, recent completions (above), feedback patterns, latest reflection.
- If they sound stuck or low, use CBT-informed coaching: name the specific friction, help them find a tiny first step, check the evidence before catastrophising.
- If they completed something hard, acknowledge it specifically using the task title — not generically.
- If they missed something, help them understand why (energy? task too big? wrong time?) without guilt.
- Translate vague emotion into a concrete next action.
- If the user has recent feedback signals (see TASK FEEDBACK SIGNALS above), reference them directly. Example: "You marked the biology task as hard — want me to shrink today's version?"
- NEVER say "you got this" or similar generic encouragement. Always tie your reply to something real from their data.
- CORRECTION HANDLING: If the user corrects or updates schedule/profile info ("actually school ends at 3:30 now"), save the correction via update_constraints or add_fixed_commitment immediately, acknowledge briefly, then return to companion behaviour. Do NOT restart onboarding.
- SAFETY: If the user expresses serious distress or crisis, respond safely, acknowledge them warmly, and strongly suggest they speak to a trusted adult. Do not act as a therapist.
- Max 2 sentences. Often 1. Hard cap ~40 words. No bullet lists. No headers.`
  : `RULES — NON-NEGOTIABLE
1. NEVER ask for anything listed under "KNOWN ABOUT THIS USER". Asking again destroys trust.
2. NEVER ask for onboarding fields that appear in "Onboarding knowns". These are already answered.
3. If information is truly missing, ask ONE question per reply — not two, not three. Pick the HIGHEST priority missing field and ask only that.
4. Priority order for missing schedule fields: school_end_time → commute_minutes → study_minutes_daily → exercise_minutes_daily → fixed_commitments → energy_pattern. Skip any that are already in constraints_known.
5. When the user shares a schedule fact, call update_constraints immediately. Do not announce the save. Ask the next missing field in the same reply.
6. FIXED COMMITMENTS RULE: If the user says "none", "no", "nothing", "not really", "I don't have any", "no fixed commitments" — call update_constraints with {fixed_commitments_checked: true} and move on. NEVER ask for fixed_commitments again after this.
7. If the user mentions a recurring commitment (sport, tutoring, music, job, club), call add_fixed_commitment.
8. If the user states or refines their goal, call set_goal.
9. Reference what you can SEE — their next move, recent feedback, last rescue, plan — when relevant.
10. Reply MUST be 1–2 sentences, under ~40 words. ALWAYS produce a non-empty reply even when calling tools.
11. If the user is venting or stuck, acknowledge first. The feedback signals tell you when to soften.
12. Never produce generic productivity advice. Every statement must connect to THIS goal and THIS user's actual situation. Never repeat the user's words back to them.
13. If the user says "I already told you", "I already said that", "you already asked", or similar — apologise briefly, infer the answer from recent_chat if possible, save it, and move to the next field. Never defend yourself or ask the same question again.`
}

${renderPortfolio((snap as any)?.learning_portfolio)}`;
}

function renderPortfolio(p: any): string {
  if (!p) return "";
  const ls = p.lifetime_stats ?? {};
  const lines: string[] = [];
  lines.push(`LEARNING PORTFOLIO (the user's progressive record — always reference; never act like this is day one):`);
  lines.push(`- Lifetime: ${ls.days_active ?? 0} days · ${ls.tasks_completed ?? 0}/${ls.tasks_total ?? 0} tasks (${Math.round((ls.completion_rate ?? 0) * 100)}%) · ${ls.notes_written ?? 0} notes · streak ${ls.streak_days ?? 0}d`);
  if (p.milestones?.length) lines.push(`- Milestones: ${p.milestones.join(" · ")}`);
  if (p.completed_work?.length) lines.push(`- Recently completed: ${p.completed_work.slice(0, 8).map((c: any) => `"${c.title}"`).join(" | ")}`);
  if (p.mini_lessons_learned?.length) {
    lines.push(`- Mini-lessons already taught (don't repeat):`);
    for (const l of p.mini_lessons_learned.slice(0, 4)) lines.push(`  · ${l.title}: ${(l.body ?? "").slice(0, 160)}`);
  }
  if (p.recurring_patterns?.common_struggles?.length) lines.push(`- Recurring struggles: ${p.recurring_patterns.common_struggles.join("; ")}`);
  if (p.recurring_patterns?.common_feedback?.length) lines.push(`- Feedback patterns: ${p.recurring_patterns.common_feedback.map((f: any) => `${f.label}×${f.count}`).join(", ")}`);
  if (p.open_threads?.length) lines.push(`- In-flight: ${p.open_threads.slice(0, 6).map((t: any) => t.text).join(" | ")}`);
  lines.push(`RULE: Reference progress. Don't re-teach. Build on what they've done.`);
  return lines.join("\n");
}

// ---------- anti-repeat helpers ----------
function normaliseQ(s: string): string {
  return s.toLowerCase().replace(/[^\w\s?]/g, " ").replace(/\s+/g, " ").trim();
}
function wordSet(s: string): Set<string> {
  const stop = new Set(["the","a","an","is","are","you","your","what","s","to","of","in","on","for","do","does","i","me","my","and","or","it","this","that","with","at","be","have","has","one"]);
  return new Set(normaliseQ(s).split(" ").filter((w) => w && w.length > 1 && !stop.has(w)));
}
function similarity(a: string, b: string): number {
  const A = wordSet(a), B = wordSet(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / new Set([...A, ...B]).size;
}
function isRepeat(candidate: string, history: string[]): boolean {
  const c = normaliseQ(candidate);
  if (!c) return false;
  for (const h of history) {
    const nh = normaliseQ(h);
    if (!nh) continue;
    if (nh === c) return true;
    if (similarity(candidate, h) >= 0.6) return true;
  }
  return false;
}

// No hardcoded fallback questions — the model is fully self-deterministic.

async function callGateway(body: unknown, apiKey: string) {
  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { messages, snapshot, context_packet, mode, kernel, coach_context } = body ?? {};
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── KERNEL PATH: relational Coach with structured JSON response ──────────
    if (kernel === true && coach_context) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const ctx = coach_context as {
        surface: string;
        inferred: { state: string; confidence: number; evidence: string[] };
        packet: Record<string, unknown>;
      };
      const p = ctx.packet ?? {};
      const goal = (p as any).active_goal ?? {};
      const memory = (p as any).moment_memory ?? {};
      const planPressure = (p as any).plan_pressure ?? {};
      const portfolioRecent = ((p as any).portfolio_recent_entries ?? []) as Array<{ title: string; type: string }>;
      const reviewQueue = ((p as any).review_queue ?? []) as Array<{ title: string; key_lesson: string }>;
      const adaptations = ((p as any).recent_adaptations ?? []) as string[];

      const goalLine = goal.statement
        ? `${goal.statement}${goal.why_it_matters ? ` · why: ${goal.why_it_matters}` : ""}`
        : "(no goal locked yet)";

      const tone = (() => {
        switch (ctx.inferred?.state) {
          case "overloaded": return "User is overloaded. Do NOT motivate. Simplify. Protect the next 10 minutes.";
          case "stuck": return "User is stuck. No lecturing. Make the first step under 10 minutes, concrete.";
          case "drifting": return "User is drifting. No shame. Reconnect the next task to identity in ONE line.";
          case "recovering": return "User is recovering. Don't overpush. Acknowledge the comeback specifically.";
          case "confused": return "User is confused. Separate task from confusion. Plain ≤2 sentences.";
          case "low_confidence": return "User is low-confidence. Reference past proof. Tiny re-entry move.";
          case "avoidant": return "User is avoiding. Name it gently. Offer smaller version of the same task.";
          case "proud": return "User is proud. Celebrate specifically by task title. Offer next proof.";
          case "frustrated": return "User is frustrated. Acknowledge in one line. Name what's actually broken.";
          default: return "User is steady. Don't interrupt momentum. Tight reply.";
        }
      })();

      const system = `You are Moment Coach — not a chatbot. You are the voice of the user's own goal system, the friend who actually remembers, notices, and stays with them.

CORE STANCE
- Warmth + memory + logic + action — all four, or you have failed.
- Friendliness without intelligence feels fake. Intelligence without warmth feels cold. Be both.
- You are a loyal companion in the user's becoming. Not a therapist. Not a productivity bot.

EVERY TURN
1. Mirror the user briefly (one short, human line).
2. Reference one REAL specific from their state — task title, exact count, recent feedback, named pattern.
3. Give one honest interpretation.
4. Offer ONE next move (not five).
5. Attach 1–3 real actions when they help.
6. Ask AT MOST one follow-up question, only if the context cannot answer it.

HARD RULES
- NEVER re-ask anything already in the context. NEVER produce generic motivation ("you got this", "stay consistent", "follow your dreams"). NEVER diagnose. NEVER claim to be the user's only support. NEVER lecture.
- ≤2 sentences of prose. Hard cap ~50 words. Plain text. No emojis unless they used one first.
- If user shows serious distress, respond warmly and gently encourage them to talk to a trusted person.

CURRENT SURFACE: ${ctx.surface}

INFERRED STATE: ${ctx.inferred?.state} (confidence ${(ctx.inferred?.confidence ?? 0).toFixed(2)})
EVIDENCE: ${(ctx.inferred?.evidence ?? []).join(" · ")}

TONE RULE: ${tone}

GOAL: ${goalLine}
STAGE: ${goal.current_stage ?? "(unset)"} → ${goal.target_stage ?? "(unset)"}
NEXT PROOF: ${memory?.goal_profile?.next_proof ?? "(none)"}
BOTTLENECK: ${memory?.goal_profile?.bottleneck ?? "(none)"}

RECENT WINS: ${(memory?.recent_wins ?? []).slice(0, 3).join(" · ") || "(none)"}
RECENT STRUGGLES: ${(memory?.recent_struggles ?? []).slice(0, 3).join(" · ") || "(none)"}

PATTERNS: ${(memory?.current_patterns ?? []).slice(0, 3).map((x: any) => x.message).join(" · ") || "(none)"}

OPEN LOOPS: ${(memory?.open_loops ?? []).slice(0, 3).map((l: any) => `${l.title} (${l.days_open}d)`).join(" · ") || "(none)"}

REVIEW QUEUE: ${reviewQueue.slice(0, 3).map((r) => `${r.title} — ${r.key_lesson}`).join(" · ") || "(empty)"}

PORTFOLIO RECENT: ${portfolioRecent.slice(0, 5).map((e) => `${e.type}: ${e.title}`).join(" · ") || "(empty)"}

RECENT ADAPTATIONS: ${adaptations.slice(0, 3).join(" · ") || "(none)"}

PLAN PRESSURE: ${planPressure.pressure_detected ? `${planPressure.pressure_score}/10 — ${planPressure.pressure_message}` : "low"}

SITUATIONAL INTELLIGENCE — answer these before composing any reply:
1. What does this user want to become? (their goal + stage)
2. What are they supposed to be doing today? (active tasks, schedule)
3. What is emotionally happening right now? (inferred state + evidence)
4. What friction is blocking action? (repeated feedback patterns, overdue tasks)
5. What is the smallest useful next move? (name it specifically)
6. What should be saved from this exchange? (memory_to_save)
7. Does the plan need to change? (suggest plan_repair if yes)

RESCUE DETECTION — if the user mentions an urgent deadline they haven't started:
- Set mode to "rescue"
- Provide a rescue_plan with concrete steps
- The first_move must take under 5 minutes and require zero preparation
- The panic_reduction must name what IS achievable, not just reassure

EXAM EMERGENCY DETECTION — separate from rescue:
- Trigger when the user mentions an upcoming exam, test, or mock (any subject)
- Your job is to COLLECT intake data, NOT build the plan. Local code builds the plan.
- Extract whatever was mentioned: subject, exam time, topics, preparedness, available study time
- Set exam_intake.action to "ready_to_build" when you have subject + exam_date_time + topics
- Set exam_intake.action to "update" when you have some but not all required fields
- Set exam_intake.missing_fields to the list of what you still need
- Ask only ONE question in your reply for the first missing field
- Never ask for information already given in the conversation
- Do NOT call exam_intake if an active exam emergency already exists for the same subject
- Tone: "We are not trying to learn everything tonight. We are trying to protect marks."

EXAM COPILOT MODE (when student is in active exam prep):
- Use exam_copilot when: student asks to be tested, submits an answer for feedback, or pastes rubric/format text
- generate_question: pick the weakest topic (lowest confidence or most previous "needs_work" ratings). Generate a complete, standalone question with model_answer and 2 hints. question_text must be answerable without any extra context.
- rate_answer: score the student's answer (score_out_of + level). List up to 3 missing_points. Give exactly one upgrade_suggestion — a single concrete next action. NEVER say "you got X/Y marks" — frame as "practice estimate".
- set_task_profile: when student pastes rubric or describes exam format — extract exam_format, section_breakdown, rubric_notes, mark_allocation.
- NEVER rate without giving upgrade_suggestion.
- NEVER generate a question without model_answer.

OUTPUT FORMAT — STRUCTURED JSON ONLY. Return exactly this shape, no prose outside the JSON object:
{
  "mode": "next_move|plan_repair|emotional_support|review_memory|path_explanation|task_breakdown|forge_artifact|rescue|clarifying_question|celebrate",
  "reply": "string — the visible message",
  "inferred_state": "steady|stuck|overloaded|drifting|recovering|confused|low_confidence|avoidant|proud|frustrated",
  "confidence": 0..1,
  "evidence_used": ["short refs to real state"],
  "next_move": { "label": "string", "task_id": "optional", "estimated_minutes": optional } | null,
  "suggested_actions": [
    { "type": "task.shrink|task.split|task.mark_done|task.reject|task.create_proof|plan.repair_today|plan.make_lighter|plan.move_one_task|review.save_memory|forge.create_artifact|rescue.trigger|path.show_proof|explain.why_this_matters|exam.start_intake|exam.mark_block_done|exam.add_feedback", "label": "≤22 chars", "task_id": "optional", "needs_confirmation": optional }
  ],
  "memory_to_save": { "type": "friction|goal_clarity|learning_gap|win|open_loop", "content": "string", "confidence": 0..1 } | null,
  "follow_up_question": "string or null",
  "rescue_plan": {
    "task_title": "string",
    "due_description": "string",
    "first_move": "string — under 5 min, zero prep",
    "steps": ["step with time estimate", ...],
    "estimated_total_minutes": number,
    "panic_reduction": "one honest line naming what IS achievable"
  } | null,
  "exam_intake": {
    "action": "start|update|ready_to_build",
    "subject": "string or omit if unknown",
    "exam_date_time": "ISO 8601 or omit if unknown",
    "preparedness_score": 1-10 or omit,
    "target_outcome": "survive|solid|high_score or omit",
    "topics": [{ "name": "string", "confidence": 1-5, "mark_value": 1-5, "likelihood": 1-5, "time_cost": 1-5, "quick_win_potential": 1-5 }],
    "available_study_windows": [{ "start_time": "HH:MM", "end_time": "HH:MM", "day_label": "Today/Tomorrow", "available_minutes": number }],
    "missing_fields": ["field names still needed"]
  } | null,
  "exam_copilot": {
    "action": "generate_question|rate_answer|set_task_profile",
    "emergency_id": "string",
    "question_type": "quick_quiz|explain_back|past_paper_style|essay_plan|definition|formula|weak_topic or omit",
    "topic_name": "string or omit",
    "question_text": "complete standalone question or omit",
    "model_answer": "what a good answer contains or omit",
    "hints": ["hint 1", "hint 2"] or omit,
    "question_id": "string — required for rate_answer",
    "score_out_of": number or omit,
    "max_marks": number or omit,
    "level": "needs_work|developing|solid|strong or omit",
    "missing_points": ["up to 3 missing points"] or omit,
    "upgrade_suggestion": "one concrete next action or omit",
    "task_profile": { "exam_format": "string", "rubric_notes": "string", ... } or omit
  } | null
}
Max 3 suggested_actions. Action labels read like buttons. rescue_plan is null unless mode is rescue.`;

      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          max_tokens: 1500,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            ...(messages as Array<{ role: string; content: string }>).slice(-12),
          ],
        }),
      });

      if (!resp.ok) {
        const status = resp.status;
        const errText = await resp.text();
        console.error("coach kernel gateway error", status, errText);
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limited." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "Out of AI credits." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const data = await resp.json();
      const content = data?.choices?.[0]?.message?.content ?? "";
      let parsed: unknown = null;
      try { parsed = JSON.parse(content); } catch { parsed = null; }

      return new Response(
        JSON.stringify({
          reply: (parsed as any)?.reply ?? content,
          response: parsed,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── LEGACY PATH continues below ────────────────────────────────────────

    const isSpecialisation = mode === "goal_specialisation";
    const latestUser = latestUserMessage(messages as Array<{ role: string; content: string }>);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // All prior assistant turns — anything in here is FORBIDDEN to repeat.
    const priorAssistant: string[] = (messages as Array<{ role: string; content: string }>)
      .filter((m) => m.role === "assistant" && typeof m.content === "string")
      .map((m) => m.content.trim())
      .filter(Boolean);

    const baseSystem = isSpecialisation
      ? specialisationSystemPrompt((snapshot ?? {}) as ChatSnapshot)
      : systemPrompt((snapshot ?? {}) as ChatSnapshot);

    const noRepeatBlock = priorAssistant.length
      ? `\n\nALREADY ASKED — DO NOT REPEAT OR PARAPHRASE ANY OF THESE QUESTIONS. Ask something genuinely different:\n${priorAssistant.slice(-12).map((q, i) => `${i + 1}. ${q}`).join("\n")}`
      : "";

    const contextBlock = context_packet
      ? `\n\nFULL CONTEXT PACKET — authoritative app state. Use it to answer the latest message, not generic memory:\n${JSON.stringify(context_packet).slice(0, 9000)}`
      : "";

    const latestBlock = latestUser
      ? `\n\nLATEST USER MESSAGE — answer this directly first: "${latestUser}"${isGreetingOnly(latestUser) ? "\nThis is a greeting/check-in; respond like a live companion, not a task-status bot." : ""}`
      : "";

    const systemContent = baseSystem + contextBlock + latestBlock + noRepeatBlock +
      `\n\nHARD RULE: Never ask a question you have already asked, even rephrased. If the user gave a vague answer like "idk", do NOT repeat your question — instead offer 2–4 concrete options or pivot to a different angle. Never ignore the latest user message.`;

    const buildBody = (extraSystem?: string, textOnly = false) => ({
      model: "google/gemini-3-flash-preview",
      max_tokens: 2048,
      messages: [
        { role: "system", content: extraSystem ? systemContent + "\n\n" + extraSystem : systemContent },
        ...messages.slice(-20),
      ],
      ...(textOnly ? {} : { tools: isSpecialisation ? [...SPECIALISATION_TOOLS, ...TOOLS] : [...TOOLS, RESCUE_TOOL, EXAM_EMERGENCY_TOOL, EXAM_COPILOT_TOOL] }),
    });

    let resp = await callGateway(buildBody(), LOVABLE_API_KEY);

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "Out of AI credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await resp.text();
      console.error("ai gateway error", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let data = await resp.json();
    let choice = data.choices?.[0]?.message;
    let reply: string = (choice?.content || "").trim();
    let toolCalls = (choice?.tool_calls ?? []) as Array<{ id: string; function: { name: string; arguments: string } }>;

    // If the model repeated a prior question, retry once with explicit pushback.
    if (reply && isRepeat(reply, priorAssistant)) {
      console.log("chat-coach: detected repeat, retrying", { reply });
      const retry = await callGateway(
        buildBody(`Your previous draft repeated a question you already asked: "${reply}". Ask a DIFFERENT question that moves the conversation forward. If the user was vague, offer concrete multiple-choice options instead.`),
        LOVABLE_API_KEY,
      );
      if (retry.ok) {
        data = await retry.json();
        choice = data.choices?.[0]?.message;
        const retryReply = (choice?.content || "").trim();
        if (retryReply && !isRepeat(retryReply, priorAssistant)) {
          reply = retryReply;
          toolCalls = (choice?.tool_calls ?? []) as typeof toolCalls;
        }
      }
    }

    const patches = toolCalls.map((c) => {
      let args: Record<string, unknown> = {};
      try {
        args = typeof c.function.arguments === "string"
          ? JSON.parse(c.function.arguments)
          : (c.function.arguments as any);
      } catch (e) {
        console.error("bad tool args", e, c.function.arguments);
      }
      return { tool: c.function.name, args };
    });

    // If the model returned no text (e.g. only tool calls, or empty), ask it
    // once more to produce a self-determined reply. No hardcoded fallback
    // copy — the model must speak for itself.
    if (!reply) {
      const followup = await callGateway(
        buildBody(
          patches.length
            ? `You just called tools silently. Tool results this turn: ${JSON.stringify(patches).slice(0, 2000)}. Now write a 1–2 sentence reply that acknowledges the user-facing result in your own words and moves the conversation forward. Do not narrate the tool call. Do not say you cannot do it. Do not use generic filler.`
            : "Write a 1–2 sentence reply to the user in your own words. Do not return empty content. Do not use generic filler.",
          true,
        ),
        LOVABLE_API_KEY,
      );
      if (followup.ok) {
        const fdata = await followup.json();
        const fchoice = fdata.choices?.[0]?.message;
        const fReply = (fchoice?.content || "").trim();
        if (fReply && !isRepeat(fReply, priorAssistant)) {
          reply = fReply;
        } else if (fReply) {
          reply = fReply;
        }
      }
    }

    return new Response(JSON.stringify({ reply, patches }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat-coach error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

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
  active_goal?: { statement?: string; why_it_matters?: string; status?: string };
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

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  return String(v);
}

function specialisationSystemPrompt(snap: ChatSnapshot): string {
  const name = snap.display_name || "there";
  const goal = snap.active_goal?.statement || "(no goal set yet)";
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
  const goal = snap.active_goal?.statement || "(no goal set yet)";
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

  const toneLine =
    snap.tone_preference === "gentler"
      ? "Tone: extra gentle. The user has asked for less pressure. Soften edges, never push."
      : snap.tone_preference === "more_direct"
      ? "Tone: be more direct. The user wants sharper, less hedged answers."
      : "Tone: warm but unsentimental. Sound like a thoughtful older friend.";

  return `You are Moment — a calm, sharp coach for an ambitious person named ${name}. Talk like a thoughtful older friend, never like a productivity app. ${toneLine}

STYLE — STRICT
- Max 2 sentences. Often 1. Hard cap ~40 words.
- No preamble ("Got it", "Sure", "Okay"), no recap of what they said, no filler.
- No emojis unless they use one first. No bullet lists. No headers.
- One question max per reply, and only if it actually moves things forward.
- Don't explain what you're about to do — just do it (call tools silently).
- If you have nothing sharp to say, say one specific thing about their next move or latest signal. Never generic encouragement.

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

RECENTLY COMPLETED (${completedCount} total):
${completed}

TASK FEEDBACK SIGNALS (how work is landing — use these specifically in companion mode):
${fb}

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
}`;
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
    const { messages, snapshot, mode } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isSpecialisation = mode === "goal_specialisation";

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

    const systemContent = baseSystem + noRepeatBlock +
      `\n\nHARD RULE: Never ask a question you have already asked, even rephrased. If the user gave a vague answer like "idk", do NOT repeat your question — instead offer 2–4 concrete options or pivot to a different angle.`;

    const buildBody = (extraSystem?: string, textOnly = false) => ({
      model: "google/gemini-2.5-flash",
      max_tokens: 2048,
      messages: [
        { role: "system", content: extraSystem ? systemContent + "\n\n" + extraSystem : systemContent },
        ...messages.slice(-20),
      ],
      ...(textOnly ? {} : { tools: isSpecialisation ? [...SPECIALISATION_TOOLS, ...TOOLS] : TOOLS }),
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

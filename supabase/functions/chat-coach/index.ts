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
        "Save schedule info the user has just shared. ONLY include fields they explicitly answered in this message. Never include a field that is already in constraints_known.",
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
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  return String(v);
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
- Schedule constraints known: ${knownLines}
- Top active workstream: ${topWorkstream}

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

RECENT FEEDBACK (how tasks are landing):
${fb}

LAST RESCUE SIGNAL: ${rescue}
LATEST REFLECTION: ${refl}

ACTIVE FORGE MODULES:
${modules}

RULES — NON-NEGOTIABLE
1. NEVER ask for anything listed under "KNOWN ABOUT THIS USER". Asking again destroys trust.
2. NEVER ask for onboarding fields that appear in "Onboarding knowns". These are already answered.
3. If information is truly missing (appears under "WHAT MOMENT STILL DOESN'T KNOW"), ask ONE question naturally — never a checklist.
4. When the user shares a schedule fact, call update_constraints immediately. Do not announce the save. Ask the next missing field in the same reply.
5. If the user mentions a recurring commitment, call add_fixed_commitment.
6. If the user states or refines their goal, call set_goal.
7. Reference what you can SEE — their next move, recent feedback, last rescue, plan — when relevant.
8. Reply MUST be 1–2 sentences, under ~40 words. ALWAYS produce a non-empty reply even when calling tools.
9. If the user is venting or stuck, acknowledge first. The feedback signals tell you when to soften.
10. Never produce generic productivity advice. Every statement must connect to THIS goal and THIS user's actual situation. Never repeat the user's words back to them.`;
}

function specialisationSystemPrompt(snap: ChatSnapshot): string {
  const name = snap.display_name || "there";
  const goal = snap.active_goal?.statement || "(no goal set yet)";
  const why = snap.active_goal?.why_it_matters || "";
  const ageBracket = snap.user_age_bracket || "unknown";
  const schoolYear = snap.user_school_year || "";
  const currentStage = snap.goal_current_stage || "";
  const targetStage = snap.goal_target_stage || "";
  const realityGap = snap.goal_reality_gap || "";
  const onboardingKnowns = snap.onboarding_knowns?.length
    ? snap.onboarding_knowns.join(", ")
    : "";
  const constraintsKnownKeys = Object.keys(snap.constraints_known ?? {}).join(", ");

  return `You are Moment — sharp, honest, in calibration mode for ${name}.

GOAL: ${goal}${why ? `\nWHY IT MATTERS: ${why}` : ""}
USER: ${ageBracket}${schoolYear ? ` · ${schoolYear}` : ""}
Current stage: ${currentStage || "not yet assessed"} → Target: ${targetStage || "not yet defined"}
Reality gap: ${realityGap || "not yet assessed"}

ALREADY KNOWN (DO NOT ASK FOR ANY OF THESE):
${onboardingKnowns ? `- Onboarding answers: ${onboardingKnowns}` : "- (none captured yet)"}
${constraintsKnownKeys ? `- Schedule constraints: ${constraintsKnownKeys}` : ""}

PROTOCOL:
1. First reply: (a) name the pathway in 1 sentence, (b) state typical stages, (c) ask ONE locating question. No checklists.
2. As you learn, call patch_goal_model.
3. When stage is clear, call create_first_task with a STAGE-APPROPRIATE task (never premature).
4. After create_first_task, call complete_specialisation.

RULES:
- One question per reply, max 2 sentences (40 words).
- NEVER ask anything already captured in "ALREADY KNOWN" above.
- NEVER generic motivation. Reference THIS goal, THIS stage.
- Acknowledge before redirecting if user is venting.`;
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

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: isSpecialisation
              ? specialisationSystemPrompt((snapshot ?? {}) as ChatSnapshot)
              : systemPrompt((snapshot ?? {}) as ChatSnapshot),
          },
          ...messages.slice(-20),
        ],
        tools: isSpecialisation ? SPECIALISATION_TOOLS : TOOLS,
      }),
    });

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

    const data = await resp.json();
    const choice = data.choices?.[0]?.message;
    let reply: string = (choice?.content || "").trim();
    const toolCalls = (choice?.tool_calls ?? []) as Array<{
      id: string;
      function: { name: string; arguments: string };
    }>;

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

    // Server-side fallback so the client never has to render "(no reply)".
    const snap = (snapshot ?? {}) as ChatSnapshot;
    // After a save, drive forward with the next missing field — never "what else?"
    if (patches.length) {
      // Build a patched copy of known constraints to correctly determine what is still missing.
      const patchedKnown: Record<string, unknown> = { ...(snap.constraints_known ?? {}) };
      let patchedCommitmentCount = (typeof (snap.constraints_known as any)?.fixed_commitments === "number"
        ? (snap.constraints_known as any).fixed_commitments
        : 0) as number;
      for (const p of patches) {
        if (p.tool === "update_constraints") {
          for (const [k, v] of Object.entries(p.args)) patchedKnown[k] = v;
        } else if (p.tool === "add_fixed_commitment") {
          patchedCommitmentCount += 1;
          patchedKnown.fixed_commitments = patchedCommitmentCount;
        }
      }
      const stillMissing = (snap.missing_schedule_info ?? []).filter((f) => {
        const v = patchedKnown[f];
        if (f === "fixed_commitments") return patchedCommitmentCount === 0;
        return v === undefined || v === null || v === "" || v === 0;
      });
      if (stillMissing.length) {
        const field = stillMissing[0].replace(/_/g, " ");
        reply = reply || `Saved. What's your ${field}?`;
      } else if (!reply) {
        reply = snap.next_move
          ? `Saved. Your next move is "${snap.next_move.title}" (~${snap.next_move.estimated_minutes}m) — ready?`
          : "Saved. What's the one goal this app should be pointed at?";
      }
    }
    if (!reply) {
      if (snap.next_move) {
        reply = `Your next move is "${snap.next_move.title}" (~${snap.next_move.estimated_minutes}m). Want me to shrink it?`;
      } else if (snap.missing_schedule_info?.length) {
        reply = `Quick one — what's your ${snap.missing_schedule_info[0].replace(/_/g, " ")}?`;
      } else {
        reply = "I'm here. What's on your mind?";
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

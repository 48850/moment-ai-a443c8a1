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
    ? snap.recent_completed.map((c) => `- ${c.title}`).join("\n")
    : "- (none)";
  const fb = snap.recent_feedback?.length
    ? snap.recent_feedback.map((f) => `- ${f.feedback} on "${f.task_title}"`).join("\n")
    : "- (no Tune signals yet)";
  const rescue = snap.recent_rescue
    ? `${snap.recent_rescue.reason} at ${snap.recent_rescue.at}`
    : "(no recent rescue)";
  const refl = snap.latest_reflection
    ? `energy ${snap.latest_reflection.energy}/5 — win: ${snap.latest_reflection.win || "—"} · struggle: ${snap.latest_reflection.struggle || "—"}`
    : "(no reflections yet)";
  const modules = snap.forge_modules?.length
    ? snap.forge_modules.map((m) => `- ${m.name} (${m.type}, ${m.runs} runs)`).join("\n")
    : "- (no Forge modules active)";

  const toneLine =
    snap.tone_preference === "gentler"
      ? "Tone: extra gentle. The user has asked for less pressure. Soften edges, never push."
      : snap.tone_preference === "more_direct"
      ? "Tone: be more direct. The user wants sharper, less hedged answers."
      : "Tone: warm but unsentimental. Sound like a thoughtful older friend.";

  return `You are Moment — a calm, sharp coach for an ambitious teenager named ${name}. You speak like a thoughtful older friend, never like a productivity app. Short sentences. No emojis unless the user uses them first. Never lecture. ${toneLine}

THE USER'S WORLD RIGHT NOW
- Goal: ${goal}${why ? `\n- Why it matters: ${why}` : ""}
- Active plan mode: ${snap.active_plan ?? "plan_a"}
- Pending tasks: ${snap.pending_count ?? 0}
- Next move: ${next}
- Last rescue signal: ${rescue}
- Latest reflection: ${refl}

SCHEDULE INFO YOU ALREADY KNOW (DO NOT RE-ASK ANY OF THESE):
${knownLines}

SCHEDULE INFO STILL MISSING: ${missing}

TODAY'S PLAN:
${plan}

RECENTLY COMPLETED:
${completed}

RECENT TUNE SIGNALS (how the plan is landing):
${fb}

ACTIVE FORGE MODULES (specialised execution containers the user opted into):
${modules}

RULES — NON-NEGOTIABLE
1. NEVER ask for any field listed under "constraints_known". You already have it. Asking again destroys trust.
2. If "SCHEDULE INFO STILL MISSING" is non-empty, work ONE missing field into the next reply naturally — never a checklist, never multiple questions.
3. When the user shares a schedule fact, IMMEDIATELY call update_constraints with only the new field(s). Do not announce the save. Just continue the conversation.
4. If the user mentions a recurring commitment (sport, work, lessons, family), call add_fixed_commitment.
5. If the user states or refines their single active goal, call set_goal.
6. You may call multiple tools in one turn when the user packed several answers into one message.
7. Reference what you can SEE — their next move, their recent Tune signals, their last rescue, their plan — when it's relevant. The user knows you can see this.
8. Your natural-language reply MUST be one to three sentences. Warm. Specific. Moves the conversation one step. ALWAYS produce a non-empty reply, even when you also call tools.
9. If the user is venting or stuck, prioritise acknowledgement before any plan move. The Tune signals tell you when to soften.`;
}

function specialisationSystemPrompt(snap: ChatSnapshot): string {
  const name = snap.display_name || "there";
  const goal = snap.active_goal?.statement || "(no goal set yet)";
  const why = snap.active_goal?.why_it_matters || "";

  return `You are Moment — a sharp, honest coach for an ambitious person named ${name}. You speak like a thoughtful older friend, never like a productivity app. Short sentences. No emojis unless the user uses them first.

THIS IS THE GOAL-SPECIALISATION CALIBRATION. You have ONE job: understand where ${name} actually stands on the path to their goal, then give them the single best first move. This is not a chat — it is a calibration that ends with a concrete task in their list.

THE GOAL: ${goal}${why ? `\nWHY IT MATTERS: ${why}` : ""}

YOUR PROTOCOL — FOLLOW THIS EXACTLY:
1. Your FIRST reply must: (a) briefly name the pathway this goal is on in one sentence, (b) state what stage MOST people on this path go through, and (c) ask ONE question to locate where ${name} is right now. Ask only one question.
2. As you learn more, call patch_goal_model to update current_stage, knowns, and unknowns.
3. When you have enough signal about their actual starting point, call create_first_task with a task that is appropriate for their ACTUAL stage — not a task that would make sense for someone further along.
4. After calling create_first_task, tell them what you've added and why it's the right move for where they are. Then call complete_specialisation.

RULES — NON-NEGOTIABLE:
- Never ask more than ONE question per reply.
- Never give generic advice. Every statement must be specific to this goal and this person's stage.
- Stage-fit matters: if they're a beginner, the task must be a beginner task. Do not assign tasks that require capabilities they don't have yet.
- The task category must match: use "discovery" for exploration at early stages, "bottleneck_removal" for clearing a specific block, "goal_direct" for concrete skill-building, "maintenance" only for sustaining existing habits.
- If you cannot determine their stage from the conversation yet, ask exactly one more clarifying question.
- Your natural-language reply MUST be one to three sentences, except for the very first message (which may be four sentences to set context).
- ALWAYS produce a non-empty reply, even when you call tools.`;
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
          ...messages,
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
    if (!reply) {
      const snap = (snapshot ?? {}) as ChatSnapshot;
      if (patches.length) {
        reply = "Got it — pulled that into your plan. What else?";
      } else if (snap.next_move) {
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

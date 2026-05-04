// Coach-style chat that elicits Schedule Info constraints, sees the entire
// Moment state (goal, plan, next move, recent feedback, rescue, forge), and
// circulates updates back into state via structured tool calls.

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, snapshot } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
          { role: "system", content: systemPrompt((snapshot ?? {}) as ChatSnapshot) },
          ...messages,
        ],
        tools: TOOLS,
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

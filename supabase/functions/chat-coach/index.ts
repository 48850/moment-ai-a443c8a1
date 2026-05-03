// Coach-style chat that elicits Schedule Info constraints and circulates
// them across the app. Returns a final reply + structured patches the
// client applies via dispatch / applyPatch.

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
        "Save one or more pieces of schedule info the user has just shared (school end time, commute, bedtime, etc). Only include fields the user has explicitly answered.",
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
        "Lock in or refine the user's single active goal. Only call when user clearly stated a goal.",
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

interface Snapshot {
  display_name?: string;
  active_goal?: { statement?: string; why_it_matters?: string };
  constraints?: Record<string, unknown>;
  missing_schedule_info?: string[];
  recent_feedback?: string[];
}

function systemPrompt(snap: Snapshot): string {
  const name = snap.display_name || "there";
  const goal = snap.active_goal?.statement || "(no goal set yet)";
  const missing = snap.missing_schedule_info?.length
    ? snap.missing_schedule_info.join(", ")
    : "none";
  return `You are Moment — a calm, sharp coach for an ambitious teenager named ${name}. You speak like a thoughtful older friend, never like a productivity app. Short sentences. No emojis unless the user uses them first. Never lecture.

The user's active goal: ${goal}

PRIORITY: Schedule Info is the spine of every plan in this app. The following fields are still missing or unknown for this user: ${missing}. When natural in the conversation, ask ONE missing field at a time, in plain language ("what time does school usually end?"). When the user answers, immediately call the update_constraints tool with the structured value, then continue conversationally — do not announce that you saved it.

If the user mentions a recurring commitment (sport, work, lessons, family), call add_fixed_commitment.
If the user states or refines a goal, call set_goal.

You may call multiple tools in one turn when the user packed several answers into one message.

After tool calls, your natural-language reply should be one to three sentences: warm, specific, moves the conversation one step forward. Never ask more than one question per reply.`;
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
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt((snapshot ?? {}) as Snapshot) },
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
    const reply: string = choice?.content || "";
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

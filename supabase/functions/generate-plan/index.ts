// Generates a multi-horizon plan (days, weeks, months, years) based on user's goal.
// Uses Lovable AI Gateway with structured tool-calling output.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLAN_TOOL = {
  type: "function",
  function: {
    name: "emit_plan",
    description: "Return a structured multi-horizon plan toward the user's goal.",
    parameters: {
      type: "object",
      properties: {
        days: {
          type: "array",
          maxItems: 3,
          description: "Concrete actions for today only. Hard cap: 3 items.",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              detail: { type: "string", description: "Why this matters and how to do it." },
              when: { type: "string", description: "Day label, e.g. 'Today', 'Mon', 'Tue+Thu'." },
              estimated_minutes: { type: "number" },
            },
            required: ["title", "detail", "when", "estimated_minutes"],
          },
        },
        weeks: {
          type: "array",
          description: "Weekly outcomes for the next 4-8 weeks (3-6 items).",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              detail: { type: "string" },
              week_range: { type: "string", description: "e.g. 'Week 1', 'Weeks 2-3'." },
              outcome: { type: "string", description: "Visible signal of completion." },
            },
            required: ["title", "detail", "week_range", "outcome"],
          },
        },
        months: {
          type: "array",
          description: "Monthly milestones for the next 3-6 months.",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              detail: { type: "string" },
              month: { type: "string", description: "e.g. 'Month 1', 'Month 2-3'." },
              milestone: { type: "string" },
            },
            required: ["title", "detail", "month", "milestone"],
          },
        },
        years: {
          type: "array",
          description: "Yearly horizons / who you become (1-3 items).",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              detail: { type: "string" },
              year: { type: "string", description: "e.g. 'Year 1', 'Year 2'." },
              identity: { type: "string", description: "Identity / capability acquired." },
            },
            required: ["title", "detail", "year", "identity"],
          },
        },
        guiding_principle: {
          type: "string",
          description: "One short principle that ties the whole arc together.",
        },
      },
      required: ["days", "weeks", "months", "years", "guiding_principle"],
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { goal, why, context, snapshot, goal_horizons } = await req.json();
    if (!goal || typeof goal !== "string") {
      return new Response(JSON.stringify({ error: "Missing goal" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Distill the onboarding/context packet so the model plans for THIS user, not a generic one.
    const u = snapshot?.user ?? {};
    const ob = snapshot?.onboarding ?? {};
    const cr = snapshot?.current_reality ?? {};
    const prefs = u.preferences ?? {};
    const horizonFallback = (label: string) => {
      const source = `${goal ?? ""}\n${snapshot?.active_goal?.statement ?? ""}\n${snapshot?.active_goal?.success_definition ?? ""}`;
      return source.match(new RegExp(`${label}:\\s*([^\\n|·]+?)(?=\\s*\\||$)`, "i"))?.[1]?.trim() ?? "";
    };
    const longTerm = goal_horizons?.long_term_goal || snapshot?.active_goal?.long_term_goal || horizonFallback("Long-term") || goal;
    const mediumTerm = goal_horizons?.medium_term_goal || snapshot?.active_goal?.medium_term_goal || horizonFallback("Medium-term") || "";
    const shortTerm = goal_horizons?.short_term_goal || snapshot?.active_goal?.short_term_goal || horizonFallback("Short-term") || "";
    const taskNotes = (snapshot?.signals?.task_notes_context ?? []).slice(-8);
    const notesBlock = taskNotes.length
      ? `\n\nSAVED TASK NOTES + NOTE MINI-LESSONS (durable context; use these to avoid repeating advice and to build from what the user already learned):\n${JSON.stringify(taskNotes).slice(0, 5000)}`
      : "";
    const userBlock = `WHO THIS PLAN IS FOR (from onboarding — adapt every horizon to this):
- Name: ${u.display_name ?? "?"} · Age: ${u.age ?? "?"} (${u.age_bracket ?? "unknown"})${u.school_year ? ` · ${u.school_year}` : ""}
- Academic context: ${u.academic_context || "(none)"}
- Normal weekday: ${u.normal_weekday || "(unknown)"}
- Fixed commitments: ${(u.commitments ?? []).join(", ") || "(none)"}
- Available study minutes/day: ~${cr.available_study_minutes ?? 60}
- Energy pattern: ${cr.energy_pattern ?? "unknown"} · today: ${cr.today_energy ?? "unknown"}
- Preferences: tone=${prefs.tone ?? "?"} · strictness=${prefs.strictness ?? "?"} · schedule_style=${prefs.schedule_style ?? "?"} · support_style=${prefs.support_style ?? "?"}
- Onboarding ${ob.completed ? "complete" : "incomplete"} · unknowns: ${(ob.understanding?.unknowns ?? []).join(", ") || "(none)"}`;

    const system = `You are an elite life-design coach for ambitious teenagers. You translate a goal trio into a phased plan across four horizons: days, weeks, months, years. Be concrete, specific, age-appropriate, energising, never preachy. Every item should be doable and unmistakably move the goal forward. Avoid generic productivity fluff. ALWAYS calibrate to the user profile provided — never propose actions that conflict with their age, schedule, or onboarding-confirmed reality. Use short-term as the main source for days/weeks, medium-term for month-level milestones, and long-term only as the anchor/why. HARD CAP: the days array is today's work and must contain no more than 3 tasks.`;

    const user = `${userBlock}

Goal horizons:
- Long-term (years / anchor): ${longTerm || "(not set)"}
- Medium-term (this year / milestone): ${mediumTerm || "(not set)"}
- Short-term (next 2–6 weeks / next proof): ${shortTerm || "(not set)"}
Why it matters: ${why || "(not provided)"}
Context: ${context || "(not provided)"}
${notesBlock}

Produce a complete multi-horizon plan that fits the person above. Each horizon must contain DIFFERENT actions — days are tactical from the short-term goal, weeks are outcomes toward the short-term proof, months ladder into the medium-term milestone, and years stay anchored to the long-term direction.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        tools: [PLAN_TOOL],
        tool_choice: { type: "function", function: { name: "emit_plan" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit hit. Try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (resp.status === 402) {
        return new Response(
          JSON.stringify({ error: "Out of AI credits. Add funds in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = call?.function?.arguments;
    if (!args) {
      console.error("No tool call returned", JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({ error: "No structured plan returned" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const plan = typeof args === "string" ? JSON.parse(args) : args;

    return new Response(JSON.stringify({ plan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-plan error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

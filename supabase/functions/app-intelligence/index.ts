// Unified AI brain for Moment. One endpoint, many intents.
// Body: { intent: string, snapshot: any, payload?: any }
// Returns: { result: any } shaped per intent.

import { MOMENT_AI_DOCTRINE } from "../_shared/moment-ai-doctrine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-3-flash-preview";

// Canonical doctrine — replaces the old generic TONE string
const TONE = MOMENT_AI_DOCTRINE;

function tools(intent: string) {
  const T: Record<string, any> = {
    next_move_rationale: {
      name: "answer",
      description: "Explain why this single task matters right now.",
      parameters: {
        type: "object",
        properties: {
          why_now: { type: "string", description: "One sentence, energising, specific." },
          next_proof: { type: "string", description: "What concrete signal this unlocks next." },
        },
        required: ["why_now"],
        additionalProperties: false,
      },
    },
    reframe_rescue: {
      name: "answer",
      description: "Shrink a stuck task into a gentle next step.",
      parameters: {
        type: "object",
        properties: {
          reframed_title: { type: "string" },
          micro_steps: { type: "array", items: { type: "string" }, maxItems: 3 },
          gentle_note: { type: "string" },
        },
        required: ["reframed_title", "micro_steps"],
        additionalProperties: false,
      },
    },
    daily_debrief: {
      name: "answer",
      parameters: {
        type: "object",
        properties: {
          headline: { type: "string" },
          win: { type: "string" },
          friction: { type: "string" },
          tomorrow_intention: { type: "string" },
        },
        required: ["headline"],
        additionalProperties: false,
      },
    },
    goal_audit: {
      name: "answer",
      parameters: {
        type: "object",
        properties: {
          drift_score: { type: "number", minimum: 0, maximum: 100 },
          status: { type: "string", enum: ["aligned", "drifting", "overwhelmed", "recovering"] },
          reasons: { type: "array", items: { type: "string" }, maxItems: 4 },
          recommendation: { type: "string" },
        },
        required: ["drift_score", "status", "reasons", "recommendation"],
        additionalProperties: false,
      },
    },
    forge_modules: {
      name: "answer",
      description: "Propose 3 indispensable, build-ready feature modules for THIS user's goal.",
      parameters: {
        type: "object",
        properties: {
          modules: {
            type: "array",
            maxItems: 3,
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                module_type: { type: "string", enum: ["practice_system", "planner", "tracker", "rescue_protocol", "evidence_log"] },
                why: { type: "string" },
                config: {
                  type: "object",
                  properties: {
                    fields: { type: "array", items: { type: "object", properties: { key: { type: "string" }, label: { type: "string" }, kind: { type: "string", enum: ["number", "text", "rating"] } }, required: ["key", "label", "kind"], additionalProperties: false } },
                    steps: { type: "array", items: { type: "string" } },
                    drills: { type: "array", items: { type: "object", properties: { name: { type: "string" }, minutes: { type: "number" } }, required: ["name", "minutes"], additionalProperties: false } },
                    slots: { type: "array", items: { type: "object", properties: { label: { type: "string" }, cadence: { type: "string" } }, required: ["label", "cadence"], additionalProperties: false } },
                  },
                  additionalProperties: false,
                },
              },
              required: ["name", "description", "module_type", "config"],
              additionalProperties: false,
            },
          },
        },
        required: ["modules"],
        additionalProperties: false,
      },
    },
    rescue_protocol: {
      name: "answer",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          steps: { type: "array", items: { type: "string" }, maxItems: 4 },
          soft_note: { type: "string" },
        },
        required: ["title", "steps"],
        additionalProperties: false,
      },
    },
    suggest_tasks: {
      name: "answer",
      parameters: {
        type: "object",
        properties: {
          tasks: {
            type: "array",
            maxItems: 5,
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                estimated_minutes: { type: "number" },
                category: { type: "string", enum: ["goal_direct", "bottleneck_removal", "discovery", "maintenance"] },
                priority: { type: "string", enum: ["high", "medium", "low"] },
                why: { type: "string" },
                why_now: { type: "string", description: "Why this task fits the user's current stage — not generic motivation." },
                user_stage_fit: { type: "string", enum: ["strong", "okay", "weak", "premature"] },
              },
              required: ["title", "estimated_minutes", "category", "priority"],
              additionalProperties: false,
            },
          },
        },
        required: ["tasks"],
        additionalProperties: false,
      },
    },
    reflect_summary: {
      name: "answer",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string" },
          encouragement: { type: "string" },
        },
        required: ["pattern"],
        additionalProperties: false,
      },
    },
    mission_insight: {
      name: "answer",
      parameters: {
        type: "object",
        properties: {
          observation: { type: "string" },
          suggestion: { type: "string" },
        },
        required: ["observation"],
        additionalProperties: false,
      },
    },
    refine_task: {
      name: "answer",
      description: "Given a user's recent Tune feedback on a task, propose targeted edits.",
      parameters: {
        type: "object",
        properties: {
          changes: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              estimated_minutes: { type: "number" },
              priority: { type: "string", enum: ["high", "medium", "low"] },
            },
            additionalProperties: false,
          },
          reasoning: { type: "string" },
        },
        required: ["changes"],
        additionalProperties: false,
      },
    },
  };
  return T[intent];
}

function buildContextHeader(snapshot: any): string {
  const u = snapshot?.user ?? {};
  const display_name = u.display_name ?? "the user";
  const age = u.age;
  const age_bracket = u.age_bracket ?? "unknown";
  const school_year = u.school_year;
  const academic_context = u.academic_context ?? "";
  const normal_weekday = u.normal_weekday ?? "";
  const commitments = (u.commitments ?? []).join(", ");
  const tz = u.timezone ?? "";
  const prefs = u.preferences ?? {};
  const prefLine = `tone=${prefs.tone ?? "?"} · strictness=${prefs.strictness ?? "?"} · schedule_style=${prefs.schedule_style ?? "?"} · support_style=${prefs.support_style ?? "?"}`;

  const ob = snapshot?.onboarding ?? {};
  const onboarded = ob.completed ? "complete" : "incomplete";
  const knowns = (ob.understanding?.knowns ?? []).join("; ");
  const unknownsList = (ob.understanding?.unknowns ?? []).join(", ");
  const obAssumptions = (ob.understanding?.assumptions ?? []).join("; ");
  const obConfidence = ob.understanding?.confidence ?? "low";

  const current_stage = snapshot?.active_goal?.current_stage ?? "";
  const target_stage = snapshot?.active_goal?.target_stage ?? "";
  const reality_gap = snapshot?.active_goal?.reality_gap ?? "";
  const risk = snapshot?.active_goal?.feasibility?.risk_of_bad_advice ?? "low";
  const premature = (snapshot?.active_goal?.feasibility?.premature_recommendations ?? []).join(", ");
  const appropriate = (snapshot?.active_goal?.feasibility?.appropriate_focus_now ?? []).join(", ");
  const assumptions = (snapshot?.pursuit?.assumptions ?? []).join("; ");
  const capabilities = (snapshot?.pursuit?.capability_clusters ?? [])
    .map((c: any) => `${c.name}: ${c.status}`).join(", ");
  const active_mode = snapshot?.pursuit?.active_mode ?? "";
  const available_min = snapshot?.current_reality?.available_study_minutes ?? 60;
  const goal = snapshot?.active_goal?.statement || "(no goal set)";
  const why = snapshot?.active_goal?.why_it_matters || "";
  const fb = (snapshot?.signals?.recent_feedback ?? []).slice(-10).join(", ") || "none";
  const reflections = (snapshot?.signals?.recent_reflections ?? []).slice(-3);

  return `USER (captured during onboarding — treat as ground truth, never re-ask):
- Name: ${display_name}
- Age: ${age ?? "?"} (${age_bracket})${school_year ? ` · ${school_year}` : ""}
- Academic context: ${academic_context || "(none)"}
- Normal weekday: ${normal_weekday || "(unknown)"}
- Fixed commitments: ${commitments || "(none)"}
- Timezone: ${tz || "(unknown)"}
- Preferences: ${prefLine}

ONBOARDING: ${onboarded} (confidence: ${obConfidence})
- Knowns: ${knowns || "(none)"}
- Unknowns: ${unknownsList || "(none)"}
- Assumptions: ${obAssumptions || "(none)"}

GOAL: ${goal}
Why: ${why}
Current stage: ${current_stage || "unknown"} → Target: ${target_stage || "not set"}
Reality gap: ${reality_gap || "not yet assessed"}
Available study time: ~${available_min}min | Mode: ${active_mode || "default"}
Risk of bad advice: ${risk}${risk === "high" ? `\n⚠️ HIGH RISK: Do NOT generate tasks involving: ${premature}` : ""}${appropriate ? `\nAppropriate focus now: ${appropriate}` : ""}${unknownsList ? `\nWhat Moment still doesn't know: ${unknownsList} — do not invent these.` : ""}

Pursuit assumptions: ${assumptions || "none"}
Capabilities: ${capabilities || "not assessed"}

Signals — Feedback: ${fb} | Reflections: ${JSON.stringify(reflections)}`.trim();
}

function userPrompt(intent: string, snapshot: any, payload: any): string {
  const ctx = buildContextHeader(snapshot);
  const goal = snapshot?.active_goal?.statement || "(no goal set)";
  const current_stage = snapshot?.active_goal?.current_stage ?? "unknown";
  const target_stage = snapshot?.active_goal?.target_stage ?? "not defined";
  const risk = snapshot?.active_goal?.feasibility?.risk_of_bad_advice ?? "low";
  const premature = (snapshot?.active_goal?.feasibility?.premature_recommendations ?? []).join(", ");

  switch (intent) {
    case "next_move_rationale":
      return `${ctx}\n\nThe next task: "${payload?.task?.title}" (${payload?.task?.estimated_minutes ?? "?"}m).\nExplain why doing this now moves the goal forward. One vivid sentence. Be specific to THIS stage.`;

    case "reframe_rescue":
      return `${ctx}\n\nThe user is stuck on: "${payload?.task?.title}". Their note: "${payload?.note ?? ""}".\nShrink it. Keep the direction. Make the very next step impossible to avoid.`;

    case "daily_debrief":
      return `${ctx}\n\nToday's tasks: ${JSON.stringify(payload?.tasks ?? [])}\nGenerate a short, honest debrief. Plan-blame, not user-blame.`;

    case "goal_audit":
      return `${ctx}\n\nLast 14 days feedback: ${JSON.stringify(payload?.feedback ?? [])}\nReflections: ${JSON.stringify(payload?.reflections ?? [])}\nReport drift honestly. Suggest recommit / pivot / shrink.`;

    case "forge_modules":
      return `${ctx}

Interview answers: ${JSON.stringify(payload?.answers ?? [])}

Propose exactly 3 features that would feel indispensable to THIS user pursuing THIS goal. Rules:
- Names must reference the user's domain. Avoid generic words unless paired with a domain word.
- Each "why" must cite something the user actually said in the interview answers.
- Configs must be domain-specific with realistic signals, steps, or drills.
- Pick module_types that match the user's stated needs.`;

    case "rescue_protocol":
      return `${ctx}\n\nThe user feels: "${payload?.reason}". Give a gentle 3-4 step protocol. No motivation-speak.`;

    case "suggest_tasks":
      return `${ctx}

Current tasks: ${JSON.stringify(payload?.tasks ?? [])}

STAGE ENFORCEMENT:
The user is at stage: ${current_stage}.
Target stage: ${target_stage}.${risk === "high" ? `\n⚠️ This user is NOT at the professional/advanced stage yet. You MUST NOT generate tasks involving: ${premature}.` : ""}
Generate only tasks appropriate for their current stage.
For each task, include why_now (one sentence: why this fits their current stage specifically) and user_stage_fit.
Mark any task that is borderline premature as user_stage_fit: "premature" — the app will handle it appropriately.
Propose up to 5 tasks. Prefer foundational, exploratory, and pathway-clarity tasks for school-age users.`;

    case "reflect_summary":
      return `${ctx}\n\nReflections: ${JSON.stringify(payload?.reflections ?? [])}\nName one true pattern (energy, friction, timing). One line of honest encouragement.`;

    case "mission_insight":
      return `${ctx}\n\nPursuit model: ${JSON.stringify(snapshot?.pursuit ?? null)}\nWorkstream statuses: ${JSON.stringify(payload?.workstreams ?? [])}\nWhat's the one thing the user should notice about their pathway right now?`;

    case "refine_task":
      return `Goal: ${payload?.goal || goal}\n\nTask after first-pass shrink: ${JSON.stringify(payload?.task ?? {})}\nUser's Tune feedback: "${payload?.feedback}".\n\nRefine ONLY the fields that need it. Lead with the first physical step. Be specific to THIS goal.`;

    case "forge_guidebook":
      return `${ctx}

The user wants to forge a new ${payload?.feature_type ?? "custom"} feature.
Description from user: "${payload?.description ?? ""}"
Anchor goal: ${payload?.goal ?? goal}
Bottleneck (if any): ${payload?.bottleneck ?? "none"}

Return ONLY a JSON object (no prose, no markdown fences) shaped like a ForgeGuidebook draft, calibrated to THIS user's age/stage/onboarding context. Suggested fields:
{
  "title": string,                     // domain-specific, references the user's world
  "feature_type": "${payload?.feature_type ?? "custom"}",
  "purpose": string,                   // why this matters for THEIR goal
  "trigger": string,                   // when the user opens it
  "fields": [{ "key": string, "label": string, "kind": "number"|"text"|"rating" }],
  "steps": [string],                   // the protocol/run loop
  "success_signal": string,            // what "good" looks like
  "review_cadence": string             // e.g. "weekly", "after each session"
}
Be concrete. No generic productivity language. Reference what the user actually said.`;

    case "forge_feature_ai":
      return `${ctx}

You are executing a Forge feature run.
Function type: ${payload?.function_type ?? "analyze"}
Output contract (FOLLOW EXACTLY): ${payload?.prompt_contract ?? "Return JSON with a 'result' field."}
Inputs: ${JSON.stringify(payload?.inputs ?? {})}

Return ONLY the JSON object the contract describes — no prose, no markdown, no commentary. Calibrate to the user's stage and onboarding context above.`;

    default:
      return ctx;
  }
}

const FREEFORM_INTENTS = new Set(["forge_guidebook", "forge_feature_ai"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { intent, snapshot = {}, payload = {} } = await req.json();
    const isFreeform = FREEFORM_INTENTS.has(intent);
    const tool = isFreeform ? null : tools(intent);
    if (!isFreeform && !tool) {
      return new Response(JSON.stringify({ error: "Unknown intent" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY not configured");

    const body: Record<string, unknown> = {
      model: MODEL,
      messages: [
        { role: "system", content: TONE },
        { role: "user", content: userPrompt(intent, snapshot, payload) },
      ],
    };
    if (isFreeform) {
      body.response_format = { type: "json_object" };
    } else {
      body.tools = [{ type: "function", function: tool }];
      body.tool_choice = { type: "function", function: { name: "answer" } };
    }

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const status = resp.status;
      const msg =
        status === 429 ? "Rate limited. Try again in a moment." :
        status === 402 ? "Out of AI credits." :
        "AI gateway error";
      console.error("ai gateway", status, await resp.text());
      return new Response(JSON.stringify({ error: msg }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    let result: any = {};
    if (isFreeform) {
      const content = data.choices?.[0]?.message?.content ?? "";
      try {
        const cleaned = String(content).trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
        result = cleaned ? JSON.parse(cleaned) : {};
      } catch (e) { console.error("bad freeform json", e, content); }
    } else {
      const call = data.choices?.[0]?.message?.tool_calls?.[0];
      if (call) {
        try {
          result = typeof call.function.arguments === "string"
            ? JSON.parse(call.function.arguments)
            : call.function.arguments;
        } catch (e) { console.error("bad args", e); }
      }
    }
    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("app-intelligence error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

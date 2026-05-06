// Unified AI brain for Moment. One endpoint, many intents.
// Body: { intent: string, snapshot: any, payload?: any }
// Returns: { result: any } shaped per intent.
//
// Intents:
//  - next_move_rationale  → { why_now, next_proof }
//  - reframe_rescue       → { reframed_title, micro_steps[], gentle_note }
//  - daily_debrief        → { headline, win, friction, tomorrow_intention }
//  - goal_audit           → { drift_score, status, reasons[], recommendation }
//  - forge_modules        → { modules:[{name,description,module_type,why}] }
//  - rescue_protocol      → { title, steps[], soft_note }
//  - suggest_tasks        → { tasks:[{title,estimated_minutes,category,priority,why}] }
//  - reflect_summary      → { pattern, encouragement }
//  - mission_insight      → { observation, suggestion }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-3-flash-preview";

const TONE = `You are Moment — a calm, sharp coach for an ambitious teenager. Speak like a thoughtful older friend, never a productivity app. Short sentences. No emojis unless the user used one. Never preach. Never shame. When the plan is wrong, blame the plan, not the person. Be specific to THIS user's goal and signals — never generic.`;

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
      description: "Propose 3 indispensable, build-ready feature modules for THIS user's goal. Each must include a runnable config (fields/steps/drills/slots).",
      parameters: {
        type: "object",
        properties: {
          modules: {
            type: "array",
            maxItems: 3,
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Short, distinctive name." },
                description: { type: "string" },
                module_type: { type: "string", enum: ["practice_system", "planner", "tracker", "rescue_protocol", "evidence_log"] },
                why: { type: "string", description: "Why this user specifically needs it." },
                config: {
                  type: "object",
                  description: "Runnable config. Include the relevant shape for the module_type.",
                  properties: {
                    fields: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          key: { type: "string" },
                          label: { type: "string" },
                          kind: { type: "string", enum: ["number", "text", "rating"] },
                        },
                        required: ["key", "label", "kind"],
                        additionalProperties: false,
                      },
                    },
                    steps: { type: "array", items: { type: "string" } },
                    drills: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: { name: { type: "string" }, minutes: { type: "number" } },
                        required: ["name", "minutes"],
                        additionalProperties: false,
                      },
                    },
                    slots: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: { label: { type: "string" }, cadence: { type: "string" } },
                        required: ["label", "cadence"],
                        additionalProperties: false,
                      },
                    },
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
    forge_guidebook: {
      name: "answer",
      description: "Design a complete guidebook for a goal-related feature: inputs, AI functions, sections, safety rules.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          subtitle: { type: "string" },
          purpose: { type: "string" },
          bottleneck_addressed: { type: "string" },
          feature_type: { type: "string" },
          required_inputs: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                label: { type: "string" },
                type: { type: "string", enum: ["text", "textarea", "select", "scale", "number", "date"] },
                placeholder: { type: "string" },
                required: { type: "boolean" },
                options: { type: "array", items: { type: "string" } },
              },
              required: ["id", "label", "type"],
              additionalProperties: false,
            },
          },
          ai_functions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                description: { type: "string" },
                function_type: { type: "string", enum: ["generate", "rank", "critique", "score", "plan", "reflect", "diagnose", "rewrite", "summarize", "decide"] },
                prompt_contract: { type: "string" },
                input_sources: { type: "array", items: { type: "string" } },
                writes_to_state: { type: "boolean" },
                allowed_state_actions: { type: "array", items: { type: "string" } },
              },
              required: ["id", "name", "function_type", "prompt_contract"],
              additionalProperties: false,
            },
          },
          sections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                section_type: { type: "string", enum: ["input_panel", "ai_output", "saved_entries", "task_list", "scorecard", "timeline", "protocol_steps", "decision_result", "reflection_box", "audit_summary"] },
                description: { type: "string" },
                linked_ai_function_id: { type: "string" },
              },
              required: ["id", "title", "section_type"],
              additionalProperties: false,
            },
          },
          safety_rules: { type: "array", items: { type: "string" } },
        },
        required: ["title", "purpose", "required_inputs", "ai_functions", "sections"],
        additionalProperties: true,
      },
    },
    forge_feature_ai: {
      name: "answer",
      description: "Run a guidebook AI function. Return the structured result keys requested in the prompt.",
      parameters: {
        type: "object",
        properties: {
          next_action: { type: "string" },
          why: { type: "string" },
          today_tasks: { type: "array", items: { type: "string" } },
          summary: { type: "string" },
          score: { type: "number" },
          total_score: { type: "number" },
          proof_score: { type: "number" },
          notes: { type: "string" },
        },
        additionalProperties: true,
      },
    },
      name: "answer",
      description:
        "Given a user's recent Tune feedback on a task, propose targeted edits. ONLY return fields that should change. The heuristic engine has already applied a first-pass mutation; your job is to refine title clarity and description specificity for THIS goal.",
      parameters: {
        type: "object",
        properties: {
          changes: {
            type: "object",
            properties: {
              title: { type: "string", description: "Rewritten task title — concrete, first-step framed, under 80 chars." },
              description: { type: "string", description: "Optional one-sentence description with the actual first physical step." },
              estimated_minutes: { type: "number", description: "Override the estimate only if it's clearly wrong." },
              priority: { type: "string", enum: ["high", "medium", "low"] },
            },
            additionalProperties: false,
          },
          reasoning: { type: "string", description: "One sentence on why these edits help." },
        },
        required: ["changes"],
        additionalProperties: false,
      },
    },
  };
  return T[intent];
}

function userPrompt(intent: string, snapshot: any, payload: any): string {
  const goal = snapshot?.active_goal?.statement || "(no goal set)";
  const why = snapshot?.active_goal?.why_it_matters || "";
  const fb = (snapshot?.recent_feedback ?? []).slice(-10).join(", ") || "none";
  const reflections = (snapshot?.recent_reflections ?? []).slice(-3);

  const ctx = `Goal: ${goal}\nWhy it matters: ${why}\nRecent feedback signals: ${fb}\nRecent reflections: ${JSON.stringify(reflections)}`;

  switch (intent) {
    case "next_move_rationale":
      return `${ctx}\n\nThe next task: "${payload?.task?.title}" (${payload?.task?.estimated_minutes ?? "?"}m).\nExplain why doing this now moves the goal forward. One vivid sentence.`;
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
- Names must reference the user's domain (e.g. "Serve Toss Tracker" not "Practice Tracker"). Avoid generic words like "Daily", "System", "Loop" unless paired with a domain word.
- Each "why" must cite something the user actually said in the interview answers. One sentence.
- Configs must be domain-specific:
  • tracker fields: name the actual signals to log (e.g. {key:"first_serve_pct", label:"1st serve %", kind:"number"}). 2-4 fields.
  • rescue_protocol steps: 3-4 steps written for THIS goal's typical stall, not generic mindfulness.
  • practice_system drills: 3-5 drills with realistic minutes, named after real techniques in the domain.
  • planner slots: 2-4 slots with cadences that fit a teen's week.
- Pick module_types that match the user's stated needs (structure/depth/speed/accountability). Don't return 3 of the same type unless clearly warranted.`;
    case "rescue_protocol":
      return `${ctx}\n\nThe user feels: "${payload?.reason}". Give a gentle 3-4 step protocol. No motivation-speak.`;
    case "suggest_tasks":
      return `${ctx}\n\nCurrent tasks: ${JSON.stringify(payload?.tasks ?? [])}\nPropose up to 5 next tasks that move the goal forward. Concrete, atomic, sized to a teen's day.`;
    case "reflect_summary":
      return `${ctx}\n\nReflections: ${JSON.stringify(payload?.reflections ?? [])}\nName one true pattern (energy, friction, timing). One line of honest encouragement.`;
    case "mission_insight":
      return `${ctx}\n\nPursuit model: ${JSON.stringify(payload?.pursuit ?? null)}\nWorkstream statuses: ${JSON.stringify(payload?.workstreams ?? [])}\nWhat's the one thing the user should notice?`;
    case "refine_task":
      return `Goal: ${payload?.goal || goal}\n\nTask after first-pass shrink: ${JSON.stringify(payload?.task ?? {})}\nUser's Tune feedback: "${payload?.feedback}".\n\nRefine ONLY the fields that need it. Lead with the first physical step. If the title is already concrete, leave it alone (return an empty title — do not invent one). Be specific to THIS goal — never generic productivity-speak.`;
    case "forge_guidebook":
      return `${ctx}\n\nFeature type: ${payload?.feature_type}\nUser's description: "${payload?.description}"\nBottleneck (if any): ${payload?.bottleneck ?? ""}\n\nDesign a full Guidebook tailored to THIS goal. Generate concrete IDs (e.g. "input_context", "fn_generate"). 1–4 inputs, 1–3 AI functions, 2–4 sections that include at least an input_panel and an ai_output linked to the first function. Be domain-specific.`;
    case "forge_feature_ai":
      return `Feature: ${payload?.feature_title}\nFunction type: ${payload?.function_type}\nPrompt contract: ${payload?.prompt_contract}\nUser inputs: ${JSON.stringify(payload?.inputs ?? {})}\nExpected output keys: ${JSON.stringify(payload?.output_schema ?? {})}\n\nReturn only the keys the contract requires. Be specific and useful.`;
    default:
      return ctx;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { intent, snapshot = {}, payload = {} } = await req.json();
    const tool = tools(intent);
    if (!tool) {
      return new Response(JSON.stringify({ error: "Unknown intent" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!KEY) throw new Error("LOVABLE_API_KEY not configured");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: TONE },
          { role: "user", content: userPrompt(intent, snapshot, payload) },
        ],
        tools: [{ type: "function", function: tool }],
        tool_choice: { type: "function", function: { name: "answer" } },
      }),
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
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    let result: any = {};
    if (call) {
      try {
        result = typeof call.function.arguments === "string"
          ? JSON.parse(call.function.arguments)
          : call.function.arguments;
      } catch (e) { console.error("bad args", e); }
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

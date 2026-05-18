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
            maxItems: 3,
            description: "A focused set of useful next tasks. Quality over quantity.",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                estimated_minutes: { type: "number" },
                category: { type: "string", enum: ["goal_direct", "bottleneck_removal", "discovery", "maintenance"] },
                priority: { type: "string", enum: ["high", "medium", "low"] },
                why_now: { type: "string", description: "Why this task fits the user's current stage — not generic motivation." },
                proof_of_completion: { type: "string", description: "One concrete, observable thing the user produces or does that proves this task is done. Must be specific to this task." },
                user_stage_fit: { type: "string", enum: ["strong", "okay", "weak", "premature"] },
                resource_url: { type: "string", description: "REQUIRED if the task involves any online work. Real working https URL to a specific page, not a homepage." },
                resource_label: { type: "string", description: "Short label for the URL. Required whenever resource_url is set." },
                elaborated_notes: {
                  type: "array",
                  minItems: 2,
                  maxItems: 5,
                  description: "REQUIRED. 2-5 substantive note paragraphs (~2-4 sentences each) that elaborate the task: how to approach it, what to look for, common pitfalls, specific sub-steps, and — if there's a resource_url — what the user should extract or notice in that resource. Not fluff, not motivation. Concrete guidance the user can act on.",
                  items: { type: "string" },
                },
              },
              required: ["title", "estimated_minutes", "category", "priority", "why_now", "proof_of_completion", "elaborated_notes"],
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
    notes_quick_review: {
      name: "answer",
      description: "Review the user's task notes and teach them something specific based on what they wrote.",
      parameters: {
        type: "object",
        properties: {
          headline: { type: "string", description: "One tight sentence naming the through-line across these notes." },
          key_insights: {
            type: "array",
            minItems: 1,
            maxItems: 4,
            items: { type: "string", description: "A specific observation grounded in something the user actually wrote. Quote phrases when useful." },
          },
          gaps: {
            type: "array",
            maxItems: 3,
            items: { type: "string", description: "Something missing, vague, or worth probing further. Be concrete." },
          },
          mini_lesson: {
            type: "object",
            description: "A short teaching moment tied to the most useful concept in the notes.",
            properties: {
              title: { type: "string", description: "3-6 word lesson title." },
              body: { type: "string", description: "2-4 sentences. Teach the concept clearly with a concrete example tied to the user's goal and the notes. No motivational filler." },
            },
            required: ["title", "body"],
            additionalProperties: false,
          },
          next_step: { type: "string", description: "One concrete next move the user could take in <10 min based on this review." },
        },
        required: ["headline", "key_insights", "mini_lesson", "next_step"],
        additionalProperties: false,
      },
    },
    mission_insight: {
      name: "answer",
      parameters: {
        type: "object",
        properties: {
          observation: { type: "string", description: "Headline notice — one tight sentence the user should notice first." },
          suggestion: { type: "string", description: "Optional one-line nudge tied to the headline observation." },
          notices: {
            type: "array",
            description: "3 to 5 additional tailored notices, each grounded in a DIFFERENT signal from the user's actual mission state (velocity, drift, bottleneck, momentum, workstream imbalance, feedback pattern, stage progress, blind spot). No duplicates with the headline observation.",
            items: {
              type: "object",
              properties: {
                kind: { type: "string", enum: ["momentum", "bottleneck", "drift", "imbalance", "feedback_pattern", "stage_progress", "blind_spot", "risk", "celebrate"] },
                tone: { type: "string", enum: ["good", "warn", "bad", "neutral"] },
                title: { type: "string", description: "3-6 word label." },
                detail: { type: "string", description: "One sentence grounded in the user's actual data — name the workstream / number / pattern. No generic productivity talk." },
                next_step: { type: "string", description: "Optional concrete one-line next move." },
              },
              required: ["kind", "tone", "title", "detail"],
              additionalProperties: false,
            },
            minItems: 3,
            maxItems: 5,
          },
        },
        required: ["observation", "notices"],
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
    refine_user_task: {
      name: "answer",
      description: "Take a user's raw task line and refine it into a concrete, stage-appropriate proof tied to their goal.",
      parameters: {
        type: "object",
        properties: {
          refined_title: { type: "string", description: "Clear, concrete action. Verb-led. Specific. Max ~10 words." },
          why_now: { type: "string", description: "One sentence linking this task to the user's goal/current stage." },
          proof_of_completion: { type: "string", description: "One observable artefact or signal proving it's done." },
          estimated_minutes: { type: "number" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
          category: { type: "string", enum: ["goal_direct", "bottleneck_removal", "discovery", "maintenance"] },
          resource_url: { type: "string", description: "REQUIRED if the refined task involves online work (research, course, signup, watch/read online). Real, specific https URL." },
          resource_label: { type: "string", description: "Short label for the URL. Required if resource_url is set." },
        },
        required: ["refined_title", "why_now", "proof_of_completion", "estimated_minutes", "priority", "category"],
        additionalProperties: false,
      },
    },
    plan_reform: {
      name: "answer",
      description: "Explain why the plan needs to change and what adjustments to make.",
      parameters: {
        type: "object",
        properties: {
          explanation: { type: "string", description: "One to two sentences explaining why the plan is being adjusted based on feedback and recent task signals." },
          key_adjustments: { type: "array", items: { type: "string" }, maxItems: 3, description: "Specific changes being made." },
          focus_suggestion: { type: "string", description: "The single highest-leverage thing to focus on in the adjusted plan." },
        },
        required: ["explanation", "key_adjustments"],
        additionalProperties: false,
      },
    },
    week_regenerate: {
      name: "answer",
      description: "Regenerate the user's weekly liquid calendar based on their reform note. Return a complete 7-day plan as concrete blocks.",
      parameters: {
        type: "object",
        properties: {
          explanation: { type: "string", description: "One to two sentences explaining what changed and why, based on the user's note." },
          blocks: {
            type: "array",
            minItems: 5,
            description: "Full week plan. Include all kept blocks (especially locked ones) and any new/moved blocks. Times use 24h HH:MM. Days: 0=Mon..6=Sun.",
            items: {
              type: "object",
              properties: {
                day_index: { type: "number", minimum: 0, maximum: 6 },
                start_time: { type: "string", description: "HH:MM, 24-hour, between 07:00 and 22:00" },
                end_time: { type: "string", description: "HH:MM, 24-hour, after start_time, no later than 22:00" },
                title: { type: "string", description: "Specific block name (e.g. 'Bio recall drill', not 'Study')." },
                category: { type: "string", enum: ["school", "goal", "commitment", "hobby", "rest"] },
                notes: { type: "string" },
                is_locked: { type: "boolean" },
              },
              required: ["day_index", "start_time", "end_time", "title", "category"],
              additionalProperties: false,
            },
          },
        },
        required: ["explanation", "blocks"],
        additionalProperties: false,
      },
    },
    forge_guidebook_candidates: {
      name: "answer",
      description: "Generate exactly 3 distinct, specific, runnable Forge tool candidates.",
      parameters: {
        type: "object",
        properties: {
          candidates: {
            type: "array",
            minItems: 3,
            maxItems: 3,
            items: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  description: "Short specific name. NEVER 'Custom Feature', 'Analyser', 'AI Analysis'. Must reference the user's goal domain.",
                },
                feature_type: {
                  type: "string",
                  enum: ["drill_lab", "tracker", "planner", "decision_engine", "protocol",
                         "research_helper", "proof_builder", "coach_lens", "simulator", "custom"],
                },
                purpose: {
                  type: "string",
                  description: "One sentence: what problem this solves and for whom. Must name the goal domain.",
                },
                why_this_one: {
                  type: "string",
                  description: "Why this specific tool fits this user's CURRENT stage, not a generic reason.",
                },
                inputs: {
                  type: "array",
                  minItems: 1,
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      label: { type: "string" },
                      type: { type: "string", enum: ["text", "textarea", "select", "number", "date", "scale"] },
                      required: { type: "boolean" },
                      placeholder: { type: "string" },
                    },
                    required: ["id", "label", "type", "required"],
                    additionalProperties: false,
                  },
                },
                first_run_example: {
                  type: "string",
                  description: "Concrete example of what the user sees after clicking Run for the first time.",
                },
                creates: {
                  type: "array",
                  items: { type: "string", enum: ["task", "plan_block", "context_signal", "reflection"] },
                  description: "What useful outputs this tool can generate for the user.",
                },
              },
              required: ["title", "feature_type", "purpose", "why_this_one", "inputs", "first_run_example", "creates"],
              additionalProperties: false,
            },
          },
        },
        required: ["candidates"],
        additionalProperties: false,
      },
    },
    forge_guidebook: {
      name: "answer",
      description: "Generate a complete, build-ready, goal-specific Forge guidebook.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Short specific title for this tool. NEVER use 'Custom Feature', 'Analyser', or 'AI Analysis'.",
          },
          subtitle: { type: "string" },
          purpose: {
            type: "string",
            description: "One sentence naming the user's goal domain and what this tool helps them do.",
          },
          feature_type: {
            type: "string",
            enum: ["tracker", "protocol", "control_room", "drill_lab", "proof_builder",
                   "decision_engine", "planner", "simulator", "coach_lens", "research_helper", "custom"],
          },
          bottleneck_addressed: { type: "string" },
          required_inputs: {
            type: "array",
            minItems: 2,
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                label: { type: "string" },
                type: { type: "string", enum: ["text", "textarea", "number", "select", "scale"] },
                placeholder: { type: "string" },
                required: { type: "boolean" },
              },
              required: ["id", "label", "type"],
              additionalProperties: false,
            },
          },
          ai_functions: {
            type: "array",
            minItems: 2,
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string", description: "Human-readable mode name, e.g. 'Explain simply', 'Quiz me'" },
                function_type: {
                  type: "string",
                  enum: ["analyze", "generate_plan", "split_tasks", "score_quality", "rank_options",
                         "simulate", "challenge", "summarize", "extract_signals", "create_next_move"],
                },
                prompt_contract: {
                  type: "string",
                  description: "Exact output schema description, ≥60 chars, goal-domain specific.",
                },
                input_sources: { type: "array", items: { type: "string" } },
                writes_to_state: { type: "boolean" },
                allowed_state_actions: {
                  type: "array",
                  items: { type: "string", enum: ["task/create", "forge/log_signal", "feedback/add"] },
                },
              },
              required: ["id", "name", "function_type", "prompt_contract", "input_sources"],
              additionalProperties: false,
            },
          },
          sections: {
            type: "array",
            minItems: 3,
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                heading: { type: "string" },
                section_type: {
                  type: "string",
                  enum: ["input_panel", "ai_output", "saved_entries", "task_list",
                         "scorecard", "protocol_steps", "reflection_box"],
                },
                linked_ai_function_id: { type: "string" },
              },
              required: ["id", "heading", "section_type"],
              additionalProperties: false,
            },
          },
          state_writes: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                trigger: { type: "string" },
                action_type: { type: "string" },
                description: { type: "string" },
              },
              additionalProperties: false,
            },
          },
          safety_rules: { type: "array", items: { type: "string" } },
          suggested_next_task: {
            type: "object",
            properties: {
              title: { type: "string" },
              why_now: { type: "string" },
              proof_of_completion: { type: "string" },
              estimated_minutes: { type: "number" },
            },
            additionalProperties: false,
          },
        },
        required: ["title", "purpose", "feature_type", "required_inputs", "ai_functions", "sections", "state_writes"],
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
  const country = u.country ?? "";
  const education_system = u.education_system ?? "unknown";
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
  const longTerm = snapshot?.active_goal?.long_term_goal ?? "";
  const mediumTerm = snapshot?.active_goal?.medium_term_goal ?? "";
  const shortTerm = snapshot?.active_goal?.short_term_goal ?? "";
  const hasHorizons = Boolean(longTerm || mediumTerm || shortTerm);
  const goalStatement = snapshot?.active_goal?.statement || "(no goal set)";
  const goal = hasHorizons
    ? `\n  • Long-term (years): ${longTerm || "(not set)"}\n  • Medium-term (this year): ${mediumTerm || "(not set)"}\n  • Short-term (this month): ${shortTerm || "(not set)"}`
    : ` ${goalStatement}`;
  const why = snapshot?.active_goal?.why_it_matters || "";

  const fb = (snapshot?.signals?.recent_feedback ?? []).slice(-10).join(", ") || "none";
  const reflections = (snapshot?.signals?.recent_reflections ?? []).slice(-3);

  const recentChat = (snapshot?.recent_chat ?? []) as Array<{ role: string; content: string }>;
  const chatBlock = recentChat.length
    ? `\nRECENT CHAT (last ${recentChat.length} turns — use to avoid repeating yourself):\n` +
      recentChat.map((m) => `${m.role === "user" ? "User" : "Moment"}: ${m.content}`).join("\n")
    : "";

  return `USER (captured during onboarding — treat as ground truth, never re-ask):
- Name: ${display_name}
- Age: ${age ?? "?"} (${age_bracket})${school_year ? ` · ${school_year}` : ""}
- Country: ${country || "(unknown)"}
- Education system: ${education_system}
- Academic context: ${academic_context || "(none)"}
- Normal weekday: ${normal_weekday || "(unknown)"}
- Fixed commitments: ${commitments || "(none)"}
- Timezone: ${tz || "(unknown)"}
- Preferences: ${prefLine}

ONBOARDING: ${onboarded} (confidence: ${obConfidence})
- Knowns: ${knowns || "(none)"}
- Unknowns: ${unknownsList || "(none)"}
- Assumptions: ${obAssumptions || "(none)"}

GOAL:${goal}
Why: ${why}
${hasHorizons ? `IMPORTANT: Reference all three horizons. Long-term is the WHY, medium-term is THIS YEAR's milestone, short-term is what to ship in the next 2–6 weeks. Tasks and advice should mostly ladder up from short-term → medium-term, with long-term as the anchor. Never plan as if only long-term exists.\n` : ""}
Current stage: ${current_stage || "unknown"} → Target: ${target_stage || "not set"}
Reality gap: ${reality_gap || "not yet assessed"}
Available study time: ~${available_min}min | Mode: ${active_mode || "default"}
Risk of bad advice: ${risk}${risk === "high" ? `\n⚠️ HIGH RISK: Do NOT generate tasks involving: ${premature}` : ""}${appropriate ? `\nAppropriate focus now: ${appropriate}` : ""}${unknownsList ? `\nWhat Moment still doesn't know: ${unknownsList} — do not invent these.` : ""}

Pursuit assumptions: ${assumptions || "none"}
Capabilities: ${capabilities || "not assessed"}

Signals — Feedback: ${fb} | Reflections: ${JSON.stringify(reflections)}${chatBlock}`.trim();
}

function userPrompt(intent: string, snapshot: any, payload: any): string {
  const ctx = buildContextHeader(snapshot);
  const _lt = snapshot?.active_goal?.long_term_goal ?? "";
  const _mt = snapshot?.active_goal?.medium_term_goal ?? "";
  const _st = snapshot?.active_goal?.short_term_goal ?? "";
  const _stmt = snapshot?.active_goal?.statement || "(no goal set)";
  const goal = (_lt || _mt || _st)
    ? `Long-term: ${_lt || "(not set)"} | Medium-term: ${_mt || "(not set)"} | Short-term: ${_st || "(not set)"}`
    : _stmt;
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

    case "suggest_tasks": {
      const payloadCountry = (payload?.country ?? snapshot?.user?.country ?? "unknown") as string;
      const payloadEdSystem = (payload?.education_system ?? snapshot?.user?.education_system ?? "unknown") as string;
      const payloadSchoolYear = (payload?.school_year ?? snapshot?.user?.school_year ?? "") as string;
      const existingTasks = (payload?.existing_tasks ?? payload?.tasks ?? []) as Array<{ title: string; status: string }>;
      const isAustralian = payloadCountry.toLowerCase().includes("austral");
      const localeNote = isAustralian
        ? `LOCALE: User is in Australia (${payloadEdSystem}). Use Australian curriculum terms: VCE/HSC/WACE/QCE/SACE, not A-levels or GCSEs. Reference ATAR where relevant.`
        : payloadCountry !== "unknown"
          ? `LOCALE: User is in ${payloadCountry} (${payloadEdSystem}). Use local curriculum terminology.`
          : "";
      return `${ctx}

Goal: ${goal || "(no goal set)"}
User's country: ${payloadCountry}
Education system: ${payloadEdSystem}
School year / level: ${payloadSchoolYear || current_stage}
Current stage: ${current_stage}. Target stage: ${target_stage}.
Existing tasks (do NOT duplicate these): ${JSON.stringify(existingTasks)}

${localeNote}

STAGE ENFORCEMENT:
${risk === "high" ? `⚠️ This user is NOT at the professional/advanced stage yet. You MUST NOT generate tasks involving: ${premature}.` : "Only generate tasks appropriate for their current stage."}

RULES:
1. Every task MUST have why_now: one sentence explaining why this fits their CURRENT stage specifically — not generic motivation.
2. Every task MUST have proof_of_completion: one concrete, observable deliverable. Be specific, not vague.
   GOOD: "A written list of 5 science prerequisite subjects with grade requirements"
   BAD: "Complete the task", "Understanding improved", "Research done"
3. Do NOT suggest tasks the user already has (check existing_tasks list).
4. Prefer foundational, exploratory, and pathway-clarity tasks for school-age users.
5. For students, tasks should produce something tangible: a note, a list, a draft, a score, a question set.
6. ZERO-RESEARCH-BURDEN RULE (HARD): You — the AI — do the research, not the user. It is FORBIDDEN to output tasks phrased as "research X", "find resources on Y", "look up Z", "explore options for...", "search for tutorials on...", "find a course on...", "identify materials for...", "gather information about...". These are admin tasks and are banned outright. You must name the specific resource yourself and put its real https URL in resource_url. The user's job is to CONSUME and ACT on what you found, never to go hunting.
7. HYPERLINK MAJORITY RULE: At least 2 of every 3 proposed tasks MUST carry a real, specific resource_url. A task with no hyperlink is allowed ONLY when the action is genuinely offline and self-contained (e.g. "Write a 1-page reflection on X", "Call the school admissions office about Y", "Sit a past paper you already printed"). If you can imagine a useful linked resource, you MUST attach it rather than omit it. Do not skip resource_url out of laziness.
8. RESOURCE QUALITY: resource_url must deep-link to ONE specific consumable item — not a homepage, not a search results page, not a category index. Examples:
   GOOD: a specific YouTube video URL, a specific Wikipedia article, a specific arXiv paper, a specific Khan Academy lesson, a specific MDN reference page, a specific government info page, a specific official syllabus PDF.
   BAD: youtube.com, wikipedia.org, "google.com/search?q=...", a course catalog, a homepage.
   Never use Google search URLs. Prefer naming a known specific source you are confident exists.
9. resource_label must name the specific resource (e.g. "3Blue1Brown — Essence of Calculus, Ch.1", "Khan Academy: Intro to Limits"), not a vague label like "video" or "article".
10. Keep the list focused and non-duplicative. Pick the highest-leverage next tasks, but do not assume the app enforces a 3-task day.
11. Every task MUST include elaborated_notes — 2 to 5 paragraphs of substantive, specific guidance the user can read before starting. Include: what the resource covers, the exact sections/timestamps/chapters to focus on, what to extract, common pitfalls, and the specific output to produce. No motivation, no filler, no "do your own research".

Propose a focused set of next tasks. Quality over quantity. Remember: when you return 3 tasks, ≥2 of 3 must include a real specific resource_url.`;
    }

    case "reflect_summary":
      return `${ctx}\n\nReflections: ${JSON.stringify(payload?.reflections ?? [])}\nName one true pattern (energy, friction, timing). One line of honest encouragement.`;

    case "notes_quick_review":
      return `${ctx}

The user wants a quick review + mini-lesson on the notes they wrote against this task.
Task: "${payload?.task_title ?? "(untitled task)"}"
Task context: ${payload?.task_context ?? "(none)"}
Notes (most recent first):
${(payload?.notes ?? []).map((n: { content: string; created_at?: string }, i: number) => `${i + 1}. ${n.content}`).join("\n") || "(no notes)"}

Rules:
- Ground every insight in something the user actually wrote. Quote short phrases when useful.
- The mini_lesson must teach a real concept, framework, or technique that helps THIS task and goal — not generic productivity advice.
- gaps should name what's missing or vague in the notes themselves.
- next_step must be doable in under 10 minutes.
- No motivation-speak. No "great job". Coach, don't cheerlead.`;

    case "mission_insight":
      return `${ctx}

Pursuit model: ${JSON.stringify(snapshot?.pursuit ?? null)}
Workstream analytics (per workstream: name, health 0-1, trend, velocity_7d, headline, top feedback labels): ${JSON.stringify(payload?.analytics ?? payload?.workstreams ?? [])}
Recent mission history (last 7 daily snapshots of overall_health): ${JSON.stringify(payload?.history ?? [])}

Produce a tailored mission read-out for THIS user, grounded in the numbers above. Output:
1. observation: the single most important thing they should notice right now — name the specific workstream or signal.
2. suggestion: optional one-line nudge tied to that observation.
3. notices: 3 to 5 additional tailored notices. Each one MUST come from a different angle (pick from: momentum, bottleneck, drift, imbalance, feedback_pattern, stage_progress, blind_spot, risk, celebrate). Each notice MUST reference real data — a workstream name, a number, a trend, a feedback label. NO generic productivity tropes. NO repeating the headline. If a workstream has health < 0.4, surface it as a bottleneck or risk. If velocity dropped vs the prior week, flag drift. If one workstream dominates completions while others stall, flag imbalance. If the user just hit a stage threshold or a streak of completions, celebrate it specifically.

Tone: calm, direct, age-aware, quietly invested. Never preachy.`;

    case "refine_task":
      return `Goal: ${payload?.goal || goal}\n\nTask after first-pass shrink: ${JSON.stringify(payload?.task ?? {})}\nUser's Tune feedback: "${payload?.feedback}".\n\nRefine ONLY the fields that need it. Lead with the first physical step. Be specific to THIS goal.`;

    case "refine_user_task":
      return `${ctx}

Goal: ${goal}
Current stage: ${current_stage}

The user just typed this task themselves: "${payload?.raw_title}" (${payload?.estimated_minutes ?? 30} min, priority "${payload?.priority ?? "medium"}").

Refine it into a single concrete, observable action tied to their goal and current stage:
- refined_title: keep the user's intent; tighten the wording; make it a verb-led action; no fluff. NEVER rephrase as "research X" / "find resources on Y" / "look up Z" — if the user typed that, convert it into consuming a specific named resource you provide.
- why_now: one sentence that links it to the goal at this stage (no generic motivation).
- proof_of_completion: one observable artefact, score, list, draft, or signal that proves it's done.
- estimated_minutes: adjust only if the user's number is clearly off.
- priority + category: infer from the action.
- resource_url + resource_label: STRONGLY PREFERRED — attach a real, specific https URL (deep-linked to one consumable item: a specific video, article, lesson, paper, official page) whenever the task could plausibly involve any online consumption. Omit ONLY when the action is genuinely offline and self-contained. Never use a homepage, category page, or search results URL. Never use Google search links.

Do not invent a different task. Do not lecture. Output only the JSON via the tool.`;

    case "plan_reform": {
      const completedTasks = (payload?.completed_tasks ?? []) as Array<{ title: string; feedback?: string }>;
      const feedbackBreakdown = payload?.feedback_breakdown ?? {};
      const reformNote = payload?.reform_note ?? "";
      return `${ctx}

The user wants to adjust their day plan. Their note: "${reformNote}"

Recent completed tasks: ${completedTasks.length ? completedTasks.map((t) => `"${t.title}"${t.feedback ? ` (feedback: ${t.feedback})` : ""}`).join(", ") : "none"}
Feedback breakdown: ${Object.keys(feedbackBreakdown).length ? JSON.stringify(feedbackBreakdown) : "none yet"}

Explain in 1–2 sentences exactly WHY the plan is changing (based on their feedback and task signals, not generically). Then list 2–3 specific adjustments being made. Then name the single most important focus for the adjusted plan.`;
    }

    case "week_regenerate": {
      const reformNote = (payload?.reform_note ?? "").toString().trim() || "Make it work better for me this week.";
      const currentBlocks = payload?.current_blocks ?? [];
      const commitments = snapshot?.commitments ?? [];
      const hobbies = snapshot?.hobbies ?? [];
      return `${ctx}

The user wants you to REGENERATE their weekly calendar based on this note:
"${reformNote}"

Their goal: ${goal}
Current stage: ${current_stage || "foundation"}
Fixed commitments (must keep): ${JSON.stringify(commitments)}
Hobbies they care about: ${JSON.stringify(hobbies)}
Current week_plan blocks (id, day_index 0=Mon..6=Sun, start, end, title, category, is_locked):
${JSON.stringify(currentBlocks)}

Rules:
1. KEEP every block with is_locked === true exactly as is (same day_index, times, title, category, is_locked: true).
2. Reshape/move/replace all other blocks according to the user's note.
3. Cover all 7 days. Times must be between 07:00 and 22:00 (24h), end after start, no overlaps within a single day.
4. Block titles must be specific to their goal (e.g. "Biology recall drill" not "Study"). Use category 'goal' for goal work, 'school' for school, 'commitment' for fixed obligations, 'hobby' for hobbies, 'rest' for breaks/sleep wind-down.
5. Aim for sustainable load: at least one rest/hobby block per weekday evening, lighter Sundays.
6. Return the FULL new week (locked + regenerated), not just diffs.

Output only the JSON via the tool.`;
    }

    case "forge_guidebook_candidates": {
      const userDescription = (payload?.description ?? "").trim() || "a custom tool for my goal";
      const education_system = snapshot?.user?.education_system ?? "unknown";
      const country = snapshot?.user?.country ?? "unknown";
      type ForgeToolSummary = { name?: string; title?: string };
      const existingToolTitles = (snapshot?.forge?.active_tools as ForgeToolSummary[] ?? [])
        .map((t) => t.name ?? t.title ?? "")
        .filter(Boolean)
        .join(", ") || "none yet";
      return `${ctx}

The user wants to build a Forge tool. Their description: "${userDescription}"
User's goal: ${goal}
Current stage: ${current_stage || "foundation"}
Education system: ${education_system} | Country: ${country}
Existing Forge tools (do NOT duplicate): ${existingToolTitles}

Generate EXACTLY 3 distinct Forge tool candidates. They must be meaningfully DIFFERENT — different function types, different problem angles, different run behaviours. NOT 3 versions of the same idea.

TOOL ARCHETYPES (use these as inspiration):
1. Drill Lab — active recall, quiz, revision practice (e.g. "Biology Micro-Recall Drill")
2. Mapper — prerequisites, steps, pathway clarity (e.g. "Science Prerequisite Mapper")
3. Tracker — pattern tracking over time (e.g. "Review Skip Pattern Tracker")
4. Recovery Protocol — help when falling behind (e.g. "Homework Rescue Splitter")
5. Research Helper — compress complex learning material (e.g. "Neuroscience Reading Compressor")
6. Decision Engine — choose between competing next moves (e.g. "Next Best Study Move")
7. Proof Builder — convert actions into evidence (e.g. "Medicine Pathway Proof Log")
8. Coach Lens — CBT-informed reflection and reframing (e.g. "Failure Recovery Lens")

Rules per candidate:
- title: SHORT, SPECIFIC, references the goal domain. NEVER "Custom Feature" or "Analyser".
- purpose: Names the goal domain. Explains what the tool helps the user DO.
- why_this_one: Specific to this user's CURRENT stage — not generic reasons.
- inputs: At least 1 concrete input. Make it specific to the problem.
- first_run_example: Concrete. What would the user actually see output on the first run?
- creates: What useful follow-up does this generate? (task, plan_block, context_signal, reflection)

Candidate quality checks:
✗ Generic: "Custom Feature" / "Helps you with your goal"
✓ Specific: "Biology Micro-Recall Drill" / "Turns passive neuroscience reading into active recall questions with difficulty rating"

For a user pursuing "${goal || "their goal"}" at ${current_stage || "foundation"} stage — what 3 DIFFERENT tool angles would a great tutor/coach offer?`;
    }

    case "forge_guidebook": {
      const userDescription = (payload?.description ?? "").trim() || "a custom tool for my goal";
      const moduleType = payload?.module_type ?? payload?.feature_type ?? "custom";
      const education_system = snapshot?.user?.education_system ?? "unknown";
      const country = snapshot?.user?.country ?? "unknown";
      return `${ctx}

The user wants to build a custom Forge tool. Their description: "${userDescription}"
Module type hint: ${moduleType}
User's goal: ${goal}
Current stage: ${current_stage || "foundation"}
Education system: ${education_system}
Country: ${country}

CRITICAL RULES — VIOLATIONS WILL BE REJECTED:
1. title must NOT be "Custom Feature", "Analyser", "AI Analysis", or any generic placeholder.
   Give it a SHORT SPECIFIC name reflecting the user's goal domain.
   Examples: "Brain Concept Lab", "Science Prerequisite Mapper", "Essay Draft Coach".
2. purpose must name the user's goal domain explicitly.
3. required_inputs must be SPECIFIC to this goal — not generic "describe your situation" fields.
   Minimum 2 inputs. Each must relate to what the AI needs to produce useful output.
4. ai_functions must have MINIMUM 2 distinct modes, each with a different function_type.
   Each ai_function must have prompt_contract of ≥60 characters describing the output format.
5. sections must have MINIMUM 3 sections: at least one input_panel, one ai_output, one saved_entries.
6. state_writes must exist: at minimum one entry for signal logging or task creation.
7. The whole feature must be immediately usable by someone working on "${goal || "their goal"}".
   Not aspirational. Not diagnostic. Actually useful from first run.

RESPONSE FORMAT — return a JSON object with ALL these fields:
{
  "title": "Short specific name (NOT 'Custom Feature' or 'Analyser')",
  "subtitle": "Optional subtitle",
  "purpose": "One sentence naming the goal domain and what this tool helps the user do",
  "feature_type": "One of: tracker, protocol, control_room, drill_lab, proof_builder, decision_engine, planner, simulator, coach_lens, research_helper, custom",
  "bottleneck_addressed": "What specific bottleneck this solves",
  "required_inputs": [
    { "id": "unique_id", "label": "Human label", "type": "text|textarea|number|select|scale", "placeholder": "Hint text", "required": true }
  ],
  "ai_functions": [
    {
      "id": "unique_id",
      "name": "Mode name (e.g. 'Explain simply', 'Quiz me', 'Find misconception')",
      "function_type": "analyze|generate_plan|split_tasks|score_quality|rank_options|simulate|challenge|summarize|extract_signals|create_next_move",
      "prompt_contract": "Detailed description of what the AI must return (at least 60 characters), specific to the goal domain",
      "input_sources": ["field_ids"],
      "writes_to_state": true,
      "allowed_state_actions": ["task/create", "forge/log_signal"]
    }
  ],
  "sections": [
    { "id": "unique_id", "heading": "Section heading", "section_type": "input_panel|ai_output|saved_entries|task_list|scorecard|protocol_steps|reflection_box", "linked_ai_function_id": "fn_id" }
  ],
  "state_writes": [
    { "trigger": "After AI run", "action_type": "forge/log_signal", "description": "What gets saved to Moment state" }
  ],
  "safety_rules": ["Rule 1", "Rule 2"],
  "suggested_next_task": {
    "title": "First concrete task to do with this feature",
    "why_now": "Why this is the right first use given current stage",
    "proof_of_completion": "How the user knows they completed it",
    "estimated_minutes": 20
  }
}

Think: what small, specific tool would a great tutor or coach build for this exact pursuit at this exact stage?
For a student wanting to ${goal || "achieve their goal"} at the ${current_stage || "foundation"} stage:
- What do they actually need to DO more effectively?
- What information do they need to PROCESS repeatedly?
- What proof do they need to CREATE or CHECK?
Generate a tool that serves one of those three purposes — not a generic analyser.`;
    }

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

const FREEFORM_INTENTS = new Set(["forge_guidebook", "forge_feature_ai", "forge_guidebook_candidates"]);

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

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
                why_now: { type: "string", description: "Why this task fits the user's current stage — not generic motivation." },
                proof_of_completion: { type: "string", description: "One concrete, observable thing the user produces or does that proves this task is done. Must be specific to this task." },
                user_stage_fit: { type: "string", enum: ["strong", "okay", "weak", "premature"] },
                resource_url: { type: "string", description: "REQUIRED if the task involves any online work (research, course, signup, doc, watch a video, read an article, use a tool). Provide a real, working https URL — a specific page, not just a homepage. Omit only for purely offline tasks (writing on paper, going outside, talking to someone in person)." },
                resource_label: { type: "string", description: "Short label for the URL, e.g. 'Khan Academy intro', 'Coursera course page', 'sign-up form'. Required whenever resource_url is set." },
              },
              required: ["title", "estimated_minutes", "category", "priority", "why_now", "proof_of_completion"],
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
  const goal = snapshot?.active_goal?.statement || "(no goal set)";
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

GOAL: ${goal}
Why: ${why}
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

Propose up to 5 tasks. Quality over quantity.`;
    }

    case "reflect_summary":
      return `${ctx}\n\nReflections: ${JSON.stringify(payload?.reflections ?? [])}\nName one true pattern (energy, friction, timing). One line of honest encouragement.`;

    case "mission_insight":
      return `${ctx}\n\nPursuit model: ${JSON.stringify(snapshot?.pursuit ?? null)}\nWorkstream statuses: ${JSON.stringify(payload?.workstreams ?? [])}\nWhat's the one thing the user should notice about their pathway right now?`;

    case "refine_task":
      return `Goal: ${payload?.goal || goal}\n\nTask after first-pass shrink: ${JSON.stringify(payload?.task ?? {})}\nUser's Tune feedback: "${payload?.feedback}".\n\nRefine ONLY the fields that need it. Lead with the first physical step. Be specific to THIS goal.`;

    case "refine_user_task":
      return `${ctx}

Goal: ${goal}
Current stage: ${current_stage}

The user just typed this task themselves: "${payload?.raw_title}" (${payload?.estimated_minutes ?? 30} min, priority "${payload?.priority ?? "medium"}").

Refine it into a single concrete, observable action tied to their goal and current stage:
- refined_title: keep the user's intent; tighten the wording; make it a verb-led action; no fluff.
- why_now: one sentence that links it to the goal at this stage (no generic motivation).
- proof_of_completion: one observable artefact, score, list, draft, or signal that proves it's done.
- estimated_minutes: adjust only if the user's number is clearly off.
- priority + category: infer from the action.

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

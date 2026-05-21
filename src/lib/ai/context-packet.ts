import type { MomentState, GoalFeasibilityReport } from "@/lib/types";
import { computeStallPattern } from "@/lib/selectors/audit";
import { buildLearningPortfolio, type LearningPortfolio } from "@/lib/ai/learning-portfolio";

export interface MomentContextPacket {
  user: {
    display_name: string;
    age?: number;
    age_bracket: string;
    school_year?: string;
    academic_context?: string;
    timezone: string;
    commitments: string[];
    normal_weekday?: string;
    country?: string;
    education_system?: string;
    preferences: {
      tone: string;
      strictness: string;
      schedule_style: string;
      support_style: string;
    };
  };
  active_goal: {
    statement: string;
    long_term_goal: string;
    medium_term_goal: string;
    short_term_goal: string;
    why_it_matters: string;
    horizon?: string;
    desired_identity: string;
    current_stage: string;
    target_stage: string;
    reality_gap: string;
    success_definition: string;
    status: string;
    phase: string;
    feasibility?: GoalFeasibilityReport;
  };

  current_reality: {
    available_study_minutes: number;
    school_end_time: string;
    energy_pattern: string;
    today_energy: string;
    stall_pattern: { stall_type: string; label: string; evidence_chips: string[] };
    pending_tasks_count: number;
    first_pending_high_priority: { id: string; title: string; estimated_minutes: number } | null;
  };
  pursuit: {
    family: string;
    family_confidence: number;
    summary: string;
    assumptions: string[];
    active_workstreams: Array<{ id: string; name: string; priority: string; status: string; bottleneck: string }>;
    capability_clusters: Array<{ id: string; name: string; status: string }>;
    risks: Array<{ id: string; name: string; severity: string }>;
    active_mode: string;
  } | null;
  signals: {
    recent_feedback: string[];
    recent_reflections: Array<{ date: string; energy: number; win: string; struggle: string }>;
    task_notes_context: Array<{
      task_id: string;
      task_title: string;
      task_status: string;
      notes: Array<{ content: string; created_at: string }>;
      latest_review?: {
        headline: string;
        key_insights: string[];
        gaps: string[];
        mini_lesson: { title: string; body: string };
        next_step: string;
        created_at: string;
      };
    }>;
    rescue_signals_7d: number;
    execution_feedback_breakdown: Record<string, number>;
  };
  onboarding: {
    completed: boolean;
    understanding: {
      knowns: string[];
      unknowns: string[];
      assumptions: string[];
      confidence: string;
    };
  };
  forge: {
    active_guidebooks: Array<{ id: string; title: string; feature_type: string }>;
    recent_signals: Array<{ feature: string; key: string; value: string }>;
  };
  recent_chat: Array<{ role: "user" | "assistant"; content: string }>;
  learning_portfolio: LearningPortfolio;
}

function horizonFromState(s: MomentState, key: "long" | "medium" | "short") {
  const answers = s.onboarding?.answers ?? {};
  const answerKey = key === "long" ? "long_term_goal" : key === "medium" ? "medium_term_goal" : "short_term_goal";
  const direct = answers[answerKey];
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const source = [s.active_goal.statement, s.active_goal.success_definition]
    .filter(Boolean)
    .join("\n");
  const label = key === "long" ? "Long-term" : key === "medium" ? "Medium-term" : "Short-term";
  const match = source.match(new RegExp(`${label}:\\s*([^\\n|·]+?)(?=\\s*\\||$)`, "i"));
  if (match?.[1]?.trim()) return match[1].trim();
  return key === "long" ? s.active_goal.statement : "";
}

export function buildContextPacket(s: MomentState | null): MomentContextPacket | Record<string, never> {
  if (!s) return {};

  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const feedbackBreakdown: Record<string, number> = {};
  for (const f of (s.execution_feedback ?? [])) {
    feedbackBreakdown[f.feedback] = (feedbackBreakdown[f.feedback] ?? 0) + 1;
  }

  const activeGuidebooks = (s.forge_state?.guidebooks ?? [])
    .filter((g) => g.status === "active")
    .map((g) => ({ id: g.id, title: g.title, feature_type: g.feature_type }));

  const recentSignals = (s.forge_state?.forge_signals ?? [])
    .slice(-10)
    .map((sig) => ({ feature: sig.feature_title, key: sig.signal_key, value: sig.value }));

  const pendingTasks = (s.tasks ?? []).filter((t) => t.status === "pending");
  const firstHighPriority = pendingTasks.find((t) => t.priority === "high");
  const taskNotesContext = (s.tasks ?? [])
    .filter((t) => (t.notes?.length ?? 0) > 0 || t.note_review)
    .slice(-12)
    .map((t) => ({
      task_id: t.id,
      task_title: t.title,
      task_status: t.status,
      notes: (t.notes ?? [])
        .slice(-5)
        .map((n) => ({ content: n.content, created_at: n.created_at })),
      latest_review: t.note_review
        ? {
            headline: t.note_review.headline ?? "",
            key_insights: t.note_review.key_insights ?? [],
            gaps: t.note_review.gaps ?? [],
            mini_lesson: {
              title: t.note_review.mini_lesson?.title ?? "",
              body: t.note_review.mini_lesson?.body ?? "",
            },
            next_step: t.note_review.next_step ?? "",
            created_at: t.note_review.created_at ?? "",
          }
        : undefined,
    }));

  const rescue7d = (s.rescue_signals ?? []).filter((r) => r.created_at >= sevenDaysAgo).length;

  return {
    user: {
      display_name: s.profile.display_name,
      age: s.profile.age,
      age_bracket: s.profile.age_bracket ?? "unknown",
      school_year: s.profile.school_year,
      academic_context: s.profile.academic_context,
      timezone: s.profile.timezone,
      commitments: s.profile.commitments ?? [],
      normal_weekday: s.profile.normal_weekday,
      country: s.profile.country,
      education_system: s.profile.education_system,
      preferences: {
        tone: s.profile.preferences?.tone ?? "calm",
        strictness: s.profile.preferences?.strictness ?? "soft",
        schedule_style: s.profile.preferences?.schedule_style ?? "flexible",
        support_style: s.profile.preferences?.support_style ?? "coach",
      },
    },
    active_goal: {
      statement: s.active_goal.statement,
      long_term_goal: horizonFromState(s, "long"),
      medium_term_goal: horizonFromState(s, "medium"),
      short_term_goal: horizonFromState(s, "short"),
      why_it_matters: s.active_goal.why_it_matters,
      horizon: s.active_goal.horizon,
      desired_identity: s.active_goal.desired_identity ?? "",
      current_stage: s.active_goal.current_stage ?? "",
      target_stage: s.active_goal.target_stage ?? "",
      reality_gap: s.active_goal.reality_gap ?? "",
      success_definition: s.active_goal.success_definition ?? "",
      status: s.active_goal.status,
      phase: s.active_goal.phase,
      feasibility: s.active_goal.feasibility,
    },

    current_reality: {
      available_study_minutes: s.constraints?.study_minutes_daily ?? 60,
      school_end_time: s.constraints?.school_end_time ?? "",
      energy_pattern: s.constraints?.energy_pattern ?? "unknown",
      today_energy: s.today_state?.energy ?? "unknown",
      stall_pattern: computeStallPattern(s),
      pending_tasks_count: pendingTasks.length,
      first_pending_high_priority: firstHighPriority
        ? { id: firstHighPriority.id, title: firstHighPriority.title, estimated_minutes: firstHighPriority.estimated_minutes }
        : null,
    },
    pursuit: s.pursuit_model
      ? {
          family: s.pursuit_model.pursuit_family,
          family_confidence: s.pursuit_model.family_confidence,
          summary: s.pursuit_model.summary,
          assumptions: s.pursuit_model.assumptions,
          active_workstreams: s.pursuit_model.workstreams.map((w) => ({
            id: w.id,
            name: w.name,
            priority: w.priority,
            status: w.status,
            bottleneck: w.bottleneck,
          })),
          capability_clusters: s.pursuit_model.capability_clusters.map((c) => ({
            id: c.id,
            name: c.name,
            status: c.status,
          })),
          risks: s.pursuit_model.risks.map((r) => ({
            id: r.id,
            name: r.name,
            severity: r.severity,
          })),
          active_mode: s.pursuit_model.active_operating_mode_id ?? "",
        }
      : null,
    signals: {
      recent_feedback: (s.execution_feedback ?? []).slice(-15).map((f) => f.feedback),
      recent_reflections: (s.reflections ?? [])
        .slice(-3)
        .map((r) => ({ date: r.date, energy: r.energy_rating, win: r.accomplishment, struggle: r.struggle ?? "" })),
      task_notes_context: taskNotesContext,
      rescue_signals_7d: rescue7d,
      execution_feedback_breakdown: feedbackBreakdown,
    },
    onboarding: {
      completed: s.onboarding?.completed ?? false,
      understanding: {
        knowns: s.onboarding?.understanding?.knowns ?? [],
        unknowns: s.onboarding?.understanding?.unknowns ?? [],
        assumptions: s.onboarding?.understanding?.assumptions ?? [],
        confidence: s.onboarding?.understanding?.confidence ?? "low",
      },
    },
    forge: {
      active_guidebooks: activeGuidebooks,
      recent_signals: recentSignals,
    },
    recent_chat: (s.chat_messages ?? [])
      .slice(-10)
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    learning_portfolio: buildLearningPortfolio(s),
  };
}

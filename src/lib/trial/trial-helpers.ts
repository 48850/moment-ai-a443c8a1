/**
 * Trial helpers — pure functions, no side effects, no state access.
 * Called by UI and store handlers.
 */
import type {
  ExamEmergency,
  ExamQuestion,
  MomentTrial,
  LearningToolResult,
  QuestionRating,
} from "@/lib/types";
import type { ForgeGuidebook } from "@/lib/types";

function nowISO() {
  return new Date().toISOString();
}

export function createTrialFromExam(
  exam: ExamEmergency,
  question: ExamQuestion,
): MomentTrial {
  return {
    id: `trial_exam_${exam.id}_${question.id}_${Date.now()}`,
    source: "exam",
    goal_id: undefined,
    proof_target: `Answer exam question: ${question.question_text.slice(0, 60)}`,
    skill_target: question.question_type,
    weakness_hypothesis: "May know the facts but not the consequence or structure",
    pressure_type: "exam",
    resource_ids: exam.resources.map((r) => r.id),
    mode: question.question_type === "essay" ? "answer_upgrade" : "proof_drill",
    status: "in_progress",
    created_at: nowISO(),
  };
}

export function createTrialFromForge(guidebook: ForgeGuidebook): MomentTrial {
  const modeMap: Record<string, MomentTrial["mode"]> = {
    drill_lab: "proof_drill",
    proof_builder: "pressure_test",
    simulator: "skill_simulation",
    coach_lens: "oral_trial",
    research_helper: "resource_forge",
    protocol: "lock_in_review",
    control_room: "skill_simulation",
    planner: "skill_simulation",
    decision_engine: "answer_upgrade",
    tracker: "lock_in_review",
    custom: "proof_drill",
  };

  return {
    id: `trial_forge_${guidebook.id}_${Date.now()}`,
    source: "forge",
    goal_id: guidebook.linked_goal_id || undefined,
    proof_target: guidebook.purpose,
    skill_target: guidebook.feature_type,
    weakness_hypothesis: guidebook.bottleneck_addressed || "",
    pressure_type: "skill",
    resource_ids: [],
    mode: modeMap[guidebook.feature_type] ?? "proof_drill",
    status: "ready",
    created_at: nowISO(),
  };
}

export function ratingLevelFromAnswer(
  answerLength: number,
  keywordsMatched: number,
): QuestionRating["level"] {
  if (answerLength < 20) return "needs_work";
  if (keywordsMatched >= 3 && answerLength >= 100) return "strong";
  if (keywordsMatched >= 2 && answerLength >= 60) return "solid";
  if (answerLength >= 40) return "developing";
  return "needs_work";
}

export function buildLocalFallbackRating(answerText: string): QuestionRating {
  const level = ratingLevelFromAnswer(answerText.length, 0);
  const labels: Record<QuestionRating["level"], string> = {
    needs_work: "Needs work",
    developing: "Developing",
    solid: "Solid",
    strong: "Strong",
  };
  const nextFixes: Record<QuestionRating["level"], string> = {
    needs_work: "Write at least one full sentence explaining your reasoning.",
    developing: "Add one more piece of evidence or explain the consequence.",
    solid: "Add a more specific example to strengthen your answer.",
    strong: "Review for clarity — this looks solid.",
  };

  return {
    level,
    practice_estimate_label: labels[level],
    strengths: level === "strong" || level === "solid" ? ["Attempted the question fully"] : [],
    missing_points: level === "needs_work" ? ["Answer is too short to evaluate"] : [],
    next_fix: nextFixes[level],
  };
}

export function buildProofTextFromTrial(
  trial: MomentTrial,
  result: LearningToolResult,
): string {
  const levelLabels: Record<QuestionRating["level"], string> = {
    needs_work: "practised a weak point",
    developing: "worked through a practice question",
    solid: "completed a solid practice attempt",
    strong: "completed a strong practice attempt",
  };
  const levelLabel = levelLabels[result.rating.level] ?? "completed a practice attempt";
  return `${trial.proof_target} — ${levelLabel}. Next fix: ${result.rating.next_fix}`;
}

import type { GoalFeasibilityReport } from "@/lib/types";

export interface TaskCandidate {
  id?: string;
  title: string;
  estimated_minutes: number;
  category: string;
  priority: string;
  why?: string;
  why_now?: string;
  user_stage_fit?: string;
  created_by?: string;
}

export interface FilteredTask extends TaskCandidate {
  user_stage_fit: "strong" | "okay" | "weak" | "premature";
  blocked_reason?: string;
}

interface FilterContext {
  age_bracket: string;
  current_stage: string;
  feasibility?: GoalFeasibilityReport;
}

// Hard-coded universal premature terms for teens — regardless of goal type
const UNIVERSAL_TEEN_PREMATURE_TERMS = [
  "patient case",
  "clinical",
  "residency",
  "medical school interview",
  "hospital rotation",
  "diagnose",
  "treatment plan",
  "licensing exam",
  "mcat",
  "usmle",
  "bar exam",
  "securities license",
  "institutional investor",
  "venture capital",
  "raise funding",
  "hire employee",
  "enterprise contract",
];

function isTeen(age_bracket: string): boolean {
  return age_bracket === "teen_13_15" || age_bracket === "teen_16_18" || age_bracket === "under_13";
}

function textOf(task: TaskCandidate): string {
  return `${task.title} ${task.why_now ?? ""} ${task.why ?? ""}`.toLowerCase();
}

function checkPremature(task: TaskCandidate, ctx: FilterContext): string | null {
  if (!isTeen(ctx.age_bracket)) return null;

  const text = textOf(task);

  // Explicit premature flag from AI
  if (task.user_stage_fit === "premature") {
    return `Marked premature by AI: not appropriate for current stage.`;
  }

  // Universal teen premature terms
  for (const term of UNIVERSAL_TEEN_PREMATURE_TERMS) {
    if (text.includes(term)) {
      return `Contains premature content for a teen ("${term}") — not yet stage-appropriate.`;
    }
  }

  // Feasibility-specific premature recommendations
  if (ctx.feasibility?.premature_recommendations?.length) {
    for (const rec of ctx.feasibility.premature_recommendations) {
      const slug = rec.toLowerCase().slice(0, 30);
      if (slug.length > 4 && text.includes(slug)) {
        return `Premature for current stage: "${rec}". Will unlock at ${ctx.feasibility.target_stage}.`;
      }
    }
  }

  return null;
}

function scoreStageFit(task: TaskCandidate, ctx: FilterContext): "strong" | "okay" | "weak" {
  if (!isTeen(ctx.age_bracket)) return "strong";
  if (!ctx.feasibility?.appropriate_focus_now?.length) return "okay";

  const text = textOf(task);
  const appropriateTerms = ctx.feasibility.appropriate_focus_now
    .map((a) => a.toLowerCase().split(" ").filter((w) => w.length > 4))
    .flat();

  const matchCount = appropriateTerms.filter((term) => text.includes(term)).length;

  if (matchCount >= 2) return "strong";
  if (matchCount >= 1) return "okay";
  return "okay"; // default okay — weak reserved for tasks with weak signals
}

/**
 * Filter and label AI-generated task candidates by stage appropriateness.
 *
 * Enforcement rule: this runs at the state boundary — inside the reducer for
 * task/add and task/bulk_add when created_by === "ai".
 *
 * Premature tasks are NOT deleted — they are returned with user_stage_fit: "premature"
 * and a blocked_reason. Callers decide whether to:
 *   - Filter them from the active task list
 *   - Promote them to GATE_STAR constellation nodes
 *   - Store them in a future_pathway bucket
 */
export function filterStageAppropriateTasks(
  tasks: TaskCandidate[],
  context: FilterContext,
): FilteredTask[] {
  return tasks.map((task): FilteredTask => {
    const prematureReason = checkPremature(task, context);
    if (prematureReason) {
      return {
        ...task,
        user_stage_fit: "premature",
        blocked_reason: prematureReason,
      };
    }

    const fit = scoreStageFit(task, context);
    return {
      ...task,
      user_stage_fit: task.user_stage_fit === "premature" ? "premature" : fit,
    };
  });
}
